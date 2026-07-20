# html-editor macOS Overlay Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 html-editor 1.0.0 的 emoji 密集标注界面升级为 macOS 原生 Inspector 风格的 HTML 浮层，同时保持现有点选、框选、持久化、参考图和机器可读导出协议兼容。

**Architecture:** 保留 `wrap_annotator.py → annotator-inject.js → 注入原 HTML` 的单文件、自包含、零运行时依赖架构。先把市场源包固化到仓库并建立协议与包装器基线测试，再在原 IIFE 中以“小型 SVG 图标工厂 + UI 构建函数 + 现有数据模型”替换可见界面；不拆改选择器、存储、图片压缩和序列化核心。测试使用 Python `unittest`、Node 内置测试和 `jsdom` 开发依赖，最终用真实 HTML 桌面/移动视口做视觉与交互验收。

**Tech Stack:** Vanilla JavaScript ES5-compatible IIFE、HTML/CSS、inline SVG、Python 3 标准库、Node.js `node:test`、jsdom（仅测试）、AgentBuddy Skill 包结构。

---

## File Map

- Create: `html-editor/SKILL.md` — 市场版说明的更新稿，使用新的用户术语和流程。
- Create: `html-editor/assets/annotator-inject.js` — 从市场 1.0.0 固化并实施 UI 重构的自包含注入脚本。
- Create: `html-editor/scripts/wrap_annotator.py` — 原包装器，保持注入和 `--force` 兼容。
- Create: `html-editor/package.json` — 只声明测试命令和 `jsdom` 开发依赖，不进入 Skill 交付包。
- Create: `html-editor/test/annotator-contract.test.js` — UI、图标、协议和可见术语回归。
- Create: `html-editor/test/annotator-interaction.test.js` — jsdom 中的工具条、Inspector、列表与完成流程测试。
- Create: `html-editor/test/test_wrap_annotator.py` — 注入位置、幂等和强制升级测试。
- Create: `html-editor/test/fixtures/sample.html` — 桌面和移动验收共用的静态页面。
- Create: `html-editor/test/fixtures/legacy-annotated.html` — `--force` 升级回归输入。
- Create: `html-editor/CHANGELOG.md` — 1.1.0 变更和兼容性说明。
- Create: `html-editor/scripts/build-release.mjs` — 只打包 Skill 运行文件并扫描开发残留。
- Create: `html-editor/dist/html-editor-1.1.0.zip` — 本地验收交付物，不提交 Git。

### Task 1: Vendor 1.0.0 Source and Establish the Baseline

**Files:**
- Create: `html-editor/SKILL.md`
- Create: `html-editor/assets/annotator-inject.js`
- Create: `html-editor/scripts/wrap_annotator.py`
- Create: `html-editor/package.json`
- Create: `html-editor/test/test_wrap_annotator.py`
- Create: `html-editor/test/annotator-contract.test.js`
- Create: `html-editor/test/fixtures/sample.html`
- Create: `html-editor/test/fixtures/legacy-annotated.html`

- [ ] **Step 1: Copy the reviewed market source into the isolated worktree**

Copy only these runtime files from the temporary AgentBuddy install:

```text
/tmp/html-editor-source/.agents/skills/html-editor/SKILL.md
/tmp/html-editor-source/.agents/skills/html-editor/assets/annotator-inject.js
/tmp/html-editor-source/.agents/skills/html-editor/scripts/wrap_annotator.py
```

Expected tree:

```text
html-editor/
├── SKILL.md
├── assets/annotator-inject.js
└── scripts/wrap_annotator.py
```

- [ ] **Step 2: Write failing wrapper baseline tests**

Create `html-editor/test/test_wrap_annotator.py`:

```python
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("wrap_annotator", ROOT / "scripts" / "wrap_annotator.py")
wrap = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(wrap)


class WrapAnnotatorTest(unittest.TestCase):
    def test_injects_before_body_and_is_idempotent(self):
        snippet = wrap.build_snippet("console.log('ann')")
        first, mode = wrap.inject("<html><body><main>demo</main></body></html>", snippet)
        second, second_mode = wrap.inject(first, snippet)
        self.assertEqual(mode, "before-body")
        self.assertEqual(second_mode, "already-injected")
        self.assertEqual(second.count(wrap.MARKER), 1)

    def test_force_strip_removes_old_script_and_style(self):
        old = '<style data-annotator="true">old</style><script data-annotator="true">old</script>'
        clean, count = wrap.strip_injected(old)
        self.assertEqual(count, 2)
        self.assertNotIn("data-annotator", clean)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Write passing export-protocol baseline tests**

Create `html-editor/package.json`:

```json
{
  "name": "html-editor-skill",
  "version": "1.1.0",
  "private": true,
  "scripts": {
    "test": "node --test test/*.test.js && python3 -m unittest discover -s test -p 'test_*.py'"
  },
  "devDependencies": {
    "jsdom": "26.1.0"
  }
}
```

Create the initial assertions in `html-editor/test/annotator-contract.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'annotator-inject.js'), 'utf8');

