# HTML Canvas Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `html-editor` from an annotation overlay into a reversible HTML canvas editor for local edits, protected layout changes, safe export, and platform-neutral Agent handoff.

**Architecture:** Develop focused ES modules under `html-editor/src/`, test them directly in Node/JSDOM, and bundle them into the existing self-contained `assets/annotator-inject.js` with esbuild. Preserve the current annotation protocol as a compatibility mode while adding stable target identity, patch history, layout interpretation, docked inspector UI, persistence, export, and Agent intents.

**Tech Stack:** Vanilla JavaScript, DOM/CSS APIs, JSDOM, Node test runner, Python wrapper tests, esbuild used only at build time.

---

## 1. File structure

Create these focused modules:

- `html-editor/src/constants.mjs` — version-independent storage keys, limits, operation statuses.
- `html-editor/src/legacy-annotator.js` — module-wrapped copy of the 1.3.4 annotation runtime used only by compatibility mode.
- `html-editor/src/target-identity.mjs` — stable document/page/state/element identity.
- `html-editor/src/patch-engine.mjs` — apply/revert patches and grouped undo/redo history.
- `html-editor/src/layout-interpreter.mjs` — classify layout and decide direct/confirm/Agent handling.
- `html-editor/src/canvas-overlay.mjs` — selection rectangle, resize/move handles, guides and snap calculations.
- `html-editor/src/editor-session.mjs` — selection, direct edit commands, session coordination.
- `html-editor/src/persistence.mjs` — document-scoped local history and embedded metadata.
- `html-editor/src/exporter.mjs` — editable/clean HTML serialization, download and authorized overwrite.
- `html-editor/src/agent-intents.mjs` — schema-valid pending Agent requests.
- `html-editor/src/inspector.mjs` — docked property panel and narrow-screen bottom drawer.
- `html-editor/src/runtime.mjs` — composition root and annotation compatibility adapter.
- `html-editor/scripts/build-runtime.mjs` — bundles `src/runtime.mjs` to `assets/annotator-inject.js`.

Create matching tests:

- `html-editor/test/target-identity.test.js`
- `html-editor/test/patch-engine.test.js`
- `html-editor/test/layout-interpreter.test.js`
- `html-editor/test/canvas-overlay.test.js`
- `html-editor/test/editor-session.test.js`
- `html-editor/test/persistence.test.js`
- `html-editor/test/exporter.test.js`
- `html-editor/test/agent-intents.test.js`
- `html-editor/test/inspector-docking.test.js`
- `html-editor/test/canvas-editor-e2e.test.js`
- `html-editor/test/fixtures/canvas-editor.html`

Modify:

- `html-editor/assets/annotator-inject.js` — generated browser bundle; do not hand-edit after Task 1.
- `html-editor/package.json` and `package-lock.json` — build script, esbuild and version.
- `html-editor/scripts/build-release.mjs` — build runtime before packaging and include only runtime artifacts.
- `html-editor/scripts/wrap_annotator.py` — update user-facing naming while preserving injection behavior.
- `html-editor/test/annotator-contract.test.js` — compatibility assertions.
- `html-editor/test/annotator-interaction.test.js` — compatibility smoke tests only.
- `html-editor/test/release-package.test.js` — generated-bundle and package assertions.
- `html-editor/SKILL.md`, `README.md`, `CHANGELOG.md`, `agents/openai.yaml` — new workflow and capability boundary.

The browser bundle must have no runtime imports, network calls, external fonts, icon libraries, or UI frameworks.

## 2. Delivery slices

The plan produces working software in four independently testable slices:

1. **Foundation:** build pipeline, stable identity, patches and undo/redo.
2. **Direct editing:** layout interpretation, text/style/image edits, resize/move and docking.
3. **Safe delivery:** persistence, editable/clean export, authorized overwrite and Agent intents.
4. **Release gate:** multi-page interaction regression, documentation, package and version.

---

### Task 1: Establish a modular runtime build without changing behavior

**Files:**
- Create: `html-editor/src/legacy-annotator.js`
- Create: `html-editor/src/runtime.mjs`
- Create: `html-editor/scripts/build-runtime.mjs`
- Create: `html-editor/test/runtime-build.test.js`
- Modify: `html-editor/package.json`
- Modify: `html-editor/package-lock.json`
- Modify: `html-editor/scripts/build-release.mjs`
- Modify: `html-editor/assets/annotator-inject.js`

- [ ] **Step 1: Write the failing runtime build test**

```js
// html-editor/test/runtime-build.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');

test('builds one self-contained browser runtime', () => {
  execFileSync(process.execPath, ['scripts/build-runtime.mjs'], { cwd: root });
  const output = fs.readFileSync(path.join(root, 'assets/annotator-inject.js'), 'utf8');
  assert.match(output, /HTML_EDITOR_RUNTIME/);
  assert.doesNotMatch(output, /\bimport\s+|\bexport\s+/);
  assert.doesNotMatch(output, /(?:src|href)\s*=\s*["']https?:\/\//i);
});
```

- [ ] **Step 2: Run the test and verify the missing build script failure**

Run: `cd html-editor && node --test test/runtime-build.test.js`  
Expected: FAIL because `scripts/build-runtime.mjs` does not exist.

- [ ] **Step 3: Add esbuild and the browser entry point**

Run: `cd html-editor && npm install --save-dev esbuild@0.25.8`

```js
// html-editor/src/runtime.mjs
import { bootLegacyAnnotator } from './legacy-annotator.js';

const RUNTIME_MARKER = 'HTML_EDITOR_RUNTIME';

export function bootHtmlEditor(documentRef = document) {
  if (documentRef.documentElement.dataset.htmlEditorBooted === 'true') return;
  documentRef.documentElement.dataset.htmlEditorBooted = 'true';
  documentRef.documentElement.dataset.htmlEditorRuntime = RUNTIME_MARKER;
  bootLegacyAnnotator(documentRef);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootHtmlEditor(document));
  } else {
    bootHtmlEditor(document);
  }
}
```

Copy the existing compatibility runtime:

```bash
cp html-editor/assets/annotator-inject.js html-editor/src/legacy-annotator.js
```

Change only its outer wrapper:

```js
// Replace the opening `(function () {` with:
export function bootLegacyAnnotator(documentRef = document) {
  const document = documentRef;

// Replace the final `})();` with:
}
```

