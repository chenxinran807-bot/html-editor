# HTML Editor Precise Visual Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore precise color tools and replace vague HTML annotation shortcuts with contextual, live-preview text, appearance, image, and direct-drag spacing controls.

**Architecture:** Keep the existing zero-dependency injected Inspector in `annotator-inject.js`, extending its current DOM/CSS and annotation payload rather than creating a separate editor. Preview mutations are tracked in a per-selection draft, can be reverted before save, and are serialized as exact `changes[]` alongside the existing natural-language intent. Pointer handles live in a dedicated annotation overlay so they never become part of business-page selectors or exports.

**Tech Stack:** Vanilla JavaScript, DOM/CSS APIs, native `EyeDropper` and `<input type="color">`, inline SVG, Node test runner, JSDOM, Python `unittest`, existing release builder.

---

## File map

- Modify `html-editor/assets/annotator-inject.js`: contextual Inspector, preview draft, color tools, text/appearance/image controls, spacing handles, exact change serialization.
- Modify `html-editor/test/annotator-interaction.test.js`: expand the reusable JSDOM harness for computed styles, geometry, EyeDropper, pointer drag, and exact payload assertions.
- Modify `html-editor/test/annotator-contract.test.js`: enforce zero Emoji/external dependency rules and new structural protocol tokens.
- Modify `html-editor/test/workflow-regression.test.js`: prove previews, cancellation, overlays, and completion do not permanently mutate unrelated business DOM.
- Modify `html-editor/SKILL.md`: document the contextual control workflow and exact `changes[]` handoff.
- Modify `html-editor/CHANGELOG.md`: record restored color tools and precise visual controls.
- Modify `html-editor/package.json`: bump the skill package after all behavior passes.
- Run `html-editor/scripts/build-release.mjs`: produce the verified release archive; do not edit generated ZIP/hash files by hand.

### Task 1: Add exact-change draft and serialization contract

**Files:**
- Modify: `html-editor/test/annotator-interaction.test.js:9-81`
- Modify: `html-editor/assets/annotator-inject.js:1-220, 570-815, 980-1042`

- [ ] **Step 1: Write failing tests for a saved exact change and cancellation rollback**

Add a `getComputedStyle`-compatible fixture helper and these assertions to `annotator-interaction.test.js`:

```js
test('saves exact visual changes beside the plain-language intent', () => {
  const { document } = bootFixture();
  selectTarget(document);
  click(document, '[data-control="font-size-increase"]');
  document.querySelector('#ann-inspector textarea').value = '标题大小按当前效果';
  click(document, '#ann-inspector [data-action="save"]');
  click(document, '[data-action="finish"]');
  const item = structuredPayload(document).annotations[0];
  assert.equal(item.intent, '标题大小按当前效果');
  assert.deepEqual(item.changes, [{
    category: 'text', property: 'font-size', before: '16px', after: '17px', unit: 'px'
  }]);
});

test('cancel restores every previewed inline style', () => {
  const { document } = bootFixture();
  const target = document.querySelector('#target-title');
  target.style.fontSize = '16px';
  selectTarget(document);
  click(document, '[data-control="font-size-increase"]');
  assert.equal(target.style.fontSize, '17px');
  click(document, '#ann-inspector [data-action="cancel"]');
  assert.equal(target.style.fontSize, '16px');
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test html-editor/test/annotator-interaction.test.js`

Expected: FAIL because `[data-control="font-size-increase"]` and `changes` do not exist.

- [ ] **Step 3: Implement a per-selection preview draft**

In `annotator-inject.js`, add the following state helpers near the other selection state:

