# prd-demo Workflow Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `prd-demo` 自动消费当前用户最新可信 Figma 任务，并以可恢复的逐题确认状态机生成高还原交互 Demo。

**Architecture:** 将现有已安装 Skill 原样纳入仓库的 `prd-demo-skill/`，以 Python 标准库提供纯本地、可测试的任务校验与会话状态运行时；飞书列目录和下载仍由 Agent 的 `lark-drive` 能力完成。`SKILL.md` 只编排“发现→校验→逐题确认→生成→注入→回执”，不把网络 SDK 或 Agent 私有接口写死在 Skill 中。

**Tech Stack:** Markdown Skill、Python 3 标准库、`unittest`、JSON Schema 风格协议、现有 `html-editor` 注入器。

---

## File map

- Create `prd-demo-skill/`: 仓库内可打包、可发布的 Skill 真源。
- Create `prd-demo-skill/scripts/figma_task_runtime.py`: 本地任务校验、哈希验证和候选排序。
- Create `prd-demo-skill/scripts/workflow_state.py`: `sessionId`、`prdFingerprint` 与逐题确认状态持久化。
- Create `prd-demo-skill/references/unified-workflow.md`: Agent 端飞书发现、下载、降级、回执协议。
- Modify `prd-demo-skill/SKILL.md`: 将统一 Workflow 设为 Figma 任务主路径，同时保留普通 PRD/截图输入。
- Modify `prd-demo-skill/references/clarification.md`: 固定三个核心确认问题和恢复规则。
- Replace `prd-demo-skill/references/figma-task-handoff.md`: 修正旧目录、旧时间字段和回写 `task.json` 的错误。
- Modify `prd-demo-skill/references/iteration-handoff.md`: 接入 html-editor 结构化标注和局部回归。
- Create `prd-demo-skill/test/test_figma_task_runtime.py`: 对抗性任务选择测试。
- Create `prd-demo-skill/test/test_workflow_state.py`: 断点恢复、PRD 变化和冲突测试。
- Create `prd-demo-skill/scripts/build_release.py`: 生成确定性 Skill ZIP 并拒绝缓存/凭证。

### Task 1: Vendor the current Skill without changing behavior

**Files:**
- Create: `prd-demo-skill/SKILL.md`
- Create: `prd-demo-skill/references/*.md`
- Create: `prd-demo-skill/references/contract.schema.json`
- Create: `prd-demo-skill/scripts/validate_prototype.py`

- [ ] **Step 1: Copy the installed Skill into the worktree**

Run:

```bash
cp -R /Users/bytedance/.codex/skills/prd-demo ./prd-demo-skill
```

Expected: `diff -qr /Users/bytedance/.codex/skills/prd-demo prd-demo-skill` prints nothing.

- [ ] **Step 2: Add a baseline inventory test**

Create `prd-demo-skill/test/test_skill_inventory.py`:

```python
import pathlib
import unittest

ROOT = pathlib.Path(__file__).parents[1]

class SkillInventoryTest(unittest.TestCase):
    def test_required_files_exist(self):
        required = {
            "SKILL.md",
            "references/clarification.md",
            "references/figma-materials.md",
            "references/figma-task-handoff.md",
            "references/iteration-handoff.md",
            "scripts/validate_prototype.py",
        }
        self.assertEqual([], sorted(str(path) for path in required if not (ROOT / path).is_file()))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the baseline test**

Run: `python3 -m unittest discover -s prd-demo-skill/test -p 'test_*.py' -v`

Expected: the unittest result for `test_required_files_exist` is `ok`, with one test run and zero failures.

- [ ] **Step 4: Commit the vendored source**

```bash
git add prd-demo-skill
git commit -m "chore: vendor prd-demo skill source"
```

### Task 2: Validate and rank downloaded Figma tasks

**Files:**
- Create: `prd-demo-skill/scripts/figma_task_runtime.py`
- Create: `prd-demo-skill/test/test_figma_task_runtime.py`
- Create: `prd-demo-skill/test/fixtures/tasks/valid-a/`
- Create: `prd-demo-skill/test/fixtures/tasks/valid-b/`

- [ ] **Step 1: Write failing tests for the trust boundary**

Create tests that build fixture directories in `tempfile.TemporaryDirectory()`. The test file defines `make_task` by writing `task.json`, `_COMPLETE.json`, `figma-export.manifest.json`, and `pages/frame.png`, then calculating the manifest/payload hashes with `hashlib.sha256`. Assert this public API:

```python
from scripts.figma_task_runtime import InvalidTask, select_latest_task, validate_task