Do not alter the wrapper body. The legacy runtime remains the default in Task 1. Later tasks add the canvas editor beside it; Task 7 switches the default to canvas mode while `data-html-editor-mode="annotation"` explicitly selects compatibility mode. This preserves all existing public DOM IDs, annotation export tokens and tests without forcing the 1.3.4 file to absorb new responsibilities.

```js
// html-editor/scripts/build-runtime.mjs
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({
  entryPoints: [path.join(root, 'src/runtime.mjs')],
  outfile: path.join(root, 'assets/annotator-inject.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['safari16', 'chrome109'],
  banner: { js: '/* html-editor generated runtime; do not edit directly */' }
});
```

Add scripts:

```json
{
  "scripts": {
    "build:runtime": "node scripts/build-runtime.mjs",
    "test": "npm run build:runtime && node --test test/*.test.js && python3 -m unittest discover -s test -p 'test_*.py'"
  }
}
```

At the start of `buildRelease()` call the build script:

```js
execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-runtime.mjs')], {
  cwd: ROOT,
  stdio: 'inherit'
});
```

- [ ] **Step 4: Run compatibility and build tests**

Run: `cd html-editor && npm test`  
Expected: all existing tests and `runtime-build.test.js` PASS.

- [ ] **Step 5: Commit the modular build foundation**

```bash
git add html-editor/src/legacy-annotator.js html-editor/src/runtime.mjs html-editor/scripts/build-runtime.mjs \
  html-editor/assets/annotator-inject.js html-editor/package.json \
  html-editor/package-lock.json html-editor/scripts/build-release.mjs \
  html-editor/test/runtime-build.test.js
git commit -m "refactor(html-editor): add modular runtime build"
```

---

### Task 2: Add stable document, page, state and target identity

**Files:**
- Create: `html-editor/src/constants.mjs`
- Create: `html-editor/src/target-identity.mjs`
- Create: `html-editor/test/target-identity.test.js`
- Modify: `html-editor/src/runtime.mjs`

- [ ] **Step 1: Write failing identity tests**

```js
// html-editor/test/target-identity.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

test('keeps an existing stable target id', async () => {
  const { JSDOM } = require('jsdom');
  const { ensureTargetIdentity } = await import('../src/target-identity.mjs');
  const dom = new JSDOM('<main data-page-id="home"><button data-editor-id="cta">Go</button></main>');
  const button = dom.window.document.querySelector('button');
  assert.deepEqual(ensureTargetIdentity(button), {
    pageId: 'home',
    stateId: 'default',
    targetId: 'cta'
  });
});

test('generates and persists ids when markup has none', async () => {
  const { JSDOM } = require('jsdom');
  const { ensureTargetIdentity } = await import('../src/target-identity.mjs');
  const dom = new JSDOM('<main><button>Go</button></main>');
  const button = dom.window.document.querySelector('button');
  const first = ensureTargetIdentity(button);
  const second = ensureTargetIdentity(button);
  assert.match(first.targetId, /^he-/);
  assert.equal(second.targetId, first.targetId);
  assert.equal(button.dataset.editorId, first.targetId);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `cd html-editor && node --test test/target-identity.test.js`  
Expected: FAIL with module-not-found for `target-identity.mjs`.

- [ ] **Step 3: Implement stable identity**

```js
// html-editor/src/constants.mjs
export const HISTORY_LIMIT = 100;
export const EDITOR_META_ID = 'html-editor-metadata';
export const STORAGE_PREFIX = 'html-editor::';
export const OPERATION_STATUS = Object.freeze({
  APPLIED: 'applied',
  NEEDS_CONFIRMATION: 'needs-confirmation',
  PENDING_AGENT: 'pending-agent'
});
```

```js
// html-editor/src/target-identity.mjs
let sequence = 0;