```js
function createDraft(el) {
  return { el: el, originals: {}, changes: [] };
}

function previewStyle(draft, category, property, after, unit, direction) {
  if (!Object.prototype.hasOwnProperty.call(draft.originals, property)) {
    draft.originals[property] = draft.el.style.getPropertyValue(property);
  }
  var before = getComputedStyle(draft.el).getPropertyValue(property).trim();
  draft.el.style.setProperty(property, after);
  var change = { category: category, property: property, before: before, after: after, unit: unit || null };
  if (direction) change.direction = direction;
  draft.changes = draft.changes.filter(function (item) { return item.property !== property; });
  draft.changes.push(change);
}

function rollbackDraft(draft) {
  if (!draft) return;
  Object.keys(draft.originals).forEach(function (property) {
    var value = draft.originals[property];
    if (value) draft.el.style.setProperty(property, value);
    else draft.el.style.removeProperty(property);
  });
}
```

Create a draft when opening the Inspector, call `rollbackDraft(draft)` from cancel/Escape, and pass `draft.changes.slice()` into `addElementAnnotation` on save. Extend saved annotations and `structuredAnnotations()` with:

```js
changes: Array.isArray(a.changes) ? a.changes.map(function (change) {
  return {
    category: change.category,
    property: change.property,
    before: change.before,
    after: change.after,
    unit: change.unit || null,
    direction: change.direction || null
  };
}) : []
```

- [ ] **Step 4: Add the minimal font-size stepper needed by the contract test**

Render a temporary stepper for text-like elements and wire it through `previewStyle`:

```js
var increase = controlButton('font-size-increase', '+', function () {
  var current = parseFloat(getComputedStyle(el).fontSize) || 16;
  previewStyle(draft, 'text', 'font-size', (current + 1) + 'px', 'px');
  value.textContent = Math.round(current + 1);
});
```

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test html-editor/test/annotator-interaction.test.js`

Expected: PASS.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test/annotator-interaction.test.js
git commit -m "feat(html-editor): record exact preview changes"
```

### Task 2: Replace generic actions with contextual Inspector sections

**Files:**
- Modify: `html-editor/test/annotator-interaction.test.js:83-151`
- Modify: `html-editor/assets/annotator-inject.js:228-251, 580-744`

- [ ] **Step 1: Replace the old action-list expectations with object-specific tests**

Add tests that select `#target-title`, a fixture button, and a fixture image:

