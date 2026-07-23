# HTML Editor Streamlit Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-injected Streamlit annotation adapter that works with existing local Streamlit projects without modifying their source, while preserving every existing static HTML Editor behavior.

**Architecture:** Keep the static HTML injector untouched and add two isolated units: a Python project inspector/launcher and a standalone browser runtime. The browser runtime identifies Streamlit components with compound fingerprints, persists annotations across reruns, and exports a backward-compatible structured payload marked with `adapter: "streamlit"`.

**Tech Stack:** Python 3 standard library, browser JavaScript IIFE, Node.js built-in test runner, jsdom, Streamlit CLI, existing HTML Editor release builder.

---

## File Map

- Create `html-editor/scripts/streamlit_adapter.py`: inspect projects, choose an entry point, calculate a project fingerprint, choose a free port, and launch Streamlit without writing project files.
- Create `html-editor/assets/streamlit-annotator.js`: browser-only Streamlit annotation UI, compound fingerprints, persistence, rerun recovery, and export.
- Create `html-editor/test/test_streamlit_adapter.py`: Python unit tests for project discovery, fingerprinting, ports, and launch command construction.
- Create `html-editor/test/fixtures/streamlit-project/app.py`: deterministic single-file Streamlit fixture.
- Create `html-editor/test/fixtures/streamlit-project/pages/01_Detail.py`: deterministic multipage fixture.
- Create `html-editor/test/fixtures/streamlit-project/requirements.txt`: fixture dependency declaration.
- Create `html-editor/test/streamlit-fingerprint.test.js`: jsdom unit tests for component recognition and compound matching.
- Create `html-editor/test/streamlit-interaction.test.js`: jsdom interaction, persistence, rerun, ambiguity, and export tests.
- Modify `html-editor/SKILL.md`: document automatic Streamlit project and already-running-app workflows.
- Modify `html-editor/README.md`: document the adapter and verification commands.
- Modify `html-editor/CHANGELOG.md`: add the Streamlit Adapter release entry.
- Modify `html-editor/package.json`: bump the release version.
- Modify `html-editor/scripts/build-release.mjs`: package new runtime files.
- Modify `html-editor/test/release-package.test.js`: lock the new release contents and checksum name.

The existing `html-editor/scripts/wrap_annotator.py` and `html-editor/assets/annotator-inject.js` are not modified by this plan.

### Task 1: Establish a clean regression baseline

**Files:**
- Test: `html-editor/test/*.test.js`
- Test: `html-editor/test/test_*.py`

- [ ] **Step 1: Record the existing dirty files**

Run:

```bash
git status --short -- html-editor
```

Expected: existing user changes may be listed. Record them and do not reset, replace, or include unrelated hunks in later commits.

- [ ] **Step 2: Run the existing HTML Editor suite**

Run:

```bash
cd html-editor && npm test
```

Expected: all existing Node and Python tests pass. If the baseline fails, report the exact pre-existing failures before implementing.

- [ ] **Step 3: Run the unified workflow contract**

Run:

```bash
node --test workflow/test/contract.e2e.test.mjs
```

Expected: all cross-component contract tests pass.

### Task 2: Add non-mutating Streamlit project inspection

**Files:**
- Create: `html-editor/scripts/streamlit_adapter.py`
- Create: `html-editor/test/test_streamlit_adapter.py`
- Create: `html-editor/test/fixtures/streamlit-project/app.py`
- Create: `html-editor/test/fixtures/streamlit-project/pages/01_Detail.py`
- Create: `html-editor/test/fixtures/streamlit-project/requirements.txt`

- [ ] **Step 1: Create deterministic Streamlit fixtures**

Create `app.py` with:

```python
import streamlit as st

st.set_page_config(page_title="Adapter fixture")
st.title("商品列表")
st.button("收藏", key="collect")
st.text_input("搜索商品", key="search")
```

Create `pages/01_Detail.py` with:

```python
import streamlit as st

st.title("商品详情")
st.image("https://example.invalid/product.png", caption="商品图片")
st.button("立即购买", key="buy")
```

Create `requirements.txt` with:

```text
streamlit>=1.40
```

- [ ] **Step 2: Write failing discovery and fingerprint tests**

Add tests that import `streamlit_adapter.py` by path and assert:

