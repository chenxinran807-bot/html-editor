# Douyin Mall Outfit Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first, high-fidelity interactive prototype for a Douyin Mall outfit Tab with a two-column feed, outfit detail, item selection, replacement, and purchase feedback.

**Architecture:** Use a zero-dependency static prototype. Keep deterministic catalog data and state transitions in a small ES module, render views and bind interactions in a separate UI module, and keep all registered visual values in CSS custom properties derived from the ecommerce design language.

**Tech Stack:** HTML5, CSS3, browser ES modules, Node.js built-in test runner.

---

## File Structure

- `work/douyin-outfit-tab/index.html`: semantic shell, mobile viewport, view containers, dialogs, and module entrypoint.
- `work/douyin-outfit-tab/tokens.css`: only approved color, type, spacing, line-height, and radius values used by the prototype.
- `work/douyin-outfit-tab/styles.css`: responsive layout and component styling using `tokens.css` variables.
- `work/douyin-outfit-tab/catalog.mjs`: neutral demonstration outfits, items, and replacement candidates.
- `work/douyin-outfit-tab/state.mjs`: pure state creation, filtering, selection, replacement, totals, and action-label logic.
- `work/douyin-outfit-tab/app.mjs`: DOM rendering, event delegation, navigation, scroll restoration, replacement sheet, and toast feedback.
- `qa/outfit-tab-state.test.mjs`: unit tests for state transitions and totals.
- `qa/outfit-tab-static.test.mjs`: static contract tests for structure, accessibility hooks, and token-only styling.
- `work/douyin-outfit-tab/README.md`: run instructions, interaction coverage, design-language sources, and known prototype boundaries.

### Task 1: Create State Contract and Tests

**Files:**
- Create: `work/douyin-outfit-tab/catalog.mjs`
- Create: `work/douyin-outfit-tab/state.mjs`
- Create: `qa/outfit-tab-state.test.mjs`

- [ ] **Step 1: Write failing state tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { outfits } from '../work/douyin-outfit-tab/catalog.mjs';
import {
  createState,
  filterOutfits,
  openOutfit,
  toggleItem,
  replaceItem,
  summarizeSelection,
} from '../work/douyin-outfit-tab/state.mjs';

test('filters the feed by scene', () => {
  assert.ok(filterOutfits(outfits, '通勤').every((outfit) => outfit.scenes.includes('通勤')));
});

test('opens an outfit with every available item selected', () => {
  const state = openOutfit(createState(), outfits[0].id, outfits);
  const available = outfits[0].items.filter((item) => item.status === 'available');
  assert.deepEqual(state.selectedItemIds.sort(), available.map((item) => item.id).sort());
});

test('updates total and purchase label after deselection', () => {
  let state = openOutfit(createState(), outfits[0].id, outfits);
  state = toggleItem(state, state.selectedItemIds[0], outfits);
  const summary = summarizeSelection(state, outfits);
  assert.equal(summary.count, state.selectedItemIds.length);
  assert.equal(summary.actionLabel, '购买已选');
});

test('replaces the selected item without losing selection', () => {
  let state = openOutfit(createState(), outfits[0].id, outfits);
  const oldId = state.selectedItemIds[0];
  state = replaceItem(state, oldId, 'replacement-top-1');
  assert.ok(!state.selectedItemIds.includes(oldId));
  assert.ok(state.selectedItemIds.includes('replacement-top-1'));
});