function nextId(prefix) {
  sequence += 1;
  return `he-${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

function closestValue(element, attribute, fallback) {
  const owner = element.closest(`[${attribute}]`);
  return owner?.getAttribute(attribute) || fallback;
}

export function ensureTargetIdentity(element) {
  if (!element.dataset.editorId) element.dataset.editorId = nextId('node');
  const pageOwner = element.closest('[data-page-id]') || element.closest('main') || element.ownerDocument.body;
  if (!pageOwner.dataset.pageId) pageOwner.dataset.pageId = nextId('page');
  return {
    pageId: pageOwner.dataset.pageId,
    stateId: closestValue(element, 'data-state-id', 'default'),
    targetId: element.dataset.editorId
  };
}

export function findTarget(documentRef, identity) {
  return documentRef.querySelector(`[data-editor-id="${CSS.escape(identity.targetId)}"]`);
}
```

Wire `ensureTargetIdentity()` into the existing element-selection path before opening the inspector.

- [ ] **Step 4: Run identity and compatibility tests**

Run: `cd html-editor && node --test test/target-identity.test.js test/annotator-interaction.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit stable identity**

```bash
git add html-editor/src/constants.mjs html-editor/src/target-identity.mjs \
  html-editor/src/runtime.mjs html-editor/test/target-identity.test.js \
  html-editor/assets/annotator-inject.js
git commit -m "feat(html-editor): add stable target identity"
```

---

### Task 3: Implement reversible patches and grouped history

**Files:**
- Create: `html-editor/src/patch-engine.mjs`
- Create: `html-editor/test/patch-engine.test.js`
- Modify: `html-editor/src/runtime.mjs`

- [ ] **Step 1: Write failing patch/history tests**

```js
// html-editor/test/patch-engine.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

test('applies, undoes and redoes one style patch', async () => {
  const { createPatchEngine } = await import('../src/patch-engine.mjs');
  const dom = new JSDOM('<button data-editor-id="cta" style="color:red">Go</button>');
  const button = dom.window.document.querySelector('button');
  const engine = createPatchEngine({ document: dom.window.document });
  engine.applyGroup({
    id: 'group-1',
    patches: [{ targetId: 'cta', kind: 'style', property: 'color', before: 'red', after: 'blue' }]
  });
  assert.equal(button.style.color, 'blue');
  engine.undo();
  assert.equal(button.style.color, 'red');
  engine.redo();
  assert.equal(button.style.color, 'blue');
});

test('caps history at one hundred groups', async () => {
  const { createPatchEngine } = await import('../src/patch-engine.mjs');
  const dom = new JSDOM('<button data-editor-id="cta">Go</button>');
  const engine = createPatchEngine({ document: dom.window.document, limit: 100 });
  for (let i = 0; i < 105; i += 1) {
    engine.applyGroup({
      id: `g-${i}`,
      patches: [{ targetId: 'cta', kind: 'attribute', property: 'data-n', before: String(i - 1), after: String(i) }]
    });
  }
  assert.equal(engine.snapshot().undo.length, 100);
});
```

- [ ] **Step 2: Verify failure**

Run: `cd html-editor && node --test test/patch-engine.test.js`  
Expected: FAIL because `createPatchEngine` is missing.

- [ ] **Step 3: Implement the patch engine**

```js
// html-editor/src/patch-engine.mjs
import { HISTORY_LIMIT } from './constants.mjs';

function target(documentRef, targetId) {
  const value = String(targetId).replaceAll('"', '\\"');
  const element = documentRef.querySelector(`[data-editor-id="${value}"]`);
  if (!element) throw new Error(`TargetNotFound:${targetId}`);
  return element;
}

function writePatch(documentRef, patch, direction) {
  const value = direction === 'forward' ? patch.after : patch.before;
  if (patch.kind === 'dom-insert' || patch.kind === 'dom-remove') {
    const shouldExist = patch.kind === 'dom-insert'
      ? direction === 'forward'
      : direction === 'backward';
    const existing = documentRef.querySelector(`[data-editor-id="${patch.targetId}"]`);
    if (!shouldExist) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const template = documentRef.createElement('template');
    template.innerHTML = patch.kind === 'dom-insert' ? patch.after : patch.before;
    const node = template.content.firstElementChild;
    const parent = target(documentRef, patch.parentId);
    const next = patch.nextSiblingId
      ? documentRef.querySelector(`[data-editor-id="${patch.nextSiblingId}"]`)
      : null;
    parent.insertBefore(node, next);
    return;
  }
  const element = target(documentRef, patch.targetId);
  if (patch.kind === 'style') element.style.setProperty(patch.property, value ?? '');
  else if (patch.kind === 'text') element.textContent = value ?? '';
  else if (patch.kind === 'attribute') {
    if (value == null) element.removeAttribute(patch.property);
    else element.setAttribute(patch.property, value);
  } else {
    throw new Error(`UnsupportedPatchKind:${patch.kind}`);
  }
}

export function createPatchEngine({ document, limit = HISTORY_LIMIT, onChange = () => {} }) {
  const undo = [];
  const redo = [];
  return {
    applyGroup(group) {
      group.patches.forEach(patch => writePatch(document, patch, 'forward'));
      undo.push(group);
      if (undo.length > limit) undo.shift();
      redo.length = 0;
      onChange(this.snapshot());
    },
    recordAppliedGroup(group) {
      undo.push(group);
      if (undo.length > limit) undo.shift();
      redo.length = 0;
      onChange(this.snapshot());
    },
    undo() {
      const group = undo.pop();
      if (!group) return null;
      [...group.patches].reverse().forEach(patch => writePatch(document, patch, 'backward'));
      redo.push(group);
      onChange(this.snapshot());
      return group;
    },
    redo() {
      const group = redo.pop();
      if (!group) return null;
      group.patches.forEach(patch => writePatch(document, patch, 'forward'));
      undo.push(group);
      onChange(this.snapshot());
      return group;
    },
    restore(snapshot) {
      undo.splice(0, undo.length, ...(snapshot.undo || []).slice(-limit));
      redo.splice(0, redo.length, ...(snapshot.redo || []).slice(-limit));
      onChange(this.snapshot());
    },
    snapshot() {
      return { undo: structuredClone(undo), redo: structuredClone(redo) };
    }
  };
}
```

Replace preview-only change bookkeeping for directly supported text/style actions with patch groups. Keep annotation-only notes working through the compatibility adapter.

- [ ] **Step 4: Add keyboard wiring and run tests**

Wire `Command/Ctrl+Z` to `undo()` and `Shift+Command/Ctrl+Z` to `redo()`, ignoring key events originating in editable text fields.

Run: `cd html-editor && node --test test/patch-engine.test.js test/annotator-interaction.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit the reversible edit foundation**

```bash
git add html-editor/src/patch-engine.mjs html-editor/src/runtime.mjs \
  html-editor/test/patch-engine.test.js html-editor/assets/annotator-inject.js
git commit -m "feat(html-editor): add reversible patch history"
```

---

### Task 4: Classify layout and gate risky movement

**Files:**
- Create: `html-editor/src/layout-interpreter.mjs`
- Create: `html-editor/test/layout-interpreter.test.js`
- Modify: `html-editor/src/runtime.mjs`

- [ ] **Step 1: Write failing classification tests**

```js
// html-editor/test/layout-interpreter.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

test('treats flex reorder as direct and cross-container movement as confirmation', async () => {
  const { classifyLayout, decideMove } = await import('../src/layout-interpreter.mjs');
  const dom = new JSDOM('<div id="a" style="display:flex"><i id="x"></i><i id="y"></i></div><div id="b"></div>');
  const x = dom.window.document.querySelector('#x');
  const y = dom.window.document.querySelector('#y');
  const b = dom.window.document.querySelector('#b');
  assert.equal(classifyLayout(x, dom.window).kind, 'flex');
  assert.equal(decideMove({ element: x, destination: y, window: dom.window }).mode, 'direct');
  assert.equal(decideMove({ element: x, destination: b, window: dom.window }).mode, 'confirm');
});

test('routes unknown transformed layouts to Agent', async () => {
  const { decideMove } = await import('../src/layout-interpreter.mjs');
  const dom = new JSDOM('<div style="transform:matrix(1,0.2,0,1,0,0)"><i id="x"></i></div><main id="target"></main>');
  const result = decideMove({
    element: dom.window.document.querySelector('#x'),
    destination: dom.window.document.querySelector('#target'),
    window: dom.window
  });
  assert.equal(result.mode, 'agent');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd html-editor && node --test test/layout-interpreter.test.js`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement layout decisions**

```js
// html-editor/src/layout-interpreter.mjs
export function classifyLayout(element, windowRef = window) {
  const parent = element.parentElement;
  const own = windowRef.getComputedStyle(element);
  const parentStyle = parent ? windowRef.getComputedStyle(parent) : null;
  if (own.position === 'fixed') return { kind: 'fixed', parent };
  if (own.position === 'absolute') return { kind: 'absolute', parent };
  if (parentStyle?.display.includes('flex')) return { kind: 'flex', parent };
  if (parentStyle?.display.includes('grid')) return { kind: 'grid', parent };
  if (own.transform && own.transform !== 'none' && !/^matrix\(1,\s*0,\s*0,\s*1,/.test(own.transform)) {
    return { kind: 'complex', parent };
  }
  return { kind: 'flow', parent };
}

export function decideMove({ element, destination, window: windowRef = window, freePlacement = false }) {
  const source = classifyLayout(element, windowRef);
  if (freePlacement) return { mode: 'confirm', operation: 'free-place', source };
  if (source.kind === 'complex') return { mode: 'agent', reason: 'complex-transform', source };
  if (destination?.parentElement === element.parentElement && ['flex', 'grid', 'flow'].includes(source.kind)) {
    return { mode: 'direct', operation: 'reorder', source };
  }
  if (['absolute', 'fixed'].includes(source.kind) && destination === element.parentElement) {
    return { mode: 'direct', operation: 'position', source };
  }
  return { mode: 'confirm', operation: 'cross-container', source };
}
```

- [ ] **Step 4: Integrate the decision result and test**

The runtime must map:

- `direct` → create and apply a patch group;
- `confirm` → render preview and explicit Apply/Cancel controls;
- `agent` → create a pending Agent intent without mutating the page.

Run: `cd html-editor && node --test test/layout-interpreter.test.js test/patch-engine.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit layout protection**

```bash
git add html-editor/src/layout-interpreter.mjs html-editor/src/runtime.mjs \
  html-editor/test/layout-interpreter.test.js html-editor/assets/annotator-inject.js
git commit -m "feat(html-editor): protect layout-aware movement"
```

---

### Task 5: Build the direct-edit session for text, styles and images

**Files:**
- Create: `html-editor/src/editor-session.mjs`
- Create: `html-editor/test/editor-session.test.js`
- Modify: `html-editor/src/runtime.mjs`
- Modify: `html-editor/test/annotator-interaction.test.js`

- [ ] **Step 1: Write failing direct-edit tests**

```js
// html-editor/test/editor-session.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

test('changes only the selected element and records one group', async () => {
  const { createEditorSession } = await import('../src/editor-session.mjs');
  const dom = new JSDOM('<button data-editor-id="a">First</button><button data-editor-id="b">Second</button>');
  const session = createEditorSession(dom.window.document);
  session.select(dom.window.document.querySelector('[data-editor-id="a"]'));
  session.setText('Changed');
  assert.equal(dom.window.document.querySelector('[data-editor-id="a"]').textContent, 'Changed');
  assert.equal(dom.window.document.querySelector('[data-editor-id="b"]').textContent, 'Second');
  assert.equal(session.history().undo.length, 1);
});

test('replaces an image through a reversible src patch', async () => {
  const { createEditorSession } = await import('../src/editor-session.mjs');
  const dom = new JSDOM('<img data-editor-id="hero" src="old.png">');
  const session = createEditorSession(dom.window.document);
  session.select(dom.window.document.querySelector('img'));
  session.setAttribute('src', 'data:image/png;base64,AA==');
  session.undo();
  assert.equal(dom.window.document.querySelector('img').getAttribute('src'), 'old.png');
});

test('duplicates and deletes only the selected element', async () => {
  const { createEditorSession } = await import('../src/editor-session.mjs');
  const dom = new JSDOM('<section><button data-editor-id="a">First</button><button data-editor-id="b">Second</button></section>');
  const session = createEditorSession(dom.window.document);
  session.select(dom.window.document.querySelector('[data-editor-id="a"]'));
  const clone = session.duplicate();
  assert.equal(dom.window.document.querySelectorAll('button').length, 3);
  assert.notEqual(clone.dataset.editorId, 'a');
  session.deleteSelected();
  assert.equal(dom.window.document.querySelectorAll('button').length, 2);
  session.undo();
  assert.equal(dom.window.document.querySelectorAll('button').length, 3);
});
```

- [ ] **Step 2: Verify failure**

Run: `cd html-editor && node --test test/editor-session.test.js`  
Expected: FAIL because `editor-session.mjs` is missing.

- [ ] **Step 3: Implement direct edit commands**

```js
// html-editor/src/editor-session.mjs
import { createPatchEngine } from './patch-engine.mjs';
import { ensureTargetIdentity } from './target-identity.mjs';

export function createEditorSession(documentRef, options = {}) {
  let selected = null;
  const engine = createPatchEngine({
    document: documentRef,
    onChange: options.onHistoryChange
  });
  function apply(kind, property, after) {
    if (!selected) throw new Error('NoSelection');
    const { targetId } = ensureTargetIdentity(selected);
    const before = kind === 'style'
      ? selected.style.getPropertyValue(property)
      : kind === 'text'
        ? selected.textContent
        : selected.getAttribute(property);
    engine.applyGroup({
      id: `edit-${Date.now().toString(36)}`,
      page: ensureTargetIdentity(selected).pageId,
      state: ensureTargetIdentity(selected).stateId,
      target: targetId,
      status: 'applied',
      patches: [{ targetId, kind, property, before, after }]
    });
  }
  return {
    select(element) { selected = element; return ensureTargetIdentity(element); },
    selected() { return selected; },
    setText(value) { apply('text', 'textContent', value); },
    setStyle(property, value) { apply('style', property, value); },
    setAttribute(property, value) { apply('attribute', property, value); },
    duplicate() {
      if (!selected) throw new Error('NoSelection');
      const clone = selected.cloneNode(true);
      clone.removeAttribute('data-editor-id');
      ensureTargetIdentity(clone);
      selected.after(clone);
      engine.recordAppliedGroup({
        id: `duplicate-${Date.now().toString(36)}`,
        patches: [{
          kind: 'dom-insert',
          targetId: clone.dataset.editorId,
          parentId: ensureTargetIdentity(selected.parentElement).targetId,
          before: null,
          after: clone.outerHTML
        }]
      });
      return clone;
    },
    deleteSelected() {
      if (!selected) throw new Error('NoSelection');
      const { targetId } = ensureTargetIdentity(selected);
      const parentId = ensureTargetIdentity(selected.parentElement).targetId;
      const nextSiblingId = selected.nextElementSibling
        ? ensureTargetIdentity(selected.nextElementSibling).targetId
        : null;
      const html = selected.outerHTML;
      selected.remove();
      engine.recordAppliedGroup({
        id: `delete-${Date.now().toString(36)}`,
        patches: [{
          kind: 'dom-remove',
          targetId,
          parentId,
          nextSiblingId,
          before: html,
          after: null
        }]
      });
      selected = null;
    },
    undo: () => engine.undo(),
    redo: () => engine.redo(),
    history: () => engine.snapshot()
  };
}
```

Connect existing text, color, typography, radius, border, shadow, spacing and image controls to `createEditorSession()`. A double click on text activates an inline `contenteditable` transaction; `Enter` commits, `Escape` restores, and blur commits once.

- [ ] **Step 4: Run direct-edit and compatibility tests**

Run: `cd html-editor && node --test test/editor-session.test.js test/annotator-interaction.test.js`  
Expected: PASS, including existing color picker and spacing controls.

- [ ] **Step 5: Commit direct editing**

```bash
git add html-editor/src/editor-session.mjs html-editor/src/runtime.mjs \
  html-editor/test/editor-session.test.js html-editor/test/annotator-interaction.test.js \
  html-editor/assets/annotator-inject.js
git commit -m "feat(html-editor): apply local edits directly"
```

---

### Task 6: Add canvas handles, guides, snapping and free placement

**Files:**
- Create: `html-editor/src/canvas-overlay.mjs`
- Create: `html-editor/test/canvas-overlay.test.js`
- Modify: `html-editor/src/runtime.mjs`
- Modify: `html-editor/test/annotator-interaction.test.js`

- [ ] **Step 1: Write failing geometry tests**

```js
// html-editor/test/canvas-overlay.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

test('snaps within six pixels and supports square resizing', async () => {
  const { snapValue, resizeBox } = await import('../src/canvas-overlay.mjs');
  assert.equal(snapValue(98, [100], 6), 100);
  assert.equal(snapValue(90, [100], 6), 90);
  assert.deepEqual(
    resizeBox({ width: 160, height: 216 }, { width: 180, height: 150 }, { square: true }),
    { width: 180, height: 180 }
  );
});

test('creates a reversible free-placement patch group', async () => {
  const { freePlacementPatches } = await import('../src/canvas-overlay.mjs');
  const patches = freePlacementPatches({
    targetId: 'cover',
    before: { position: '', top: '', right: '', width: '160px', height: '216px' },
    after: { top: '24px', right: '24px', width: '160px', height: '160px' }
  });
  assert.equal(patches.length, 5);
  assert.equal(patches[0].after, 'absolute');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd html-editor && node --test test/canvas-overlay.test.js`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement pure geometry helpers and overlay contract**

```js
// html-editor/src/canvas-overlay.mjs
export function snapValue(value, candidates, threshold = 6) {
  const candidate = candidates.find(item => Math.abs(item - value) <= threshold);
  return candidate ?? value;
}

export function resizeBox(_start, proposed, options = {}) {
  const width = Math.max(options.minWidth || 24, Math.round(proposed.width));
  const height = options.square
    ? width
    : Math.max(options.minHeight || 24, Math.round(proposed.height));
  return { width, height };
}

export function freePlacementPatches({ targetId, before, after }) {
  return [
    { targetId, kind: 'style', property: 'position', before: before.position, after: 'absolute' },
    { targetId, kind: 'style', property: 'top', before: before.top, after: after.top },
    { targetId, kind: 'style', property: 'right', before: before.right, after: after.right },
    { targetId, kind: 'style', property: 'width', before: before.width, after: after.width },
    { targetId, kind: 'style', property: 'height', before: before.height, after: after.height }
  ];
}
```

Add one overlay root with:

- four corner resize handles;
- one move handle;
- four spacing handles;
- horizontal and vertical guide layers;
- size and distance labels;
- pointer capture and one grouped commit on pointer-up.

`Shift` locks the current aspect ratio. The square control uses `resizeBox(..., { square: true })`. Free placement must show a confirmation preview before applying `freePlacementPatches()`.

- [ ] **Step 4: Run geometry and interaction tests**

Run: `cd html-editor && node --test test/canvas-overlay.test.js test/annotator-interaction.test.js`  
Expected: PASS; the existing geometry tests remain green and new operations create one history group.

- [ ] **Step 5: Commit canvas manipulation**

```bash
git add html-editor/src/canvas-overlay.mjs html-editor/src/runtime.mjs \
  html-editor/test/canvas-overlay.test.js html-editor/test/annotator-interaction.test.js \
  html-editor/assets/annotator-inject.js
git commit -m "feat(html-editor): add safe canvas manipulation"
```

---

### Task 7: Replace floating panels with a docked, non-obscuring inspector

**Files:**
- Create: `html-editor/src/inspector.mjs`
- Create: `html-editor/test/inspector-docking.test.js`
- Modify: `html-editor/src/runtime.mjs`
- Modify: `html-editor/test/annotator-interaction.test.js`

- [ ] **Step 1: Write failing docking tests**

```js
// html-editor/test/inspector-docking.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

test('chooses the lane opposite the selected element', async () => {
  const { chooseDock } = await import('../src/inspector.mjs');
  assert.equal(chooseDock({
    viewportWidth: 1440,
    targetRect: { left: 1080, right: 1320 },
    panelWidth: 360
  }), 'left');
});

test('uses a bottom drawer below 760px', async () => {
  const { chooseDock } = await import('../src/inspector.mjs');
  assert.equal(chooseDock({
    viewportWidth: 640,
    targetRect: { left: 100, right: 300 },
    panelWidth: 360
  }), 'bottom');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd html-editor && node --test test/inspector-docking.test.js`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the docking policy**

```js
// html-editor/src/inspector.mjs
export function chooseDock({ viewportWidth, targetRect, panelWidth }) {
  if (viewportWidth < 760) return 'bottom';
  const leftSpace = targetRect.left;
  const rightSpace = viewportWidth - targetRect.right;
  if (rightSpace >= panelWidth + 16 && rightSpace >= leftSpace) return 'right';
  return 'left';
}

export function applyDock(documentRef, dock, panelWidth = 360) {
  documentRef.documentElement.dataset.editorDock = dock;
  documentRef.documentElement.style.setProperty('--html-editor-panel-width', `${panelWidth}px`);
}
```

Refactor UI into:

- `#html-editor-toolbar`;
- `#html-editor-page-nav`;
- `#html-editor-canvas-shell`;
- `#html-editor-inspector`;
- `#html-editor-history`.

At this task, change the composition root to make canvas mode the default:

```js
export function bootHtmlEditor(documentRef = document) {
  if (documentRef.documentElement.dataset.htmlEditorBooted === 'true') return;
  documentRef.documentElement.dataset.htmlEditorBooted = 'true';
  documentRef.documentElement.dataset.htmlEditorRuntime = RUNTIME_MARKER;
  const mode = documentRef.documentElement.dataset.htmlEditorMode || 'canvas';
  if (mode === 'annotation') {
    bootLegacyAnnotator(documentRef);
    return;
  }
  bootCanvasEditor(documentRef);
}
```

`bootCanvasEditor()` creates the five roots above and composes the selection session, overlay, inspector and history controls. The generated elements must all carry `data-html-editor-ui="true"` so clean export can remove them deterministically.

For left/right docking, apply page padding through an editor-owned wrapper or root CSS variable; never mutate prototype component styles. For bottom docking, reserve drawer height. Remove the old movable center inspector and duplicated floating actions.

- [ ] **Step 4: Run docking and old overlay regression tests**

Run: `cd html-editor && node --test test/inspector-docking.test.js test/annotator-interaction.test.js`  
Expected: PASS; update old assertions to require `left`, `right`, or `bottom` docking instead of arbitrary user placement.

- [ ] **Step 5: Commit the non-obscuring editor shell**

```bash
git add html-editor/src/inspector.mjs html-editor/src/runtime.mjs \
  html-editor/test/inspector-docking.test.js html-editor/test/annotator-interaction.test.js \
  html-editor/assets/annotator-inject.js
git commit -m "feat(html-editor): dock inspector outside canvas"
```

---

### Task 8: Persist document-scoped history and embedded editable metadata

**Files:**
- Create: `html-editor/src/persistence.mjs`
- Create: `html-editor/test/persistence.test.js`
- Modify: `html-editor/src/runtime.mjs`

- [ ] **Step 1: Write failing persistence tests**

```js
// html-editor/test/persistence.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

test('isolates history by document fingerprint', async () => {
  const { createPersistence } = await import('../src/persistence.mjs');
  const dom = new JSDOM('<title>A</title>', { url: 'https://example.test/a' });
  const store = createPersistence(dom.window);
  store.save('doc-a', { undo: [{ id: 'a' }], redo: [] });
  assert.equal(store.load('doc-b'), null);
  assert.equal(store.load('doc-a').undo[0].id, 'a');
});

test('embeds editable metadata as inert JSON', async () => {
  const { embedMetadata } = await import('../src/persistence.mjs');
  const dom = new JSDOM('<html><head></head><body></body></html>');
  embedMetadata(dom.window.document, { schemaVersion: '1.0', history: { undo: [], redo: [] } });
  const node = dom.window.document.querySelector('#html-editor-metadata');
  assert.equal(node.type, 'application/json');
  assert.equal(JSON.parse(node.textContent).schemaVersion, '1.0');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd html-editor && node --test test/persistence.test.js`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement persistence**

```js
// html-editor/src/persistence.mjs
import { EDITOR_META_ID, STORAGE_PREFIX } from './constants.mjs';

export function createPersistence(windowRef) {
  return {
    save(fingerprint, snapshot) {
      windowRef.localStorage.setItem(`${STORAGE_PREFIX}${fingerprint}`, JSON.stringify(snapshot));
    },
    load(fingerprint) {
      const raw = windowRef.localStorage.getItem(`${STORAGE_PREFIX}${fingerprint}`);
      return raw ? JSON.parse(raw) : null;
    }
  };
}

export function documentFingerprint(documentRef, locationRef) {
  const workflow = documentRef.querySelector('meta[name="prd-demo-workflow"]');
  if (workflow?.dataset.prdFingerprint) {
    return [
      workflow.dataset.prdFingerprint,
      workflow.dataset.taskId || '',
      workflow.dataset.sessionId || ''
    ].join('::');
  }
  const source = [
    locationRef.origin,
    locationRef.pathname,
    documentRef.title,
    documentRef.body?.textContent?.trim().slice(0, 2048) || ''
  ].join('\n');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `standalone-${(hash >>> 0).toString(16)}`;
}

export function embedMetadata(documentRef, metadata) {
  let node = documentRef.getElementById(EDITOR_META_ID);
  if (!node) {
    node = documentRef.createElement('script');
    node.id = EDITOR_META_ID;
    node.type = 'application/json';
    documentRef.head.appendChild(node);
  }
  node.textContent = JSON.stringify(metadata).replaceAll('<', '\\u003c');
  return node;
}
```

Call `documentFingerprint(document, location)` once before the first edit, persist after each history change, and restore on boot only when the embedded/local fingerprint exactly matches that initial value.

- [ ] **Step 4: Run persistence and session tests**

Run: `cd html-editor && node --test test/persistence.test.js test/editor-session.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit persistence**

```bash
git add html-editor/src/persistence.mjs html-editor/src/runtime.mjs \
  html-editor/test/persistence.test.js html-editor/assets/annotator-inject.js
git commit -m "feat(html-editor): persist reversible edit sessions"
```

---

### Task 9: Export editable and clean HTML with safe overwrite fallback

**Files:**
- Create: `html-editor/src/exporter.mjs`
- Create: `html-editor/test/exporter.test.js`
- Modify: `html-editor/src/runtime.mjs`

- [ ] **Step 1: Write failing exporter tests**

```js
// html-editor/test/exporter.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

test('clean export removes editor UI and keeps prototype scripts', async () => {
  const { serializeHtml } = await import('../src/exporter.mjs');
  const dom = new JSDOM('<!doctype html><html><body><main>Demo</main><aside data-html-editor-ui></aside><script id="app">window.demo=1</script></body></html>');
  const html = serializeHtml(dom.window.document, { mode: 'clean' });
  assert.doesNotMatch(html, /data-html-editor-ui/);
  assert.match(html, /id="app"/);
});

test('editable export keeps inert metadata', async () => {
  const { serializeHtml } = await import('../src/exporter.mjs');
  const dom = new JSDOM('<!doctype html><html><head><script id="html-editor-metadata" type="application/json">{}</script></head><body></body></html>');
  assert.match(serializeHtml(dom.window.document, { mode: 'editable' }), /html-editor-metadata/);
});
```

- [ ] **Step 2: Verify failure**

Run: `cd html-editor && node --test test/exporter.test.js`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement serialization and save behavior**

```js
// html-editor/src/exporter.mjs
export function serializeHtml(documentRef, { mode }) {
  const clone = documentRef.documentElement.cloneNode(true);
  clone.querySelectorAll('[data-html-editor-ui]').forEach(node => node.remove());
  clone.querySelectorAll('.html-editor-selected').forEach(node => node.classList.remove('html-editor-selected'));
  if (mode === 'clean') {
    clone.querySelector('#html-editor-metadata')?.remove();
    clone.querySelectorAll('script[data-annotator="true"],style[data-annotator="true"]').forEach(node => node.remove());
  }
  return `<!doctype html>\n${clone.outerHTML}`;
}

export async function saveHtml({ html, suggestedName, fileHandle, download }) {
  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(html);
      await writable.close();
      return { mode: 'overwrite', ok: true };
    } catch (error) {
      download(html, suggestedName);
      return { mode: 'download-fallback', ok: false, error: String(error) };
    }
  }
  download(html, suggestedName);
  return { mode: 'download', ok: true };
}
```

Before overwrite:

1. serialize the old document content;
2. download `<name>.backup.html`;
3. compare the stored original fingerprint with the current file/session fingerprint;
4. stop on mismatch;
5. call `saveHtml()`;
6. on error, download the new version instead.

Expose “导出可继续编辑版”, “导出干净交付版”, and “覆盖原文件” in one save menu. Hide overwrite when `showOpenFilePicker`/File System Access is unavailable.

- [ ] **Step 4: Run exporter and wrapper tests**

Run: `cd html-editor && node --test test/exporter.test.js && python3 -m unittest html-editor/test/test_wrap_annotator.py`  
Expected: PASS.

- [ ] **Step 5: Commit safe export**

```bash
git add html-editor/src/exporter.mjs html-editor/src/runtime.mjs \
  html-editor/test/exporter.test.js html-editor/assets/annotator-inject.js
git commit -m "feat(html-editor): export editable and clean prototypes"
```

---

### Task 10: Add platform-neutral Agent intents

**Files:**
- Create: `html-editor/src/agent-intents.mjs`
- Create: `html-editor/test/agent-intents.test.js`
- Modify: `html-editor/src/runtime.mjs`
- Modify: `html-editor/test/annotator-contract.test.js`

- [ ] **Step 1: Write failing intent tests**

```js
// html-editor/test/agent-intents.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

test('creates a pending intent without claiming it was applied', async () => {
  const { createIntentStore } = await import('../src/agent-intents.mjs');
  const store = createIntentStore();
  const intent = store.add({
    page: 'bookshelf',
    state: 'default',
    target: 'book-card-1',
    request: 'move cover to the upper-right',
    reason: 'requires component restructure',
    context: { originalLayout: 'flex-row' }
  });
  assert.equal(intent.status, 'pending-agent');
  assert.equal(intent.appliedDirectly, false);
  assert.equal(store.serialize().schemaVersion, '1.0');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd html-editor && node --test test/agent-intents.test.js`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the intent store**

```js
// html-editor/src/agent-intents.mjs
export function createIntentStore(initial = []) {
  const intents = [...initial];
  return {
    add(input) {
      const intent = {
        id: `intent-${Date.now().toString(36)}-${intents.length + 1}`,
        page: input.page,
        state: input.state || 'default',
        target: input.target,
        request: input.request,
        status: 'pending-agent',
        appliedDirectly: false,
        reason: input.reason,
        context: input.context || {},
        createdAt: new Date().toISOString()
      };
      intents.push(intent);
      return intent;
    },
    serialize() {
      return { schemaVersion: '1.0', intents: structuredClone(intents) };
    }
  };
}
```

Add a “交给 Agent” action only for `confirm` and `agent` layout outcomes. Export intent JSON inside editable metadata and as downloadable `edit-intents.json`. Preserve the existing `prd-demo-annotations` protocol for legacy annotation consumption.

- [ ] **Step 4: Run intent and contract tests**

Run: `cd html-editor && node --test test/agent-intents.test.js test/annotator-contract.test.js`  
Expected: PASS; both the new intent schema and old annotation protocol are present.

- [ ] **Step 5: Commit Agent handoff**

```bash
git add html-editor/src/agent-intents.mjs html-editor/src/runtime.mjs \
  html-editor/test/agent-intents.test.js html-editor/test/annotator-contract.test.js \
  html-editor/assets/annotator-inject.js
git commit -m "feat(html-editor): add platform-neutral edit intents"
```

---

### Task 11: Verify the multi-page interactive prototype end to end

**Files:**
- Create: `html-editor/test/fixtures/canvas-editor.html`
- Create: `html-editor/test/canvas-editor-e2e.test.js`
- Modify: `html-editor/test/workflow-regression.test.js`

- [ ] **Step 1: Create a realistic multi-page fixture**

```html
<!-- html-editor/test/fixtures/canvas-editor.html -->
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Canvas editor fixture</title></head>
<body>
  <main data-page-id="bookshelf" data-state-id="default">
    <button data-editor-id="open-detail">Open detail</button>
    <article data-editor-id="book-card" style="display:flex">
      <img data-editor-id="book-cover" src="cover.png" width="160" height="216">
      <h2 data-editor-id="book-title">置身事内</h2>
    </article>
  </main>
  <section data-page-id="detail" hidden>
    <button data-editor-id="back">Back</button>
  </section>
  <dialog data-editor-id="confirm-dialog">Confirm</dialog>
  <script>
    const shelf = document.querySelector('[data-page-id="bookshelf"]');
    const detail = document.querySelector('[data-page-id="detail"]');
    document.querySelector('[data-editor-id="open-detail"]').onclick = () => {
      shelf.hidden = true; detail.hidden = false;
    };
    document.querySelector('[data-editor-id="back"]').onclick = () => {
      detail.hidden = true; shelf.hidden = false;
    };
  </script>
</body>
</html>
```

- [ ] **Step 2: Write the end-to-end acceptance test**

```js
// html-editor/test/canvas-editor-e2e.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('edits, undoes, exports and keeps navigation working', async () => {
  const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/canvas-editor.html'), 'utf8');
  const { createEditorSession } = await import('../src/editor-session.mjs');
  const { serializeHtml } = await import('../src/exporter.mjs');
  const dom = new JSDOM(fixture, { runScripts: 'dangerously', url: 'https://example.test/demo' });
  const session = createEditorSession(dom.window.document);
  const title = dom.window.document.querySelector('[data-editor-id="book-title"]');
  session.select(title);
  session.setText('新的书名');
  session.undo();
  session.redo();
  const clean = serializeHtml(dom.window.document, { mode: 'clean' });
  const reopened = new JSDOM(clean, { runScripts: 'dangerously' });
  reopened.window.document.querySelector('[data-editor-id="open-detail"]').click();
  assert.equal(reopened.window.document.querySelector('[data-page-id="detail"]').hidden, false);
  assert.equal(reopened.window.document.querySelector('[data-editor-id="book-title"]').textContent, '新的书名');
});
```

- [ ] **Step 3: Run the end-to-end test and fix only concrete failures**

Run: `cd html-editor && node --test test/canvas-editor-e2e.test.js test/workflow-regression.test.js`  
Expected: PASS. If JSDOM reports unsupported browser-only APIs, inject deterministic fakes in the test; do not weaken assertions.

- [ ] **Step 4: Run the complete suite**

Run: `cd html-editor && npm test`  
Expected: every Node and Python test PASS with exit code 0.

- [ ] **Step 5: Commit end-to-end coverage**

```bash
git add html-editor/test/fixtures/canvas-editor.html \
  html-editor/test/canvas-editor-e2e.test.js \
  html-editor/test/workflow-regression.test.js
git commit -m "test(html-editor): cover canvas editing end to end"
```

---

### Task 12: Document, version, package and run the release gate

**Files:**
- Modify: `html-editor/package.json`
- Modify: `html-editor/package-lock.json`
- Modify: `html-editor/scripts/build-release.mjs`
- Modify: `html-editor/test/release-package.test.js`
- Modify: `html-editor/scripts/wrap_annotator.py`
- Modify: `html-editor/test/test_wrap_annotator.py`
- Modify: `html-editor/SKILL.md`
- Modify: `html-editor/README.md`
- Modify: `html-editor/CHANGELOG.md`
- Modify: `html-editor/agents/openai.yaml`
- Create: `html-editor/dist/html-editor-2.0.0.zip`
- Create: `html-editor/dist/html-editor-2.0.0.zip.sha256`

- [ ] **Step 1: Write the failing release contract**

Add these assertions to `test/release-package.test.js`:

```js
test('2.0.0 package ships the generated canvas editor runtime', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.version, '2.0.0');
  const runtime = fs.readFileSync(path.join(root, 'assets/annotator-inject.js'), 'utf8');
  for (const token of ['pending-agent', 'html-editor-metadata', 'download-fallback', 'HTML_EDITOR_RUNTIME']) {
    assert.match(runtime, new RegExp(token));
  }
});
```

Add a wrapper test asserting the CLI description says “HTML 画布编辑器” while `data-annotator="true"` remains supported for upgrade compatibility.

- [ ] **Step 2: Verify the release contract fails**

Run: `cd html-editor && node --test test/release-package.test.js && python3 -m unittest test/test_wrap_annotator.py`  
Expected: FAIL because version and documentation still describe the annotation-only product.

- [ ] **Step 3: Update product documentation and version**

Set `package.json`, lockfile and `build-release.mjs` version to `2.0.0`.

`SKILL.md` and `README.md` must state:

- common local edits are applied directly;
- risky layout changes require preview confirmation;
- business/structural changes become Agent intents;
- default save downloads a new HTML;
- overwrite requires explicit browser permission;
- clean export removes editor UI;
- the result remains a multi-page interactive HTML;
- Mira, Aime and other Agents can consume the same intent JSON.

`agents/openai.yaml` must use user-facing language and must not expose internal implementation names in the skill description.

`CHANGELOG.md` must list the behavior change and the compatibility promise for legacy annotations.

- [ ] **Step 4: Build and validate the package**

Run:

```bash
cd html-editor
npm test
node scripts/build-release.mjs
shasum -a 256 -c dist/html-editor-2.0.0.zip.sha256
```

Expected:

- all tests PASS;
- `dist/html-editor-2.0.0.zip` exists;
- checksum verification prints `OK`;
- the zip contains `SKILL.md`, `CHANGELOG.md`, `agents/openai.yaml`, `assets/annotator-inject.js`, and `scripts/wrap_annotator.py`;
- the zip contains no `src/`, `node_modules/`, test fixtures or external runtime dependencies.

- [ ] **Step 5: Perform the ten-item manual acceptance pass**

Use `test/fixtures/canvas-editor.html` plus one real `prd-demo` output and verify:

1. double-click text edit + undo/redo;
2. one-button visual edit does not alter peers;
3. square cover + upper-right free placement;
4. Flex reorder;
5. inspector avoidance;
6. page/state-bound history;
7. navigation/dialog/button behavior after export;
8. overwrite failure fallback;
9. pending Agent intent is not presented as applied;
10. exported intent JSON has no Mira/Aime-specific fields.

Record the result in `html-editor/CHANGELOG.md` under `2.0.0` as `Acceptance: 10/10` only when all ten pass. Otherwise list the failed item and do not publish.

- [ ] **Step 6: Commit the release candidate**

```bash
git add html-editor/package.json html-editor/package-lock.json \
  html-editor/scripts/build-release.mjs html-editor/test/release-package.test.js \
  html-editor/scripts/wrap_annotator.py html-editor/test/test_wrap_annotator.py \
  html-editor/SKILL.md html-editor/README.md html-editor/CHANGELOG.md \
  html-editor/agents/openai.yaml html-editor/assets/annotator-inject.js \
  html-editor/dist/html-editor-2.0.0.zip \
  html-editor/dist/html-editor-2.0.0.zip.sha256
git commit -m "release(html-editor): prepare canvas editor 2.0.0"
```

---

## 3. Final verification gate

### Spec coverage map

| Design requirement | Implementation task |
|---|---|
| Stable page/state/element binding | Task 2 |
| Direct text, image and visual edits | Task 5 |
| Duplicate, delete and local-only scope | Task 5 |
| Undo/redo and 100-step grouped history | Task 3 |
| Flex/Grid/flow/position interpretation | Task 4 |
| Drag, resize, square, guides and free placement | Task 6 |
| Non-obscuring docked inspector | Task 7 |
| Cross-session history and embedded metadata | Task 8 |
| New-file export, authorized overwrite and fallback | Task 9 |
| Editable and clean output | Task 9 |
| Platform-neutral Agent handoff | Task 10 |
| Multi-page/state interaction preservation | Task 11 |
| Compatibility, docs, packaging and real acceptance | Task 12 |

Before declaring implementation complete:

```bash
cd /Users/bytedance/Documents/prd-demo/html-editor
npm test
node scripts/build-release.mjs
shasum -a 256 -c dist/html-editor-2.0.0.zip.sha256
```

Then inspect repository scope:

```bash
cd /Users/bytedance/Documents/prd-demo
git status --short
git log --oneline --max-count=12
```

Required outcome:

- no unrelated user changes are staged or committed;
- every task has its own commit;
- the generated runtime is reproducible;
- all automated tests pass;
- the manual acceptance pass is 10/10;
- no publish to GitHub, Skill marketplace, Mira or Aime occurs without a separate explicit user instruction.