test('keeps the established machine-readable export protocol', () => {
  for (const token of ['页面:', '选择器:', '片段:', '批注:', '[[[IMG:', '[[[/IMG]]]']) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

```

- [ ] **Step 4: Run tests and verify the imported baseline is green**

Run:

```bash
cd html-editor
npm install
npm test
```

Expected: wrapper and export protocol tests pass. Do not add redesign assertions to this baseline commit.

- [ ] **Step 5: Commit the immutable green baseline**

```bash
git add html-editor
git commit -m "test: establish html editor compatibility baseline"
```

### Task 2: Add the SVG Icon System and macOS Visual Tokens

**Files:**
- Modify: `html-editor/assets/annotator-inject.js:1-220`
- Modify: `html-editor/test/annotator-contract.test.js`

- [ ] **Step 1: Add a failing icon-system test**

Append:

```js
test('uses one inline SVG icon factory and macOS visual tokens', () => {
  assert.match(source, /function iconSvg\(name\)/);
  assert.match(source, /viewBox="0 0 24 24"/);
  assert.match(source, /--ann-accent:\s*#0A84FF/i);
  assert.match(source, /--ann-danger:\s*#FF453A/i);
  assert.match(source, /-apple-system/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test test/annotator-contract.test.js`  
Expected: FAIL because `iconSvg` and design tokens do not exist.

- [ ] **Step 3: Implement a single SVG factory**

Add near the top of the IIFE:

```js
function iconSvg(name) {
  var paths = {
    add: '<path d="M12 5v14M5 12h14"/>',
    list: '<path d="M5 7h14M5 12h14M5 17h10"/>',
    done: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    text: '<path d="M4 6h16M8 6v12M5 18h6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m5 17 5-5 4 4 2-2 3 3"/>',
    resize: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
    reference: '<path d="M4 15 15 4l5 5L9 20H4v-5Z"/><path d="m13 6 5 5"/>',
    attach: '<path d="m20 12-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/>'
  };
  return '<svg aria-hidden="true" viewBox="0 0 24 24">' + (paths[name] || paths.add) + '</svg>';
}
```

- [ ] **Step 4: Replace injected CSS with scoped macOS tokens**

At the start of the injected style, define:

```css
:root {
  --ann-accent: #0A84FF;
  --ann-danger: #FF453A;
  --ann-text: #1D1D1F;
  --ann-secondary: #6E6E73;
  --ann-border: rgba(0,0,0,.13);
  --ann-surface: rgba(249,249,250,.96);
}
[data-annotator="true"] {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

Keep every selector under existing `#ann-*`, `.annotator-*`, or `[data-annotator]` namespaces.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`  
Expected: all current tests pass. Each later task introduces its own failing assertion immediately before implementation.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test/annotator-contract.test.js
git commit -m "feat: add macos annotation visual system"
```

### Task 3: Rebuild the Floating Toolbar Without Changing Annotation State

**Files:**
- Modify: `html-editor/assets/annotator-inject.js:220-280`
- Create: `html-editor/test/annotator-interaction.test.js`

- [ ] **Step 1: Write a failing toolbar DOM test**

Create `annotator-interaction.test.js` with a helper that loads `sample.html`, executes the injection script in jsdom, and asserts:

```js
test('boots a compact three-action annotation toolbar', () => {
  const { document } = bootFixture();
  const toolbar = document.querySelector('#ann-toolbar');
  assert.ok(toolbar);
  assert.equal(toolbar.querySelectorAll('button').length, 3);
  assert.equal(toolbar.querySelector('[data-action="mark"]').textContent.trim(), '标记修改');
  assert.match(toolbar.querySelector('[data-action="list"]').textContent, /我的修改/);
  assert.equal(toolbar.querySelector('[data-action="finish"]').textContent.trim(), '完成标注');
  assert.equal(toolbar.querySelectorAll('svg').length, 3);
});
```

The fixture helper must stub `localStorage`, `URL.createObjectURL`, canvas methods, clipboard, and `requestAnimationFrame`, then dispatch `DOMContentLoaded` when needed.

- [ ] **Step 2: Verify the toolbar test fails against the old buildUI**

Run: `node --test test/annotator-interaction.test.js`  
Expected: FAIL because old labels are `开始标注 / 导出 / 标注列表`.

- [ ] **Step 3: Implement the compact toolbar**

Replace only toolbar construction inside `buildUI()`:

```html
<div id="ann-toolbar" data-annotator="true" role="toolbar" aria-label="页面标注工具">
  <button data-action="mark">[add svg]<span>标记修改</span></button>
  <button data-action="list">[list svg]<span>我的修改</span><span id="ann-count">0</span></button>
  <button data-action="finish">[done svg]<span>完成标注</span></button>
</div>
```

Map these buttons to existing `toggleMode`, `openList`, and `openExport` behavior. Rename only visible labels; keep state variables and event capture logic unchanged.

- [ ] **Step 4: Update mode state without emoji**

`toggleMode()` must update the first action to `继续标记` after at least one annotation and expose `aria-pressed`; it must never set `innerHTML` from user content.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`  
Expected: toolbar and baseline tests pass.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test/annotator-interaction.test.js
git commit -m "feat: simplify annotation toolbar"
```

### Task 4: Replace the Annotation Input With a macOS Inspector

**Files:**
- Modify: `html-editor/assets/annotator-inject.js:438-650`
- Modify: `html-editor/test/annotator-interaction.test.js`

- [ ] **Step 1: Write failing Inspector and progressive-disclosure tests**

Test that selecting `#target-title` creates `#ann-inspector` with:

```js
assert.equal(document.querySelector('#ann-inspector h2').textContent, '添加修改');
assert.match(document.querySelector('#ann-inspector [data-role="context"]').textContent, /已选中/);
assert.equal(document.querySelector('#ann-inspector [data-role="question"]').textContent, '你希望这里怎么调整？');
assert.deepEqual(
  [...document.querySelectorAll('#ann-inspector [data-quick-action]')].map(el => el.textContent.trim()),
  ['修改文字', '更换图片', '调整位置或大小', '参考其他样式']
);
assert.equal(document.querySelector('#ann-inspector [data-action="save"]').textContent, '保存修改');
```

Also assert that second-level choices do not exist until the corresponding quick action is clicked.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/annotator-interaction.test.js`  
Expected: FAIL on old popup labels and emoji buttons.

- [ ] **Step 3: Implement safe element description**

Add:

```js
function describeElement(el) {
  var text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
  var role = el.tagName === 'IMG' ? '图片' : el.tagName === 'BUTTON' ? '按钮' : el.tagName === 'A' ? '链接' : '页面内容';
  return text ? role + '“' + text.slice(0, 24) + '”' : role;
}
```

Use `textContent`, not interpolated `innerHTML`, for every user/page-derived value.

- [ ] **Step 4: Implement the Inspector and action rows**

Create DOM nodes for the header, context, question, textarea, four SVG action rows, hidden second-level panel, attach-image input, cancel, and save. Reuse existing `pickColor`, `addRef`, `renderRefs`, submit, edit, and close behavior behind the new controls.

The `修改文字` submenu offers `改文字内容 / 字大一点 / 字小一点 / 文字更醒目`; `更换图片` opens reference-image selection plus description; `调整位置或大小` offers movement, size, and spacing phrases; `参考其他样式` opens reference-image selection.

- [ ] **Step 5: Add viewport placement behavior**

Desktop uses a fixed Inspector constrained to viewport bounds; at `max-width: 640px`, switch to a bottom sheet with 44px minimum targets and safe-area padding:

```css
@media (max-width: 640px) {
  #ann-inspector { left: 8px; right: 8px; bottom: calc(8px + env(safe-area-inset-bottom)); width: auto; max-height: 72vh; }
  #ann-inspector button { min-height: 44px; }
}
```

- [ ] **Step 6: Run tests and commit**

Run: `npm test`  
Expected: Inspector and progressive disclosure tests pass.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test/annotator-interaction.test.js
git commit -m "feat: add native annotation inspector"
```

### Task 5: Redesign “My Changes” and Completion While Preserving Export

**Files:**
- Modify: `html-editor/assets/annotator-inject.js:812-1130`
- Modify: `html-editor/test/annotator-contract.test.js`
- Modify: `html-editor/test/annotator-interaction.test.js`

- [ ] **Step 1: Write failing list and completion tests**

Create one annotation and assert:

```js
click('[data-action="list"]');
assert.equal(text('#ann-list header h2'), '我的修改');
assert.match(text('#ann-list'), /1 条/);
assert.doesNotMatch(text('#ann-list'), /选择器|HTML|片段|base64/);

click('[data-action="finish"]');
assert.equal(text('#ann-modal h2'), '修改要求已经准备好');
assert.match(text('#ann-modal'), /回到 Agent 对话，粘贴并发送/);
assert.equal(text('#ann-modal [data-action="copy"]'), '复制修改要求');
```

Capture the clipboard string and assert it still includes `页面:`, `选择器:`, `片段:`, `批注:` and embedded image delimiters when a reference image exists.

Add the visible-language regression only at this stage, immediately before the final emoji and terminology replacement:

```js
test('visible annotation chrome contains no emoji or technical labels', () => {
  const { document } = bootFixture();
  const chromeText = [
    document.querySelector('#ann-toolbar'),
    document.querySelector('#ann-inspector'),
    document.querySelector('#ann-list'),
    document.querySelector('#ann-modal')
  ].filter(Boolean).map(el => el.textContent).join(' ');
  assert.doesNotMatch(chromeText, /🎨|📎|✎|✅|✓|✕/u);
  assert.doesNotMatch(chromeText, /CSS 选择器|HTML 片段|base64|导出标注/);
});
```

- [ ] **Step 2: Verify the tests fail against the existing list/export UI**

Run: `node --test test/annotator-interaction.test.js test/annotator-contract.test.js`  
Expected: FAIL on user-facing names while the protocol assertion remains green.

- [ ] **Step 3: Implement the human-readable list**

Render each row with number, `describeElement` result or region label, annotation text, edit, and delete. Store selector, snippet, page ID, bounds, refs, and IDs exactly as before; do not render them.

- [ ] **Step 4: Implement the completion modal**

Keep `serializeAnnotations`, `buildEmbedBlock`, image compression, `copyText`, and fallback selection logic. Replace only modal copy and hierarchy:

```text
修改要求已经准备好
系统已整理好页面位置、参考图片和你的全部要求。
下一步：回到 Agent 对话，粘贴并发送
[复制修改要求]
```

Show the manual textarea only when automatic copy fails or the user selects a secondary `手动复制` action.

- [ ] **Step 5: Remove every visible emoji and technical label**

Replace check/close/attachment/color glyphs with `iconSvg`. Preserve technical words only inside serialized strings and code comments; adjust the contract test to inspect DOM-visible label constants instead of banning protocol tokens globally.

- [ ] **Step 6: Run tests and commit**

Run: `npm test`  
Expected: all Node and Python tests pass; visible-emoji scan passes; export protocol remains unchanged.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test
git commit -m "feat: simplify annotation review and completion"
```

### Task 6: Add Recovery, Accessibility, and Persistence Regression Coverage

**Files:**
- Modify: `html-editor/assets/annotator-inject.js`
- Modify: `html-editor/test/annotator-interaction.test.js`

- [ ] **Step 1: Write failing recovery and accessibility tests**

Cover:

- toolbar and Inspector buttons have accessible names;
- `Escape` exits mark mode or closes the Inspector;
- click outside closes only the Inspector, not stored annotations;
- stale selectors render `原来的位置已经变化，请重新选择`;
- empty list renders `还没有添加修改`;
- clipboard rejection reveals manual copy UI;
- old localStorage annotation shape loads unchanged;
- image storage quota failure retains annotation text.

- [ ] **Step 2: Verify each new test fails for the intended reason**

Run: `node --test test/annotator-interaction.test.js`  
Expected: failures identify missing human-readable recovery states or accessibility attributes.

- [ ] **Step 3: Implement the minimal recovery and accessibility changes**

Use `aria-label`, `aria-pressed`, `role="dialog"`, `aria-modal="false"`, focus the textarea on open, restore focus to the mark button on close, and use a polite live region for `修改已保存` and errors.

Map internal failures to these messages only:

```js
var USER_MESSAGES = {
  stale: '原来的位置已经变化，请重新选择。',
  empty: '还没有添加修改。',
  clipboard: '没有自动复制，请在下面手动复制。',
  storage: '修改已保存，但参考图需要重新添加。'
};
```

- [ ] **Step 4: Run full regression and commit**

Run: `npm test`  
Expected: all tests pass with no uncaught jsdom errors.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test/annotator-interaction.test.js
git commit -m "fix: harden annotation recovery and accessibility"
```

### Task 7: Update Skill Guidance and Validate Real HTML Upgrades

**Files:**
- Modify: `html-editor/SKILL.md`
- Create: `html-editor/CHANGELOG.md`
- Modify: `html-editor/test/fixtures/sample.html`
- Modify: `html-editor/test/fixtures/legacy-annotated.html`

- [ ] **Step 1: Update the Skill workflow terminology**

Document this user flow exactly:

```text
标记修改 → 点击或框选页面内容 → 说出要求 → 保存修改
→ 在“我的修改”中复核 → 完成标注 → 复制修改要求 → 粘贴给 Agent
```

Retain the AI-side parsing contract, `wrap_annotator.py` usage, localStorage behavior, and `--force` upgrade instructions. Remove documentation that teaches users to click emoji buttons or find “导出”.

- [ ] **Step 2: Add 1.1.0 changelog**

Record UI redesign, no-emoji icon system, language changes, accessibility, responsive Inspector, unchanged export protocol, and `--force` upgrade procedure.

- [ ] **Step 3: Generate fresh and upgraded fixtures**

Run:

```bash
python3 scripts/wrap_annotator.py test/fixtures/sample.html -o /tmp/html-editor-fresh.html
python3 scripts/wrap_annotator.py test/fixtures/legacy-annotated.html -o /tmp/html-editor-upgraded.html --force
```

Expected: both outputs contain exactly one `data-annotator="true"` script and the upgraded output contains new toolbar labels.

- [ ] **Step 4: Perform desktop and mobile visual QA**

Open each fixture at desktop and 390×844 mobile viewport. Verify:

- underlying fixture layout remains unchanged;
- toolbar does not cover critical content;
- single-element and drag-region selection work;
- Inspector stays within viewport;
- keyboard input, reference image, edit, delete, refresh persistence, completion, and manual-copy fallback work;
- no emoji or technical fields are visible.

Save screenshots under `html-editor/test/evidence/` for local review but do not include them in the Skill ZIP.

- [ ] **Step 5: Run full tests and commit**

Run: `npm test`  
Expected: all tests pass.

```bash
git add html-editor/SKILL.md html-editor/CHANGELOG.md html-editor/test/fixtures
git commit -m "docs: update html editor native overlay workflow"
```

### Task 8: Build and Verify the 1.1.0 Skill Package

**Files:**
- Create: `html-editor/scripts/build-release.mjs`
- Create: `html-editor/test/release-package.test.js`
- Create: `html-editor/dist/html-editor-1.1.0.zip` (ignored)
- Modify: `.gitignore`

- [ ] **Step 1: Write a failing release-content test**

Require exactly:

```text
html-editor/SKILL.md
html-editor/CHANGELOG.md
html-editor/assets/annotator-inject.js
html-editor/scripts/wrap_annotator.py
```

Reject `node_modules`, `test`, `package.json`, `.DS_Store`, source maps, screenshots, tokens, secrets, and temporary HTML.

- [ ] **Step 2: Verify it fails before the builder exists**

Run: `node --test test/release-package.test.js`  
Expected: FAIL because `buildRelease` is missing.

- [ ] **Step 3: Implement the deterministic ZIP builder**

`build-release.mjs` must copy the four allowed runtime/documentation files to a clean staging directory, scan the allowlist, invoke `/usr/bin/ditto -c -k --keepParent`, and write a `.sha256` file.

- [ ] **Step 4: Build and inspect a clean extraction**

Run:

```bash
npm test
node scripts/build-release.mjs
tmpdir=$(mktemp -d /tmp/html-editor-release.XXXXXX)
/usr/bin/ditto -x -k dist/html-editor-1.1.0.zip "$tmpdir"
find "$tmpdir" -type f | sort
shasum -a 256 -c dist/html-editor-1.1.0.zip.sha256
```

Expected: four allowlisted Skill files only; checksum `OK`.

- [ ] **Step 5: Run a final clean-package injection test**

From the extracted package, run `wrap_annotator.py` against a clean HTML file and verify the produced HTML opens with the new toolbar and Inspector.

- [ ] **Step 6: Commit source and release tooling**

```bash
git add .gitignore html-editor/scripts/build-release.mjs html-editor/test/release-package.test.js
git commit -m "build: package html editor skill 1.1.0"
```

The ZIP remains a local delivery artifact. Publishing or overwriting the marketplace Skill requires separate user authorization after package acceptance.

## Final Verification Gate

Run fresh:

```bash
cd html-editor
npm test
node scripts/build-release.mjs
shasum -a 256 -c dist/html-editor-1.1.0.zip.sha256
```

Then repeat one desktop and one mobile end-to-end flow from a clean extraction. Do not claim completion unless tests, clean extraction, protocol checks, and visual checks all pass.