def test_latest_uses_completed_at_not_created_at(self):
    older = make_task("a", created_at="2026-07-21T10:10:00Z", completed_at="2026-07-21T10:12:00Z")
    newer = make_task("b", created_at="2026-07-21T10:00:00Z", completed_at="2026-07-21T10:13:00Z")
    self.assertEqual("b", select_latest_task([older, newer], self.owner)["taskId"])

def test_missing_complete_is_ignored(self):
    partial = make_task("partial", include_complete=False)
    self.assertIsNone(select_latest_task([partial], self.owner))

def test_wrong_owner_is_rejected(self):
    task = make_task("wrong", owner="ou_other")
    with self.assertRaisesRegex(InvalidTask, "ownerOpenId"):
        validate_task(task, self.owner)

def test_tampered_payload_is_rejected(self):
    task = make_task("tampered")
    (task / "pages" / "frame.png").write_bytes(b"changed")
    with self.assertRaisesRegex(InvalidTask, "SHA-256"):
        validate_task(task, self.owner)

def test_unsafe_manifest_path_is_rejected(self):
    task = make_task("unsafe", png_path="../secret.png")
    with self.assertRaisesRegex(InvalidTask, "相对路径"):
        validate_task(task, self.owner)

def test_duplicate_valid_roots_are_ambiguous(self):
    first = make_root_marker("root-a", owner=self.owner)
    second = make_root_marker("root-b", owner=self.owner)
    with self.assertRaises(AmbiguousRoot):
        select_root([first, second], self.owner)
```

At the top of the test import `AmbiguousRoot` and `select_root`. `make_root_marker(name, owner)` creates `<temporary>/<name>/_PRD_DEMO_ROOT.json` with the exact four marker fields from the design. `make_task` always writes real bytes and derives `size`, per-file `sha256`, and `manifestSha256` from those bytes; it never hard-codes a digest.

- [ ] **Step 2: Run tests and verify the module is missing**

Run: `python3 -m unittest prd-demo-skill/test/test_figma_task_runtime.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.figma_task_runtime'`.

- [ ] **Step 3: Implement the validator**

Create `figma_task_runtime.py` with these exact public functions:

```python
import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path

class InvalidTask(ValueError):
    pass

class AmbiguousRoot(ValueError):
    pass

def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise InvalidTask(f"JSON 无法读取: {path}: {error}") from error

def safe_join(root, relative_path):
    root = Path(root).resolve()
    value = str(relative_path).replace("\\", "/")
    if not value or value.startswith("/") or ".." in Path(value).parts:
        raise InvalidTask(f"不是安全相对路径: {relative_path}")
    resolved = (root / value).resolve()
    if root != resolved and root not in resolved.parents:
        raise InvalidTask(f"路径逃逸任务目录: {relative_path}")
    return resolved

def parse_time(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as error:
        raise InvalidTask(f"completedAt 非法: {value}") from error

def validate_task(task_dir, expected_owner):
    root = Path(task_dir).resolve()
    task_path = root / "task.json"
    completion_path = root / "_COMPLETE.json"
    manifest_path = root / "figma-export.manifest.json"
    for required in (task_path, completion_path, manifest_path):
        if not required.is_file():
            raise InvalidTask(f"缺少任务文件: {required.name}")
    task = load_json(task_path)
    completion = load_json(completion_path)
    manifest = load_json(manifest_path)
    task_id = task.get("taskId")
    if not task_id or root.name != task_id or completion.get("taskId") != task_id:
        raise InvalidTask("目录名、task.json 与 _COMPLETE.json 的 taskId 不一致")
    if task.get("ownerOpenId") != expected_owner:
        raise InvalidTask("ownerOpenId 与当前用户不一致")
    exporter = manifest.get("exporter")
    if not isinstance(exporter, dict) or not isinstance(exporter.get("capabilities"), list) or not isinstance(manifest.get("pages"), list):
        raise InvalidTask("manifest 不是 exporter + pages unified 结构")
    for entry in task.get("files", []):
        path = safe_join(root, entry.get("path"))
        if not path.is_file():
            raise InvalidTask(f"任务文件不存在: {entry.get('path')}")
        if path.stat().st_size != entry.get("size"):
            raise InvalidTask(f"文件大小不一致: {entry.get('path')}")
        if sha256_file(path) != entry.get("sha256"):
            raise InvalidTask(f"SHA-256 不一致: {entry.get('path')}")
    for page in manifest["pages"]:
        for key in ("png", "svg"):
            if page.get(key):
                safe_join(root, page[key])
    if sha256_file(manifest_path) != completion.get("manifestSha256"):
        raise InvalidTask("manifestSha256 不一致")
    completed_at = completion.get("completedAt")
    parse_time(completed_at)
    return {
        "taskId": task_id,
        "completedAt": completed_at,
        "ownerOpenId": task["ownerOpenId"],
        "manifestPath": str(manifest_path),
        "capabilities": exporter["capabilities"],
        "taskDir": str(root),
    }

def select_latest_task(task_dirs, expected_owner):
    completed = []
    for directory in map(Path, task_dirs):
        marker = directory / "_COMPLETE.json"
        if marker.is_file():
            completed.append((parse_time(load_json(marker).get("completedAt")), directory))
    if not completed:
        return None
    completed.sort(key=lambda item: item[0], reverse=True)
    return validate_task(completed[0][1], expected_owner)

def select_root(marker_paths, expected_owner):
    valid = []
    for marker_path in map(Path, marker_paths):
        marker = load_json(marker_path)
        if marker == {
            "rootSchemaVersion": "1.0",
            "kind": "prd-demo-task-root",
            "ownerOpenId": expected_owner,
            "createdBy": "figma-capture-helper",
        }:
            valid.append(marker_path.parent)
    if len(valid) > 1:
        raise AmbiguousRoot("发现多个属于当前用户的 prd-demo 任务根目录")
    return str(valid[0]) if valid else None
```

`validate_task` must:

1. Require `_COMPLETE.json`, `task.json`, and `figma-export.manifest.json`.
2. Require directory name, task `taskId`, and completion `taskId` to match.
3. Require `ownerOpenId == expected_owner`.
4. Require manifest shape `exporter + pages` and explicit `capabilities`.
5. Resolve every `task.files[].path` beneath `task_dir`; reject absolute paths, `..`, missing files, size mismatch, or SHA-256 mismatch.
6. Verify `completion.manifestSha256` against manifest bytes.
7. Return `{taskId, completedAt, ownerOpenId, manifestPath, capabilities, taskDir}`.
8. `select_root` must return only one valid current-user marker and raise `AmbiguousRoot` when more than one exists.

`select_latest_task` must ignore only directories without `_COMPLETE.json`; a completed-but-invalid newest task must raise `InvalidTask` rather than silently fall back. Sort parsed ISO-8601 `completedAt` descending.

- [ ] **Step 4: Run the validator tests**

Run: `python3 -m unittest prd-demo-skill/test/test_figma_task_runtime.py -v`

Expected: all validator tests pass.

- [ ] **Step 5: Add a JSON CLI**

Add:

```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", required=True)
    parser.add_argument("task_dirs", nargs="+")
    args = parser.parse_args()
    print(json.dumps(select_latest_task(args.task_dirs, args.owner), ensure_ascii=False, indent=2))
```

Run: `python3 prd-demo-skill/scripts/figma_task_runtime.py --owner ou_test prd-demo-skill/test/fixtures/tasks/valid-a`

Expected: exit 0 and unified task metadata JSON.

- [ ] **Step 6: Commit**

```bash
git add prd-demo-skill/scripts/figma_task_runtime.py prd-demo-skill/test
git commit -m "feat: validate and select figma tasks"
```