```python
class StreamlitAdapterTests(unittest.TestCase):
    def test_discovers_main_entry_before_pages(self):
        info = module.inspect_project(FIXTURE)
        self.assertEqual(info["entry"], str(FIXTURE / "app.py"))
        self.assertEqual(info["pages"], [str(FIXTURE / "pages" / "01_Detail.py")])

    def test_fingerprint_changes_when_python_source_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / "app.py").write_text("import streamlit as st\n", encoding="utf-8")
            first = module.project_fingerprint(root)
            (root / "app.py").write_text("import streamlit as st\nst.title('x')\n", encoding="utf-8")
            self.assertNotEqual(first, module.project_fingerprint(root))
            self.assertRegex(first, r"^sha256:[0-9a-f]{64}$")

    def test_fingerprint_ignores_runtime_and_secret_files(self):
        before = module.project_fingerprint(FIXTURE)
        (FIXTURE / "__pycache__").mkdir(exist_ok=True)
        (FIXTURE / "__pycache__" / "app.pyc").write_bytes(b"runtime")
        self.assertEqual(before, module.project_fingerprint(FIXTURE))
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
cd html-editor && python3 -m unittest test/test_streamlit_adapter.py -v
```

Expected: FAIL because `scripts/streamlit_adapter.py` does not exist.

- [ ] **Step 4: Implement minimal inspection and fingerprinting**

Implement these public functions:

```python
def discover_entries(project: pathlib.Path) -> list[pathlib.Path]: ...
def project_fingerprint(project: pathlib.Path) -> str: ...
def inspect_project(project: pathlib.Path, entry: pathlib.Path | None = None) -> dict: ...
```

Discovery rules:

- Accept a `.py` file or directory.
- Prefer `app.py`, `streamlit_app.py`, `main.py`, then other root Python files containing `import streamlit` or `from streamlit`.
- Treat `pages/*.py` as pages, never as the default root entry.
- Hash relative paths and contents of `.py`, `.toml`, `.txt`, `.md`, `.json`, `.yaml`, and `.yml`.
- Ignore `.git`, virtual environments, `node_modules`, `__pycache__`, `.streamlit/secrets.toml`, and files above 5 MiB.
- Return absolute normalized paths, `sha256:<hex>`, dependency-file paths, and page paths.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd html-editor && python3 -m unittest test/test_streamlit_adapter.py -v
```

Expected: all inspection and fingerprint tests pass.

- [ ] **Step 6: Add failing port and launch-command tests**

Add:

```python
def test_build_launch_command_is_non_mutating(self):
    info = module.inspect_project(FIXTURE)
    command = module.build_launch_command(info["entry"], 8765)
    self.assertEqual(command, [
        sys.executable, "-m", "streamlit", "run", info["entry"],
        "--server.address", "127.0.0.1",
        "--server.port", "8765",
        "--server.headless=true"
    ])

def test_choose_port_returns_bindable_local_port(self):
    port = module.choose_port()
    with socket.socket() as server:
        server.bind(("127.0.0.1", port))