test('does not select sold-out items', () => {
  let state = openOutfit(createState(), outfits[0].id, outfits);
  const soldOut = outfits[0].items.find((item) => item.status === 'sold-out');
  state = toggleItem(state, soldOut.id, outfits);
  assert.ok(!state.selectedItemIds.includes(soldOut.id));
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `node --test qa/outfit-tab-state.test.mjs`

Expected: FAIL because `catalog.mjs` and `state.mjs` do not exist.

- [ ] **Step 3: Add neutral catalog fixtures**

Create two-column feed data with at least six outfits across `推荐`, `通勤`, `约会`, and `显高`. Each outfit must contain `id`, `title`, `scenes`, `image`, and three or four items. Each item must contain `id`, `title`, `spec`, integer `priceFen`, `image`, `status`, and replacement candidates. Use clearly labeled demonstration prices and neutral titles; do not add discounts, sales, reviews, or unsupported marketing claims.

```js
export const scenes = ['推荐', '通勤', '约会', '显高'];

export const outfits = [
  {
    id: 'look-commute-1',
    title: '简约层次通勤搭配',
    scenes: ['推荐', '通勤', '显高'],
    image: './assets/look-commute-1.svg',
    items: [
      { id: 'top-1', title: '基础剪裁上装', spec: '演示规格', priceFen: 19900, image: './assets/item-top.svg', status: 'available', replacements: ['replacement-top-1'] },
      { id: 'bottom-1', title: '直筒下装', spec: '演示规格', priceFen: 23900, image: './assets/item-bottom.svg', status: 'available', replacements: [] },
      { id: 'bag-1', title: '简约通勤包', spec: '演示规格', priceFen: 15900, image: './assets/item-bag.svg', status: 'sold-out', replacements: [] },
    ],
  },
];

export const replacementItems = {
  'replacement-top-1': { id: 'replacement-top-1', title: '轻薄替换上装', spec: '演示规格', priceFen: 21900, image: './assets/item-top-alt.svg', status: 'available', replacements: [] },
};
```

- [ ] **Step 4: Implement pure state transitions**

```js
import { replacementItems } from './catalog.mjs';

export const createState = () => ({ scene: '推荐', view: 'feed', activeOutfitId: null, selectedItemIds: [], replacements: {}, scrollByScene: {} });
export const filterOutfits = (items, scene) => items.filter((item) => item.scenes.includes(scene));
export const openOutfit = (state, outfitId, items) => {
  const outfit = items.find((entry) => entry.id === outfitId);
  return { ...state, view: 'detail', activeOutfitId: outfitId, selectedItemIds: outfit.items.filter((item) => item.status === 'available').map((item) => item.id) };
};
export const toggleItem = (state, itemId, items) => {
  const outfit = items.find((entry) => entry.id === state.activeOutfitId);
  const source = replacementItems[itemId] || outfit.items.find((item) => item.id === itemId);
  if (!source || source.status !== 'available') return state;
  const selected = new Set(state.selectedItemIds);
  selected.has(itemId) ? selected.delete(itemId) : selected.add(itemId);
  return { ...state, selectedItemIds: [...selected] };
};
export const replaceItem = (state, oldId, newId) => ({ ...state, selectedItemIds: state.selectedItemIds.map((id) => id === oldId ? newId : id), replacements: { ...state.replacements, [oldId]: newId } });
export const summarizeSelection = (state, items) => {
  const outfit = items.find((entry) => entry.id === state.activeOutfitId);
  const itemMap = new Map([...outfit.items, ...Object.values(replacementItems)].map((item) => [item.id, item]));
  const selected = state.selectedItemIds.map((id) => itemMap.get(id)).filter(Boolean);
  const availableCount = outfit.items.filter((item) => item.status === 'available').length;
  return { count: selected.length, totalFen: selected.reduce((sum, item) => sum + item.priceFen, 0), actionLabel: selected.length === availableCount ? '购买整套' : '购买已选' };
};
```

Every test passes `outfits` explicitly; no function depends on browser globals.

- [ ] **Step 5: Run tests and commit**

Run: `node --test qa/outfit-tab-state.test.mjs`

Expected: 5 tests PASS.

Commit: `git add work/douyin-outfit-tab/catalog.mjs work/douyin-outfit-tab/state.mjs qa/outfit-tab-state.test.mjs && git commit -m "feat: add outfit prototype state model"`

### Task 2: Define Token-Only Visual Foundation

**Files:**
- Create: `work/douyin-outfit-tab/tokens.css`
- Create: `work/douyin-outfit-tab/styles.css`
- Create: `qa/outfit-tab-static.test.mjs`

- [ ] **Step 1: Write the failing static contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('prototype CSS uses registered visual values', () => {
  const tokens = fs.readFileSync('work/douyin-outfit-tab/tokens.css', 'utf8');
  assert.match(tokens, /--color-text-primary:\s*#161823/);
  assert.match(tokens, /--color-brand:\s*#FF003C/);
  assert.match(tokens, /--gap-m:\s*8px/);
  assert.match(tokens, /--radius-sm:\s*8px/);
  assert.doesNotMatch(tokens, /13px\s*;\s*\/\*\s*radius/i);
});

test('main CSS references token variables for color, spacing, type and radius', () => {
  const css = fs.readFileSync('work/douyin-outfit-tab/styles.css', 'utf8');
  assert.match(css, /var\(--color-text-primary\)/);
  assert.match(css, /var\(--gap-m\)/);
  assert.match(css, /var\(--radius-sm\)/);
});
```

- [ ] **Step 2: Run the static test and verify failure**

Run: `node --test qa/outfit-tab-static.test.mjs`

Expected: FAIL because the CSS files do not exist.

- [ ] **Step 3: Create approved token aliases**

Define only values present in `common/md/token/设计 Token.md`: semantic colors `#161823`, `#5C5D65`, `#8A8B91`, `#B9BABD`, `#E1E4E8`, `#F5F6F9`, `#F8F8F8`, `#FFFFFF`, `#FFF2F4`, `#FF003C`; gaps `0, 2, 4, 8, 12, 16, 20, 24, 32px`; radii `4, 8, 12, 16, 20px`; registered font sizes and line heights. Use descriptive custom property names tied to source tokens.

- [ ] **Step 4: Create layout primitives**

Implement mobile shell, sticky header, horizontal scene tabs, two-column masonry using CSS columns, outfit cards, detail hero, item rows, sticky checkout bar, bottom sheet, toast, skeleton, empty state, and reduced-motion handling. Every color, gap, font size, line height, and radius declaration must reference a token variable; fixed structural dimensions such as viewport width, 3:4 aspect ratio, and touch target size may use layout constants documented in comments.

- [ ] **Step 5: Run tests and commit**

Run: `node --test qa/outfit-tab-static.test.mjs`

Expected: 2 tests PASS.

Commit: `git add work/douyin-outfit-tab/tokens.css work/douyin-outfit-tab/styles.css qa/outfit-tab-static.test.mjs && git commit -m "feat: add outfit prototype visual foundation"`

### Task 3: Build Semantic Views and Rendering

**Files:**
- Create: `work/douyin-outfit-tab/index.html`
- Create: `work/douyin-outfit-tab/app.mjs`
- Modify: `qa/outfit-tab-static.test.mjs`

- [ ] **Step 1: Add failing semantic structure tests**

```js
test('HTML exposes feed, detail, sheet and feedback regions', () => {
  const html = fs.readFileSync('work/douyin-outfit-tab/index.html', 'utf8');
  for (const marker of ['data-view="feed"', 'data-view="detail"', 'data-replacement-sheet', 'aria-live="polite"']) assert.match(html, new RegExp(marker));
  assert.match(html, /<script type="module" src="\.\/app\.mjs"><\/script>/);
});
```

- [ ] **Step 2: Run the static test and verify failure**

Run: `node --test qa/outfit-tab-static.test.mjs`

Expected: FAIL because `index.html` does not exist.

- [ ] **Step 3: Create the semantic HTML shell**

Include a `390px` mobile preview shell that remains fluid down to `320px`, feed and detail `<main>` regions, a native `<dialog>` replacement sheet, toast `aria-live`, and `<template>` elements for outfit cards and item rows. Use buttons for all actions and provide visible focus styles through CSS.

- [ ] **Step 4: Implement rendering and navigation**

In `app.mjs`, import catalog and state functions; render scene tabs and filtered cards; save `window.scrollY` per scene before navigation; open detail with default available selections; render selected, sold-out, and replaced rows; update count, total, and dynamic purchase label; restore the feed scroll position using `requestAnimationFrame` after rendering.

- [ ] **Step 5: Run tests and commit**

Run: `node --test qa/outfit-tab-state.test.mjs qa/outfit-tab-static.test.mjs`

Expected: all tests PASS.

Commit: `git add work/douyin-outfit-tab/index.html work/douyin-outfit-tab/app.mjs qa/outfit-tab-static.test.mjs && git commit -m "feat: render outfit feed and detail"`

### Task 4: Add Replacement and Checkout Feedback

**Files:**
- Modify: `work/douyin-outfit-tab/app.mjs`
- Modify: `work/douyin-outfit-tab/index.html`
- Modify: `qa/outfit-tab-static.test.mjs`

- [ ] **Step 1: Add failing interaction contract tests**

```js
test('application binds selection, replacement and checkout actions', () => {
  const app = fs.readFileSync('work/douyin-outfit-tab/app.mjs', 'utf8');
  for (const action of ['toggle-item', 'open-replacements', 'choose-replacement', 'add-to-cart', 'buy-selection']) assert.match(app, new RegExp(action));
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test qa/outfit-tab-static.test.mjs`

Expected: FAIL until every action is implemented.

- [ ] **Step 3: Implement replacement sheet states**

Open the sheet from an available item, render neutral replacement candidates, support candidate selection, and provide deterministic demo controls for success, empty, and failure states. On failure, retain the original item and show a retry button. Close the dialog on explicit close, successful replacement, or Escape.

- [ ] **Step 4: Implement checkout feedback**

Disable checkout actions at zero selections. For non-zero selections, show a short `aria-live` toast for add-to-cart and purchase actions; do not navigate to a payment page. Ensure the label is `购买整套` when all available items are selected and `购买已选` otherwise.

- [ ] **Step 5: Run tests and commit**

Run: `node --test qa/outfit-tab-state.test.mjs qa/outfit-tab-static.test.mjs`

Expected: all tests PASS.

Commit: `git add work/douyin-outfit-tab/app.mjs work/douyin-outfit-tab/index.html qa/outfit-tab-static.test.mjs && git commit -m "feat: add outfit replacement and checkout feedback"`

### Task 5: Add Local Visual Assets and Edge States

**Files:**
- Create: `work/douyin-outfit-tab/assets/*.svg`
- Modify: `work/douyin-outfit-tab/catalog.mjs`
- Modify: `work/douyin-outfit-tab/app.mjs`
- Modify: `work/douyin-outfit-tab/styles.css`

- [ ] **Step 1: Create neutral local SVG placeholders**

Create abstract editorial fashion compositions using only registered manifest colors. Each file must be local, contain an accessible `<title>`, and avoid brand logos or claims. Provide at least six 3:4 outfit images and six square item images so no network is required.

- [ ] **Step 2: Add deterministic state switches**

Expose a small prototype-only state menu that can display loading, empty feed, broken image, partial sold-out, all unavailable, replacement empty, and replacement failure. Keep it outside the customer-facing default path and label it `原型状态`.

- [ ] **Step 3: Verify responsive and state behavior manually**

Open `work/douyin-outfit-tab/index.html` at 390px and 320px widths. Verify no horizontal overflow; card titles do not cover prices; image failures preserve aspect ratio; sold-out items cannot be selected; zero selection disables actions; replacement failure preserves the old item.

- [ ] **Step 4: Commit**

Commit: `git add work/douyin-outfit-tab/assets work/douyin-outfit-tab/catalog.mjs work/douyin-outfit-tab/app.mjs work/douyin-outfit-tab/styles.css && git commit -m "feat: add outfit assets and edge states"`

### Task 6: Verify, Document, and Hand Off

**Files:**
- Create: `work/douyin-outfit-tab/README.md`
- Modify: `qa/outfit-tab-static.test.mjs`

- [ ] **Step 1: Add final source and token assertions**

Extend the static test to enumerate new CSS color, radius, gap, font-size, and line-height declarations and compare them with the approved sets documented in `tokens.css`. Fail on direct raw values in `styles.css` for these categories.

- [ ] **Step 2: Run all automated checks**

Run: `node --test qa/outfit-tab-state.test.mjs qa/outfit-tab-static.test.mjs`

Expected: all tests PASS with zero failures.

- [ ] **Step 3: Run browser interaction QA**

Exercise this sequence: switch to 通勤 → open a card → deselect one item → verify `购买已选` and new total → replace one item → add to cart → purchase selected → return to feed → confirm scene and scroll restoration. Capture one feed and one detail screenshot in `qa/evidence/outfit-tab/`.

- [ ] **Step 4: Write handoff documentation**

Document how to open the prototype, covered interactions, demonstration-data policy, design-language sources, state-menu usage, and the boundary that this prototype does not update the Skill's formal `pages/` or `common/` assets.

- [ ] **Step 5: Final commit**

Commit: `git add work/douyin-outfit-tab/README.md qa/outfit-tab-static.test.mjs qa/evidence/outfit-tab && git commit -m "docs: verify outfit tab prototype"`