### Task 3: Persist sequential confirmation state

**Files:**
- Create: `prd-demo-skill/scripts/workflow_state.py`
- Create: `prd-demo-skill/test/test_workflow_state.py`

- [ ] **Step 1: Write failing state-machine tests**

```python
from scripts.workflow_state import Conflict, WorkflowState, build_receipt, fingerprint_prd, new_session_id

def test_prd_fingerprint_is_stable_across_line_endings(self):
    self.assertEqual(fingerprint_prd("标题\r\n正文  \r\n"), fingerprint_prd("标题\n正文\n"))

def test_session_id_is_uuid(self):
    self.assertRegex(new_session_id(), r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

def test_questions_are_sequential_and_resume(self):
    state = WorkflowState.create("session-1", "task-1", "prd-a")
    self.assertEqual("pageScope", state.next_question())
    state.confirm("pageScope", ["home", "detail"])
    self.assertEqual("primaryFlow", state.next_question())
    loaded = WorkflowState.load(state.save(self.root))
    self.assertEqual("primaryFlow", loaded.next_question())

def test_three_core_questions_cannot_be_skipped(self):
    state = WorkflowState.create("session-1", "task-1", "prd-a")
    with self.assertRaisesRegex(ValueError, "pageScope"):
        state.confirm("primaryFlow", "home > detail")

def test_conflicting_answer_requires_explicit_replace(self):
    state = WorkflowState.create("session-1", "task-1", "prd-a")
    state.confirm("pageScope", ["home"])
    with self.assertRaises(Conflict):
        state.confirm("pageScope", ["detail"])

def test_prd_change_invalidates_only_affected_decisions(self):
    state = fully_confirmed_state()
    state.change_prd("prd-b", affected=["primaryFlow"])
    self.assertEqual("primaryFlow", state.next_question())
    self.assertEqual(["home"], state.answers["pageScope"])

def fully_confirmed_state():
    state = WorkflowState.create("session-1", "task-1", "prd-a")
    state.confirm("pageScope", ["home"])
    state.confirm("primaryFlow", "home > detail")
    state.confirm("frameBindings", [{"nodeId": "71:4909", "usage": "strict"}])
    return state

def test_receipt_requires_generated_state(self):
    state = fully_confirmed_state()
    with self.assertRaisesRegex(ValueError, "尚未生成"):
        build_receipt(state, "ou_agent", {"status": "completed"}, "2026-07-21T10:20:00Z")
    state.mark_generated()
    receipt = build_receipt(state, "ou_agent", {"status": "completed", "artifact": "demo/index.html"}, "2026-07-21T10:20:00Z")
    self.assertEqual(state.sessionId, receipt["sessionId"])
    self.assertEqual(state.prdFingerprint, receipt["prdFingerprint"])
```

- [ ] **Step 2: Verify failure**

Run: `python3 -m unittest prd-demo-skill/test/test_workflow_state.py -v`

Expected: FAIL because `workflow_state` does not exist.

- [ ] **Step 3: Implement the state contract**

Implement this state object; dataclass field names deliberately remain camelCase so `asdict` and JSON use the protocol names directly:

```python
import json
import os
import hashlib
import re
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

CORE_QUESTIONS = ("pageScope", "primaryFlow", "frameBindings")

def fingerprint_prd(text):
    normalized = "\n".join(line.rstrip() for line in str(text).replace("\r\n", "\n").replace("\r", "\n").split("\n")).strip() + "\n"
    return "sha256:" + hashlib.sha256(normalized.encode("utf-8")).hexdigest()

def new_session_id():
    return str(uuid.uuid4())

class Conflict(ValueError):
    pass

@dataclass
class WorkflowState:
    schemaVersion: str
    sessionId: str
    taskId: str
    prdFingerprint: str
    answers: dict = field(default_factory=dict)
    additionalQuestions: list = field(default_factory=list)
    phase: str = "confirming"

    @classmethod
    def create(cls, session_id, task_id, prd_fingerprint):
        return cls("1.0", session_id, task_id, prd_fingerprint)

    @classmethod
    def load(cls, path):
        return cls(**json.loads(Path(path).read_text(encoding="utf-8")))

    def save(self, root):
        if not re.fullmatch(r"[0-9A-Za-z._-]+", self.sessionId):
            raise ValueError("sessionId 含不安全字符")
        directory = Path(root) / "workflow-state"
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / f"{self.sessionId}.json"
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, target)
        return target

    def ordered_questions(self):
        return CORE_QUESTIONS + tuple(item["key"] for item in self.additionalQuestions)

    def next_question(self):
        for key in self.ordered_questions():
            if key not in self.answers:
                return key
        return None

    def confirm(self, key, value, replace=False):
        if key in self.answers and self.answers[key] != value and not replace:
            raise Conflict(f"{key} 已确认；冲突答案必须显式 replace")
        expected = self.next_question()
        if key not in self.answers and key != expected:
            raise ValueError(f"当前必须先确认 {expected}")
        self.answers[key] = value
        self.phase = "ready-to-generate" if self.next_question() is None else "confirming"

    def add_question(self, key, prompt, evidence):
        if key in CORE_QUESTIONS or any(item["key"] == key for item in self.additionalQuestions):
            raise ValueError(f"问题键重复: {key}")
        self.additionalQuestions.append({"key": key, "prompt": prompt, "evidence": evidence})
        self.phase = "confirming"

    def change_prd(self, new_fingerprint, affected):
        allowed = set(self.ordered_questions())
        unknown = set(affected) - allowed
        if unknown:
            raise ValueError(f"未知受影响决策: {sorted(unknown)}")
        self.prdFingerprint = new_fingerprint
        for key in affected:
            self.answers.pop(key, None)
        self.phase = "confirming" if self.next_question() else "ready-to-generate"

    def mark_generated(self):
        if self.phase != "ready-to-generate":
            raise ValueError("核心确认未完成，不能生成")
        self.phase = "generated"

    def mark_receipt_written(self):
        if self.phase != "generated":
            raise ValueError("Demo 尚未生成，不能写消费回执")
        self.phase = "receipt-written"

def build_receipt(state, agent_user_open_id, result, consumed_at):
    if state.phase != "generated":
        raise ValueError("Demo 尚未生成，不能构造消费回执")
    return {
        "consumptionSchemaVersion": "1.0",
        "sessionId": state.sessionId,
        "taskId": state.taskId,
        "prdFingerprint": state.prdFingerprint,
        "agentUserOpenId": agent_user_open_id,
        "consumedAt": consumed_at,
        "result": result,
        "decisions": {
            "pageScope": state.answers["pageScope"],
            "primaryFlow": state.answers["primaryFlow"],
            "frameBindings": state.answers["frameBindings"],
        },
    }
```

Persist atomically by writing `workflow-state/{sessionId}.json.tmp` and `os.replace` to `.json`. `confirm` accepts only the current unanswered key unless `replace=True`. `phase` transitions `confirming → ready-to-generate → generated → receipt-written`.

- [ ] **Step 4: Run state tests**

Run: `python3 -m unittest prd-demo-skill/test/test_workflow_state.py -v`

Expected: all tests pass, including reload after question 2.

- [ ] **Step 5: Commit**

```bash
git add prd-demo-skill/scripts/workflow_state.py prd-demo-skill/test/test_workflow_state.py
git commit -m "feat: persist prd demo confirmation state"
```

### Task 4: Rewrite the Skill orchestration contract

**Files:**
- Modify: `prd-demo-skill/SKILL.md`
- Modify: `prd-demo-skill/references/clarification.md`
- Replace: `prd-demo-skill/references/figma-task-handoff.md`
- Create: `prd-demo-skill/references/unified-workflow.md`
- Modify: `prd-demo-skill/references/iteration-handoff.md`
- Create: `prd-demo-skill/test/test_workflow_docs.py`

- [ ] **Step 1: Add failing documentation invariants**

