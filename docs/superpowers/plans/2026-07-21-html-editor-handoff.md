# html-editor Workflow Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已确认的 macOS 风格标注浮层输出稳定、可绑定任务和会话的结构化修改请求，并证明局部修改不会误伤其他页面。

**Architecture:** 保持现有 UI 与零依赖注入方式，只扩展页面级上下文读取和导出协议。生成器在业务 HTML 根节点写入 workflow metadata，标注器读取但不修改业务结构；回传同时提供自然语言和 JSON，兼容不会处理 JSON 的 Agent。

**Tech Stack:** 原生 JavaScript、Python 注入脚本、Node test runner、JSDOM、Python `unittest`。

---

### Task 1: Define workflow metadata without changing the overlay

**Files:**
- Modify: `html-editor/assets/annotator-inject.js`
- Modify: `html-editor/scripts/wrap_annotator.py`
- Modify: `html-editor/test/annotator-contract.test.js`
- Modify: `html-editor/test/test_wrap_annotator.py`

- [ ] **Step 1: Add failing contract tests**

Assert the wrapper accepts:

```bash
python3 wrap_annotator.py input.html -o output.html \
  --task-id task-123 --session-id session-456 --prd-fingerprint sha256:abc
```

and injects one inert element:

```html
<meta name="prd-demo-workflow" data-task-id="task-123" data-session-id="session-456" data-prd-fingerprint="sha256:abc">
```

Assert annotator source reads that marker and exported JSON contains the three fields.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd html-editor && npm test`

Expected: new metadata assertions fail; existing UI tests remain green.

- [ ] **Step 3: Add wrapper arguments and safe escaping**

Add optional arguments `--task-id`, `--session-id`, `--prd-fingerprint`. Use `html.escape(value, quote=True)`; reject control characters; inject the meta element next to the annotator script. Do not inject metadata when all three options are absent.

- [ ] **Step 4: Read workflow context in the annotator**

Add:

```javascript
function workflowContext() {
  var node = document.querySelector('meta[name="prd-demo-workflow"]');
  return {
    taskId: node ? node.getAttribute("data-task-id") || "" : "",
    sessionId: node ? node.getAttribute("data-session-id") || "" : "",
    prdFingerprint: node ? node.getAttribute("data-prd-fingerprint") || "" : ""
  };
}
```

Merge it into the exported object; keep legacy pages with no marker valid.

- [ ] **Step 5: Run tests**

Run: `cd html-editor && npm test`

Expected: all Node and Python tests pass.

- [ ] **Step 6: Commit**

```bash
git add html-editor
git commit -m "feat: bind html annotations to workflow sessions"
```

### Task 2: Export clause-aware, stable modification requests

**Files:**
- Modify: `html-editor/assets/annotator-inject.js`
- Modify: `html-editor/test/annotator-contract.test.js`
- Modify: `html-editor/test/annotator-interaction.test.js`

- [ ] **Step 1: Add failing export tests**

For an annotated node `<button data-prd-clause="cl-014" data-prd-page="detail">试穿</button>`, assert one exported item equals:

```json
{
  "targetClauseId": "cl-014",
  "targetPageId": "detail",
  "targetNodeSelector": "[data-prd-clause=\"cl-014\"]",
  "action": "modify",
  "intent": "按钮改成黑色",
  "scope": "target-only"
}
```

For a node without `data-prd-clause`, retain the generated selector and set `targetClauseId: null` rather than inventing one.

- [ ] **Step 2: Verify failure**

Run: `cd html-editor && node --test test/annotator-contract.test.js test/annotator-interaction.test.js`

Expected: FAIL on missing clause/page/scope fields.

- [ ] **Step 3: Add target metadata capture**

When an annotation is created, record the nearest `[data-prd-clause]` and `[data-prd-page]`. Prefer a quoted attribute selector for the clause; preserve the existing selector as fallback. Never infer a clause ID from DOM order.

- [ ] **Step 4: Produce dual-format handoff**

The “完成标注” modal must contain:

1. a three-line natural-language summary grouped by page;
2. a fenced `prd-demo-annotations` JSON payload with `schemaVersion: "1.0"`, workflow context, source page, and annotation items.

The copy button copies both forms in one payload so the user still performs one action.

- [ ] **Step 5: Run all editor tests**

Run: `cd html-editor && npm test`

Expected: all tests pass and existing non-workflow pages still export.

- [ ] **Step 6: Commit**

```bash
git add html-editor/assets html-editor/test
git commit -m "feat: export clause aware annotation handoffs"
```

### Task 3: Add protected-scope regression fixture and release

**Files:**
- Create: `html-editor/test/fixtures/workflow-multipage.html`
- Create: `html-editor/test/workflow-regression.test.js`
- Modify: `html-editor/SKILL.md`
- Modify: `html-editor/CHANGELOG.md`
- Modify: `html-editor/package.json`

- [ ] **Step 1: Create a three-page fixture**

Each page has stable `data-prd-page` and `data-prd-clause` values. Annotate one clause on page 2 and snapshot `outerHTML` of pages 1 and 3 before/after annotation UI activity.

- [ ] **Step 2: Assert the overlay is non-invasive**

Run: `cd html-editor && node --test test/workflow-regression.test.js`

Expected: pages 1 and 3 hashes remain equal; page 2 business DOM also remains equal because html-editor only records intent.

- [ ] **Step 3: Document the handoff contract**

Update `SKILL.md` with injection arguments, exported fields, legacy behavior, and the rule that the consuming Agent—not html-editor—patches the business DOM.

- [ ] **Step 4: Bump and build**

Set version `1.2.0`, update changelog, then run:

```bash
cd html-editor
npm test
node scripts/build-release.mjs
```

Expected: `dist/html-editor-1.2.0.zip` and checksum exist; release-package test passes.

- [ ] **Step 5: Commit**

```bash
git add html-editor
git commit -m "build: release html editor workflow handoff"
```