```js
test('shows only text controls for a text selection', () => {
  const { document } = bootFixture();
  selectTarget(document);
  const inspector = document.querySelector('#ann-inspector');
  assert.deepEqual([...inspector.querySelectorAll('[data-section]')].map(x => x.dataset.section),
    ['text-content', 'typography', 'text-color', 'note', 'advanced']);
  assert.equal(inspector.querySelector('[data-section="image"]'), null);
  assert.doesNotMatch(inspector.textContent, /字大一点|文字更醒目|增加间距/);
});

test('shows appearance and spacing controls for a card selection', () => {
  const { document, window } = bootFixture();
  window.document.elementFromPoint = () => document.querySelector('#target-card');
  selectTarget(document);
  const names = [...document.querySelectorAll('#ann-inspector [data-section]')].map(x => x.dataset.section);
  assert.ok(names.includes('spacing'));
  assert.ok(names.includes('appearance'));
  assert.equal(names.includes('text-content'), false);
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `node --test --test-name-pattern="only text|appearance and spacing" html-editor/test/annotator-interaction.test.js`

Expected: FAIL because the Inspector still renders `ACTIONS`.

- [ ] **Step 3: Implement target classification and section builders**

Replace `ACTIONS`/`showSecondary` with explicit classification:

```js
function targetKind(el) {
  var tag = el.tagName.toLowerCase();
  if (tag === 'img' || tag === 'picture' || tag === 'video') return 'image';
  if (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button') return 'container';
  if (/^(p|span|h1|h2|h3|h4|h5|h6|label|strong|em)$/.test(tag)) return 'text';
  return el.children.length ? 'container' : 'text';
}

function section(name, title) {
  var node = document.createElement('section');
  node.className = 'annotator-section';
  node.dataset.section = name;
  var heading = document.createElement('h3');
  heading.textContent = title;
  node.appendChild(heading);
  return node;
}
```

Render the confirmed section map exactly:

```js
var SECTION_MAP = {
  text: ['text-content', 'typography', 'text-color', 'note', 'advanced'],
  container: ['spacing', 'appearance', 'note', 'advanced'],
  image: ['image', 'appearance', 'note', 'advanced']
};
```

Keep reference-image attachment inside `note`/`image`; remove all vague quick-action labels.

- [ ] **Step 4: Add macOS Inspector section styling**

Add CSS for `.annotator-section`, headings, segmented controls, rows, disclosure, and a scrollable body. Preserve the existing 336px width, system font stack, 32px minimum controls, and the 640px mobile rules.

- [ ] **Step 5: Run tests and commit**

Run: `node --test html-editor/test/annotator-interaction.test.js html-editor/test/annotator-contract.test.js`

Expected: PASS.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test/annotator-interaction.test.js
git commit -m "feat(html-editor): render contextual inspector sections"
```

### Task 3: Restore page colors, system color picker, and EyeDropper

**Files:**
- Modify: `html-editor/test/annotator-interaction.test.js:9-48`
- Modify: `html-editor/assets/annotator-inject.js:228-251, 745-777`

- [ ] **Step 1: Add EyeDropper and page-palette tests**

Extend `bootFixture` with an optional native picker stub:

```js
if (options.eyeDropper !== false) {
  window.EyeDropper = class {
    open() { return Promise.resolve({ sRGBHex: '#12ab34' }); }
  };
}
```

Add tests:

```js
test('offers page colors, native custom color, and screen picking', async () => {
  const { document, window } = bootFixture();
  selectTarget(document);
  assert.ok(document.querySelectorAll('[data-page-color]').length > 0);
  assert.equal(document.querySelector('[data-control="custom-color"]').type, 'color');
  click(document, '[data-control="eyedropper"]');
  await new Promise(resolve => window.setTimeout(resolve, 0));
  assert.equal(document.querySelector('#target-title').style.color, 'rgb(18, 171, 52)');
});

test('hides screen picking when EyeDropper is unavailable', () => {
  const { document } = bootFixture({ eyeDropper: false });
  selectTarget(document);
  assert.equal(document.querySelector('[data-control="eyedropper"]'), null);
  assert.ok(document.querySelector('[data-control="custom-color"]'));
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test --test-name-pattern="page colors|screen picking" html-editor/test/annotator-interaction.test.js`

Expected: FAIL because the retained `pageThemeColors()` helper has no UI caller.

- [ ] **Step 3: Implement a reusable color section**

Build `renderColorControl(sectionNode, el, draft, property, label)` that:

- normalizes `pageThemeColors()` output with `rgbToHex`;
- renders up to ten `[data-page-color]` buttons with accessible labels;
- renders `<input type="color" data-control="custom-color">`;
- conditionally renders `[data-control="eyedropper"]` only when `window.EyeDropper` exists;
- calls `previewStyle(draft, 'appearance' or 'text', property, chosenHex, null)`;
- marks the active swatch with `aria-pressed="true"`.

Use this function for `color`, `background-color`, and `border-color` according to the target section.

- [ ] **Step 4: Run focused and full JS tests, then commit**

Run: `node --test html-editor/test/annotator-interaction.test.js`

Expected: PASS.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test/annotator-interaction.test.js
git commit -m "fix(html-editor): restore precise color controls"
```

### Task 4: Complete text, appearance, and image controls

**Files:**
- Modify: `html-editor/test/annotator-interaction.test.js`
- Modify: `html-editor/assets/annotator-inject.js:580-777`

- [ ] **Step 1: Add failing interaction tests for each confirmed control family**

Add one test per family:

```js
test('previews exact typography choices', () => {
  const { document } = bootFixture();
  selectTarget(document);
  document.querySelector('[data-control="text-content"]').value = '新的标题';
  document.querySelector('[data-control="text-content"]').dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
  click(document, '[data-value="font-weight:600"]');
  click(document, '[data-value="line-height:compact"]');
  click(document, '[data-value="text-align:center"]');
  const target = document.querySelector('#target-title');
  assert.equal(target.textContent, '新的标题');
  assert.equal(target.style.fontWeight, '600');
  assert.equal(target.style.textAlign, 'center');
});

test('previews exact appearance presets without overwriting an unmatched current value', () => {
  const { document, window } = bootFixture();
  const card = document.querySelector('#target-card');
  card.style.borderRadius = '7px';
  window.document.elementFromPoint = () => card;
  selectTarget(document);
  assert.ok(document.querySelector('[data-value="border-radius:current"][aria-pressed="true"]'));
  click(document, '[data-value="border-radius:large"]');
  click(document, '[data-value="shadow:light"]');
  assert.equal(card.style.borderRadius, '16px');
  assert.notEqual(card.style.boxShadow, '');
});
```

Add an image test that asserts `object-fit: contain|cover`, file/reference attachment retention, and border-radius preview.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test --test-name-pattern="typography|appearance presets|image controls" html-editor/test/annotator-interaction.test.js`

Expected: FAIL because the controls do not exist.

- [ ] **Step 3: Implement the exact control mappings**

Use fixed mappings that produce deterministic CSS:

```js
var CONTROL_VALUES = {
  fontWeight: { regular: '400', medium: '500', bold: '700' },
  radius: { square: '0px', small: '8px', large: '16px', pill: '999px' },
  border: { none: '0px', thin: '1px', thick: '2px' },
  shadow: {
    none: 'none',
    light: '0 2px 8px rgba(0,0,0,.12)',
    clear: '0 8px 24px rgba(0,0,0,.20)'
  },
  objectFit: { contain: 'contain', cover: 'cover' }
};
```

For line-height, compute exact output relative to the selected element’s current font size:

```js
function lineHeightValue(el, preset) {
  var size = parseFloat(getComputedStyle(el).fontSize) || 16;
  var ratio = preset === 'compact' ? 1.2 : preset === 'wide' ? 1.8 : 1.5;
  return Math.round(size * ratio * 10) / 10 + 'px';
}
```

Text editing must store `{ category:'text', property:'text-content', before, after, unit:null }`. Image replacement remains a reference attachment unless the existing workflow already supplies a safe local data URL; do not invent remote upload behavior.

- [ ] **Step 4: Run tests and commit**

Run: `node --test html-editor/test/annotator-interaction.test.js`

Expected: PASS.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test/annotator-interaction.test.js
git commit -m "feat(html-editor): add precise contextual controls"
```

### Task 5: Add direct-drag external spacing and internal padding

**Files:**
- Modify: `html-editor/test/annotator-interaction.test.js`
- Modify: `html-editor/test/workflow-regression.test.js`
- Modify: `html-editor/assets/annotator-inject.js:228-298, 360-445, 570-815, 1350-1384`

- [ ] **Step 1: Add deterministic geometry and drag helpers to the test harness**

Define element rectangles with `getBoundingClientRect` and add:

```js
function drag(document, selector, from, to) {
  const handle = document.querySelector(selector);
  assert.ok(handle, `missing handle: ${selector}`);
  handle.dispatchEvent(new document.defaultView.MouseEvent('pointerdown', { bubbles: true, clientX: from.x, clientY: from.y, button: 0 }));
  document.dispatchEvent(new document.defaultView.MouseEvent('pointermove', { bubbles: true, clientX: to.x, clientY: to.y, button: 0 }));
  document.dispatchEvent(new document.defaultView.MouseEvent('pointerup', { bubbles: true, clientX: to.x, clientY: to.y, button: 0 }));
}
```

- [ ] **Step 2: Write failing tests for external and internal drag modes**

```js
test('drags the selected edge to change external spacing with a live guide', () => {
  const { document, window } = bootFixture();
  const card = document.querySelector('#target-card');
  window.document.elementFromPoint = () => card;
  selectTarget(document);
  click(document, '[data-spacing-mode="external"]');
  drag(document, '[data-spacing-handle="right"]', { x: 200, y: 120 }, { x: 212, y: 120 });
  assert.equal(card.style.marginRight, '12px');
  assert.match(document.querySelector('[data-spacing-readout]').textContent, /12/);
});

test('drags the selected edge to change internal spacing', () => {
  const { document, window } = bootFixture();
  const card = document.querySelector('#target-card');
  window.document.elementFromPoint = () => card;
  selectTarget(document);
  click(document, '[data-spacing-mode="internal"]');
  drag(document, '[data-spacing-handle="left"]', { x: 100, y: 120 }, { x: 108, y: 120 });
  assert.equal(card.style.paddingLeft, '8px');
});
```

Add cancellation tests for `Escape` during drag and a regression assertion that `.annotator-spacing-overlay` carries `data-annotator="true"` and is absent from snippets/selectors.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `node --test --test-name-pattern="spacing|drag" html-editor/test/annotator-interaction.test.js html-editor/test/workflow-regression.test.js`

Expected: FAIL because no spacing overlay exists.

- [ ] **Step 4: Implement spacing overlay and mode switching**

Create one fixed overlay containing four hit-area handles and one readout:

```js
function spacingProperty(mode, direction) {
  var suffix = direction.charAt(0).toUpperCase() + direction.slice(1);
  return mode === 'internal' ? 'padding' + suffix : 'margin' + suffix;
}
```

On pointerdown, store start coordinate and computed starting value. On pointermove, calculate the signed delta for the active edge, clamp the result to `0..160`, call `previewStyle` with category `internal-spacing` or `external-spacing`, and reposition the overlay. On pointerup, retain the preview in the draft; on `Esc`, restore the active property to its drag-start value. Destroy the overlay whenever selection/Inspector closes.

When external-neighbor detection cannot find an overlapping sibling in the drag axis, disable external mode with the human message “附近没有可作为参照的内容，可改用内部留白”，without guessing a sibling.

- [ ] **Step 5: Run tests and commit**

Run: `node --test html-editor/test/annotator-interaction.test.js html-editor/test/workflow-regression.test.js`

Expected: PASS.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test/annotator-interaction.test.js html-editor/test/workflow-regression.test.js
git commit -m "feat(html-editor): add direct visual spacing controls"
```

### Task 6: Harden accessibility, advanced disclosure, and protocol compatibility

**Files:**
- Modify: `html-editor/test/annotator-contract.test.js`
- Modify: `html-editor/test/annotator-interaction.test.js`
- Modify: `html-editor/test/workflow-regression.test.js`
- Modify: `html-editor/assets/annotator-inject.js`

- [ ] **Step 1: Add failing contract tests**

Add assertions that:

```js
test('ships no emoji, external UI dependencies, or visible CSS jargon', () => {
  assert.doesNotMatch(source, /🎨|📎|✎|✅|✓|✕/u);
  assert.doesNotMatch(source, /https?:\/\//);
  assert.match(source, /高级信息/);
  assert.match(source, /和旁边元素的距离/);
  assert.match(source, /内部留白/);
});
```

In interaction tests, collect `#ann-inspector` text and assert it does not contain `margin` or `padding`; also verify every icon-only control has `aria-label`, segmented options expose `aria-pressed`, color buttons have accessible names, `Advanced` is collapsed initially, and keyboard Escape restores the preview.

- [ ] **Step 2: Run contract tests and verify failure**

Run: `node --test html-editor/test/annotator-contract.test.js html-editor/test/annotator-interaction.test.js html-editor/test/workflow-regression.test.js`

Expected: FAIL on missing disclosure/accessibility details or exposed labels.

- [ ] **Step 3: Implement disclosure and accessibility fixes**

Use a native `<details data-section="advanced"><summary>高级信息</summary>…</details>` containing selector, exact computed values, and color hex. Ensure technical property names exist only in attributes/payload/code, never visible primary labels. Add focus rings with `:focus-visible`, 32px desktop controls, 44px narrow-window controls, and keyboard-operable handles (`Arrow` ±1, `Shift+Arrow` ±8).

- [ ] **Step 4: Confirm legacy annotations remain readable**

Load saved annotations without `changes`; assert `structuredAnnotations()` exports `changes: []`, the list renders the original note, and stale-selector recovery remains unchanged.

- [ ] **Step 5: Run the full current test suite and commit**

Run: `cd html-editor && npm test`

Expected: all Node and Python tests PASS.

```bash
git add html-editor/assets/annotator-inject.js html-editor/test
git commit -m "test(html-editor): harden precise controls and compatibility"
```

### Task 7: Document, package, and manually verify the release

**Files:**
- Modify: `html-editor/SKILL.md:45-90`
- Modify: `html-editor/CHANGELOG.md:1`
- Modify: `html-editor/package.json:3`
- Generated: `html-editor/dist/html-editor-1.3.0.zip`
- Generated: `html-editor/dist/html-editor-1.3.0.zip.sha256`

- [ ] **Step 1: Update the Skill consumption instructions**

Document the user flow in `SKILL.md`:

```markdown
选中页面内容后，面板只展示与它相关的设置。颜色可从页面色卡、屏幕吸色或系统取色器选择；文字和外观修改会在页面实时预览；间距通过元素边缘直接拖拽调整。主界面使用“和旁边元素的距离 / 内部留白”，精确 CSS 值仅在“高级信息”和结构化交接中出现。
```

Document that consumers prefer `annotations[].changes[]` exact values and use `intent` only for requirements not represented by a control. Existing payloads without `changes` remain valid.

- [ ] **Step 2: Update version and changelog**

Bump `html-editor/package.json` from `1.2.0` to `1.3.0` and add a changelog entry listing:

- restored page palette, native color input, and EyeDropper;
- contextual text/container/image controls;
- direct external/internal spacing drag;
- exact `changes[]` payload with backward compatibility;
- no external dependencies.

- [ ] **Step 3: Run all verification commands**

Run:

```bash
cd html-editor
npm test
node scripts/build-release.mjs
shasum -a 256 -c dist/html-editor-1.3.0.zip.sha256
```

Expected: all tests PASS, build exits 0, SHA-256 verification reports `OK`.

- [ ] **Step 4: Perform the manual visual acceptance pass**

Inject the built annotator into `test/fixtures/sample.html` and verify at desktop and narrow width:

1. select text and edit content/size/weight/line-height/alignment/color;
2. use a page swatch, EyeDropper, and system color picker;
3. select a card and drag external distance, then internal padding;
4. cancel once and verify complete rollback;
5. save once and inspect exact `changes[]`;
6. attach/remove a reference image;
7. complete annotation and verify the Agent handoff still copies both human summary and fenced JSON;
8. confirm no Emoji, horizontal overflow, blocked controls, or business-page mutation outside the selected target.

- [ ] **Step 5: Commit the release artifacts and documentation**

```bash
git add html-editor/SKILL.md html-editor/CHANGELOG.md html-editor/package.json html-editor/dist
git commit -m "release(html-editor): ship precise visual controls"
```

## Self-review record

- Spec coverage: contextual sections (Task 2), colors (Task 3), text/appearance/image (Task 4), direct spacing and plain-language modes (Task 5), accessibility/advanced/error/legacy states (Task 6), documentation/release/visual verification (Task 7).
- Data consistency: all exact changes use `{ category, property, before, after, unit, direction? }`; legacy items normalize to `changes: []`.
- Scope: no independent editor, full CSS editor, multi-element inference, external framework, font, icon library, or network service is introduced.
- Placeholder scan: no deferred implementation steps; the release version is fixed at `1.3.0`.