```python
def test_stale_handoff_rules_are_absent(self):
    text = (ROOT / "references/figma-task-handoff.md").read_text()
    for stale in ("{userId}__{taskId}", "回写 `consumedAt`", "按 `createdAt`"):
        self.assertNotIn(stale, text)

def test_required_workflow_rules_are_present(self):
    text = (ROOT / "SKILL.md").read_text()
    for rule in ("_COMPLETE.json.completedAt", "ownerOpenId", "pageScope", "primaryFlow", "frameBindings", "html-editor"):
        self.assertIn(rule, text)
```

- [ ] **Step 2: Run and verify failure**

Run: `python3 -m unittest prd-demo-skill/test/test_workflow_docs.py -v`

Expected: FAIL on stale task directory and missing workflow keys.

- [ ] **Step 3: Update the main Skill flow**

Make `SKILL.md` define this exact order:

1. Read current conversation PRD; if absent ask only for PRD.
2. If Figma task is implied, use `lark-drive` to find the unique marked `/prd-demo-tasks/` root for current `ownerOpenId`.
3. List completed task folders, sort by `_COMPLETE.json.completedAt`, download newest candidate, run `figma_task_runtime.py`.
4. If newest completed task is corrupt, report reason and ask once whether to inspect the previous completed task.
5. Create/load `workflow-state/{sessionId}.json` and ask exactly one question per turn in order: `pageScope`, `primaryFlow`, `frameBindings`; add questions only for real ambiguity.
6. Summarize in 3–5 lines and generate without an extra “start?” question.
7. Inject html-editor; injection failure means incomplete delivery.
8. Upload immutable `consumption/{sessionId}.json`; never modify task or completion files.

Keep plain PRD/screenshot generation working when no Figma task is requested.

- [ ] **Step 4: Correct the handoff reference**

Document `/prd-demo-tasks/{taskId}/`, `_PRD_DEMO_ROOT.json`, `ownerOpenId`, `_COMPLETE.json.completedAt`, local SHA-256 validation, explicit corrupt-latest handling, and immutable `consumption/{sessionId}.json`.

- [ ] **Step 5: Define sequential question copy**

For each core question, require evidence, one recommendation, user-visible outcome, and one-line answer format. Explicitly forbid bundling questions and forbid skipping the three core confirmations even when a recommendation is determined.

- [ ] **Step 6: Define annotation re-entry**

Update `iteration-handoff.md` to require `taskId`, `sessionId`, `targetClauseId` when present, and a protected-scope regression: compare hashes or normalized output of every unaffected page before and after the patch.

- [ ] **Step 7: Run documentation tests**

Run: `python3 -m unittest discover -s prd-demo-skill/test -p 'test_*.py' -v`

Expected: all Skill tests pass.

- [ ] **Step 8: Commit**

```bash
git add prd-demo-skill
git commit -m "feat: orchestrate the unified prd demo workflow"
```

### Task 5: Build a clean Skill release

**Files:**
- Create: `prd-demo-skill/scripts/build_release.py`
- Create: `prd-demo-skill/test/test_release.py`
- Create: `prd-demo-skill/dist/prd-demo-workflow.zip`

- [ ] **Step 1: Write a failing release test**

Assert the ZIP contains `SKILL.md`, all referenced Markdown/JSON, runtime scripts, but excludes `test/`, `dist/`, `__pycache__`, `.DS_Store`, tokens, secrets, and absolute local paths.

- [ ] **Step 2: Verify failure**

Run: `python3 -m unittest prd-demo-skill/test/test_release.py -v`

Expected: FAIL because the release builder does not exist.

- [ ] **Step 3: Implement deterministic packaging**

Walk only `SKILL.md`, `references/`, and `scripts/`; sort paths; write ZIP entries with a fixed timestamp `(2026, 1, 1, 0, 0, 0)`; scan text files for `/Users/`, `access_token`, `app_secret`, and `ownerOpenId` values beginning with `ou_` before packaging.

- [ ] **Step 4: Build and test**

Run:

```bash
python3 prd-demo-skill/scripts/build_release.py
python3 -m unittest discover -s prd-demo-skill/test -p 'test_*.py' -v
```

Expected: `prd-demo-skill/dist/prd-demo-workflow.zip` exists and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add prd-demo-skill
git commit -m "build: package prd-demo workflow skill"
```