```

- [ ] **Step 7: Run tests to verify RED**

Run the same unittest command.

Expected: FAIL because `build_launch_command` and `choose_port` are missing.

- [ ] **Step 8: Implement launch support**

Implement:

```python
def choose_port() -> int: ...
def build_launch_command(entry: str, port: int) -> list[str]: ...
def launch(project: str, entry: str | None = None, port: int | None = None) -> int: ...
```

Use `sys.executable -m streamlit run`, bind only to `127.0.0.1`, inherit stdout/stderr, print one JSON readiness record before `subprocess.run`, and never write inside the inspected project.

Add an `argparse` CLI with these exact public commands:

```bash
python3 scripts/streamlit_adapter.py inspect /path/to/project
python3 scripts/streamlit_adapter.py launch /path/to/project
python3 scripts/streamlit_adapter.py launch /path/to/project --entry app.py --port 8765
```

`inspect` prints one JSON object and exits. `launch` prints one JSON readiness object containing `url`, `entry`, `projectFingerprint`, and `command`, flushes stdout, then replaces itself with or waits on the Streamlit child process.

- [ ] **Step 9: Verify GREEN and commit**

Run:

```bash
cd html-editor && python3 -m unittest test/test_streamlit_adapter.py -v
```

Expected: all tests pass.

Commit only the new adapter, tests, and fixtures:

```bash
git add html-editor/scripts/streamlit_adapter.py html-editor/test/test_streamlit_adapter.py html-editor/test/fixtures/streamlit-project
git commit -m "feat(html-editor): inspect and launch Streamlit projects"
```

### Task 3: Generate stable Streamlit compound fingerprints

**Files:**
- Create: `html-editor/assets/streamlit-annotator.js`
- Create: `html-editor/test/streamlit-fingerprint.test.js`

- [ ] **Step 1: Write failing jsdom fingerprint tests**

Build a fixture DOM containing `data-testid="stAppViewContainer"`, a main block, columns, a button, a text input, and duplicate labels on separate page identities. Evaluate the runtime and assert:

```javascript
const api = window.__HTML_EDITOR_STREAMLIT__;
const fingerprint = api.fingerprint(button);
assert.equal(fingerprint.adapter, 'streamlit');
assert.equal(fingerprint.componentType, 'button');
assert.equal(fingerprint.visibleText, '收藏');
assert.equal(fingerprint.testId, 'stBaseButton-secondary');
assert.equal(fingerprint.accessibleName, '收藏');
assert.deepEqual(fingerprint.containerPath, ['main', 'column:2']);
assert.ok(fingerprint.domSelector);
```

Add matching assertions:

```javascript
assert.deepEqual(api.match(fingerprint), { status: 'matched', element: button });
assert.equal(api.match(duplicateFingerprint).status, 'ambiguous');
assert.equal(api.match(missingFingerprint).status, 'missing');
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd html-editor && node --test test/streamlit-fingerprint.test.js
```

Expected: FAIL because `assets/streamlit-annotator.js` is missing.

- [ ] **Step 3: Implement the minimal fingerprint runtime**

Create a strict IIFE that exits when `window.__HTML_EDITOR_STREAMLIT__` already exists and exposes:

```javascript
window.__HTML_EDITOR_STREAMLIT__ = {
  version: "1.0.0",
  fingerprint: fingerprintElement,
  match: matchFingerprint,
  destroy: destroyAdapter
};
```

Implement:

- Streamlit root detection through `[data-testid="stAppViewContainer"]`.
- Component types for button, text input, text area, select, checkbox, radio, image, dataframe, chart, metric, markdown/text, form, column, container, sidebar, and unknown.
- Normalized visible text capped at 240 characters.
- Accessible name from `aria-label`, associated `<label>`, button text, image alt, or caption.
- Page identity from URL pathname plus visible page heading/navigation state.
- Container path from main/sidebar, forms, expanders, tabs, containers, and column index.
- Neighbor text from the nearest preceding and following meaningful nodes.
- Selector only as the lowest-priority fallback.
- Weighted matching that returns `matched` only for one candidate above threshold, `ambiguous` for tied plausible candidates, and `missing` otherwise.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
cd html-editor && node --test test/streamlit-fingerprint.test.js
```

Expected: all fingerprint tests pass.

Commit:

```bash
git add html-editor/assets/streamlit-annotator.js html-editor/test/streamlit-fingerprint.test.js
git commit -m "feat(html-editor): fingerprint Streamlit components"
```

### Task 4: Add Streamlit annotation, persistence, and export

**Files:**
- Modify: `html-editor/assets/streamlit-annotator.js`
- Create: `html-editor/test/streamlit-interaction.test.js`

- [ ] **Step 1: Write a failing toolbar and annotation test**

Boot the Streamlit fixture in jsdom, inject:

```javascript
window.__HTML_EDITOR_STREAMLIT_CONFIG__ = {
  projectFingerprint: `sha256:${'a'.repeat(64)}`,
  projectName: 'fixture'
};
```

Assert that:

- A three-action toolbar appears.
- Clicking “标记修改”, selecting a button, entering an intent, and saving creates one numbered pin.
- The underlying button click handler is not triggered in mark mode.
- The saved record contains `adapter`, page identity, component type, visible text, confidence, intent, and `changes`.

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
cd html-editor && node --test test/streamlit-interaction.test.js
```

Expected: FAIL because the Streamlit runtime has no toolbar or annotation interaction.

- [ ] **Step 3: Implement minimal annotation UI**

Add prefixed `ann-st-` DOM, CSS, and storage keys. Implement:

- Three-action toolbar: 标记修改, 我的修改, 完成标注.
- Capture-phase pointer interception while mark mode is active.
- Element selection and rectangular region selection.
- Plain-language intent input, save, cancel, edit, delete, and clear.
- Pin positioning from `getBoundingClientRect`.
- No permanent edits to business DOM.

- [ ] **Step 4: Verify GREEN**

Run the interaction test.

Expected: toolbar and save tests pass.

- [ ] **Step 5: Write failing persistence and export tests**

Assert that a reload with the same address and project fingerprint restores a unique target, while a changed project fingerprint does not restore it.

Assert the exported fenced payload contains:

```json
{
  "schemaVersion": "1.1",
  "adapter": "streamlit",
  "projectFingerprint": "sha256:...",
  "annotations": [
    {
      "scope": "target-only",
      "matchStatus": "matched",
      "confidence": "high",
      "intent": "按钮改成黑色",
      "changes": []
    }
  ]
}
```

Also assert the user-readable section contains page, component, visible text, neighboring text, and intent.

- [ ] **Step 6: Run tests to verify RED**

Run the interaction test.

Expected: FAIL on missing persistence/export behavior.

- [ ] **Step 7: Implement persistence and export**

Use a storage key derived from origin, pathname, project name, and project fingerprint. Fall back to in-memory storage when `localStorage` throws. Use the existing clipboard strategy: Clipboard API, hidden textarea plus `execCommand`, then a manual-copy modal.

- [ ] **Step 8: Verify GREEN and commit**

Run:

```bash
cd html-editor && node --test test/streamlit-interaction.test.js
```

Expected: all interaction, persistence, and export tests pass.

Commit:

```bash
git add html-editor/assets/streamlit-annotator.js html-editor/test/streamlit-interaction.test.js
git commit -m "feat(html-editor): annotate and export Streamlit feedback"
```

### Task 5: Recover safely after Streamlit reruns

**Files:**
- Modify: `html-editor/assets/streamlit-annotator.js`
- Modify: `html-editor/test/streamlit-interaction.test.js`

- [ ] **Step 1: Write failing rerun recovery tests**

Test these independent behaviors:

1. Replace the Streamlit main subtree with a semantically identical button; the toolbar remains single and the pin restores with `matched`.
2. Replace it with two identical buttons; no pin binds and the list shows `ambiguous`.
3. Remove the target; no pin binds and the list shows `missing`.
4. Change the page identity; an annotation from the old page does not bind to a same-label button.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd html-editor && node --test test/streamlit-interaction.test.js
```

Expected: the new rerun tests fail.

- [ ] **Step 3: Implement mutation recovery**

Attach one `MutationObserver` to the Streamlit root. Batch recovery through one `requestAnimationFrame`, ignore mutations caused only by `ann-st-` nodes, recompute match status, and render pins only for unique matches. Reconnect if Streamlit replaces the root itself.

- [ ] **Step 4: Verify GREEN and commit**

Run both Streamlit JS suites:

```bash
cd html-editor && node --test test/streamlit-fingerprint.test.js test/streamlit-interaction.test.js
```

Expected: all tests pass with no duplicate toolbar or observer warnings.

Commit:

```bash
git add html-editor/assets/streamlit-annotator.js html-editor/test/streamlit-interaction.test.js
git commit -m "fix(html-editor): recover annotations after Streamlit reruns"
```

### Task 6: Teach the skill the automatic browser-injection workflow

**Files:**
- Modify: `html-editor/SKILL.md`
- Modify: `html-editor/README.md`
- Modify: `html-editor/test/skill-contract.test.js`

- [ ] **Step 1: Write failing skill-contract tests**

Assert that `SKILL.md` contains:

- Trigger terms `Streamlit` and `启用 HTML Editor`.
- Project inspection command using `scripts/streamlit_adapter.py inspect`.
- Launch command using `scripts/streamlit_adapter.py launch`.
- Browser runtime configuration key `__HTML_EDITOR_STREAMLIT_CONFIG__`.
- Runtime marker `__HTML_EDITOR_STREAMLIT__`.
- Explicit statements that user source is not modified and old HTML workflows remain unchanged.
- Instructions to read the adapter asset, inject it into the active Streamlit tab, and avoid reinjection when the marker already exists.
- Failure behavior for missing dependencies, browser injection failure, ambiguous matching, and project fingerprint mismatch.

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
cd html-editor && node --test test/skill-contract.test.js
```

Expected: FAIL on missing Streamlit workflow tokens.

- [ ] **Step 3: Document exact Agent workflow**

Add two Streamlit paths:

1. Existing local app: confirm the target tab is Streamlit, calculate or accept the project fingerprint, inject config and `assets/streamlit-annotator.js`, and show the tab.
2. Uploaded project: inspect, launch, wait for the local URL, open it, inject config and runtime, and keep the process alive.

Require the Browser plugin’s current control skill as the source of truth. Do not hardcode plugin version paths. State that dependency installation needs normal approval and does not alter dependency declarations.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
cd html-editor && node --test test/skill-contract.test.js
```

Expected: all skill-contract tests pass.

Commit:

```bash
git add html-editor/SKILL.md html-editor/README.md html-editor/test/skill-contract.test.js
git commit -m "docs(html-editor): add automatic Streamlit workflow"
```

### Task 7: Package the adapter as an additive release

**Files:**
- Modify: `html-editor/package.json`
- Modify: `html-editor/package-lock.json`
- Modify: `html-editor/CHANGELOG.md`
- Modify: `html-editor/scripts/build-release.mjs`
- Modify: `html-editor/test/release-package.test.js`

- [ ] **Step 1: Write the failing release test**

Change expected release entries to include:

```text
html-editor/assets/streamlit-annotator.js
html-editor/scripts/streamlit_adapter.py
```

Set the expected checksum filename to `html-editor-1.4.0.zip`.

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
cd html-editor && node --test test/release-package.test.js
```

Expected: FAIL because the release builder still emits version 1.3.1 and excludes adapter files.

- [ ] **Step 3: Update release metadata minimally**

- Set package and lockfile version to `1.4.0`.
- Set `VERSION = '1.4.0'`.
- Add only the two adapter runtime files to `ALLOWED`.
- Add a `1.4.0 — Streamlit Adapter` changelog entry describing additive browser injection, compound fingerprints, rerun recovery, and unchanged static HTML behavior.

- [ ] **Step 4: Verify GREEN and build**

Run:

```bash
cd html-editor && node --test test/release-package.test.js
cd html-editor && node scripts/build-release.mjs
```

Expected: the test passes and `dist/html-editor-1.4.0.zip` plus its checksum are produced.

- [ ] **Step 5: Commit**

```bash
git add html-editor/package.json html-editor/package-lock.json html-editor/CHANGELOG.md html-editor/scripts/build-release.mjs html-editor/test/release-package.test.js html-editor/dist/html-editor-1.4.0.zip html-editor/dist/html-editor-1.4.0.zip.sha256
git commit -m "release(html-editor): package Streamlit adapter"
```

### Task 8: Final regression and non-mutation verification

**Files:**
- Verify: `html-editor/**`
- Verify: `workflow/test/contract.e2e.test.mjs`

- [ ] **Step 1: Run the complete HTML Editor suite**

Run:

```bash
cd html-editor && npm test
```

Expected: all Node and Python tests pass.

- [ ] **Step 2: Run the unified workflow contract**

Run:

```bash
node --test workflow/test/contract.e2e.test.mjs
```

Expected: all tests pass.

- [ ] **Step 3: Check JavaScript and Python syntax**

Run:

```bash
node --check html-editor/assets/annotator-inject.js
node --check html-editor/assets/streamlit-annotator.js
python3 -m py_compile html-editor/scripts/wrap_annotator.py html-editor/scripts/streamlit_adapter.py
```

Expected: all commands exit zero.

- [ ] **Step 4: Prove fixture source was not modified**

Run:

```bash
git diff --exit-code -- html-editor/test/fixtures/streamlit-project
```

Expected: no diff after launch and annotation tests, apart from fixture files intentionally added in Task 2 before their commit.

- [ ] **Step 5: Review the final scoped diff**

Run:

```bash
git status --short -- html-editor
git diff --check
git log --oneline -8
```

Expected: no whitespace errors; only planned adapter changes plus pre-existing user changes are present. Do not claim unrelated user changes as adapter work.
