# Douyin Mall Scenario-First Outfit Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency, high-fidelity interactive mobile prototype for a scenario-first Douyin Mall outfit Tab serving mixed-gender inspiration browsing and complete-outfit discovery.

**Architecture:** Keep accepted requirements and neutral demo content in separate files, drive all navigation and feedback through a pure immutable state module, and render the experience from a single mobile HTML entry. Use local self-contained SVG assets, stable editable element keys, hash deep links, and Node/Playwright QA for contracts, state transitions, full journeys, responsive layout, and recoverable states.

**Tech Stack:** HTML5, CSS3, browser ES modules, Node.js built-in test runner, Playwright-compatible browser QA, local SVG assets.

---

## File Structure

- `work/douyin-outfit-scenario-first/prd.md`: approved product requirements copied from the accepted specification.
- `work/douyin-outfit-scenario-first/catalog.js`: scenario labels, creators, collections, outfits, products, and neutral local asset references.
- `work/douyin-outfit-scenario-first/state.js`: pure state transitions for scenario selection, navigation, reactions, replacement, removal, cart, and recovery.
- `work/douyin-outfit-scenario-first/index.html`: responsive mobile UI, screens, overlays, editable keys, and event binding.
- `work/douyin-outfit-scenario-first/assets/*.svg`: self-contained editorial outfit and icon assets.
- `work/douyin-outfit-scenario-first/prototype.manifest.json`: screen, route, editable element, and interaction manifest.
- `work/douyin-outfit-scenario-first/demo-summary.md`: user journeys, state controls, prototype boundaries, and review links.
- `qa/outfit-scenario-first-contract.test.mjs`: static content, accessibility, asset, route, and editability contract checks.
- `qa/outfit-scenario-first-state.test.mjs`: deterministic pure-state tests.
- `qa/outfit-scenario-first-browser.mjs`: browser journey, focus, state, viewport, and screenshot checks.

### Task 1: Freeze Requirements and Artifact Contracts

**Files:**
- Create: `work/douyin-outfit-scenario-first/prd.md`
- Create: `qa/outfit-scenario-first-contract.test.mjs`

- [ ] **Step 1: Write the failing requirements test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = 'work/douyin-outfit-scenario-first';

test('accepted requirements preserve the scenario-first scope', () => {
  const prd = fs.readFileSync(`${root}/prd.md`, 'utf8');
  for (const statement of [
    '男女混合用户',
    '默认选中“通勤”',
    '真人穿搭',
    '主题合集',
    '整套搭配',
    '单品替换弹层',
    '恢复来源频道、场景、筛选条件和滚动位置',
  ]) assert.match(prd, new RegExp(statement));
  assert.doesNotMatch(prd, /已接入真实推荐算法|已接入真实支付接口/);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test qa/outfit-scenario-first-contract.test.mjs`

Expected: FAIL with `ENOENT` for `prd.md`.

- [ ] **Step 3: Create the accepted PRD source**

Copy the complete approved specification from `docs/superpowers/specs/2026-07-15-douyin-mall-outfit-tab-scenario-first-design.md` into `prd.md`. Preserve the headings and factual boundaries; do not add brands, prices, discounts, sales, or algorithm claims.

- [ ] **Step 4: Run the contract test**

Run: `node --test qa/outfit-scenario-first-contract.test.mjs`

Expected: 1 test PASS.

- [ ] **Step 5: Commit**

```bash
git add work/douyin-outfit-scenario-first/prd.md qa/outfit-scenario-first-contract.test.mjs
git commit -m "test: define scenario-first outfit requirements"
```

### Task 2: Implement the Neutral Catalog and Pure State Model

**Files:**
- Create: `work/douyin-outfit-scenario-first/catalog.js`
- Create: `work/douyin-outfit-scenario-first/state.js`
- Create: `qa/outfit-scenario-first-state.test.mjs`

- [ ] **Step 1: Write failing state tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog } from '../work/douyin-outfit-scenario-first/catalog.js';
import {
  createState, selectScenario, openContent, returnToFeed, toggleReaction,
  toggleFollow, hideCard, undoHide, replaceItem, addOutfitToCart, setFeedStatus,
} from '../work/douyin-outfit-scenario-first/state.js';

test('starts in scenario mode with commute selected', () => {
  const state = createState();
  assert.equal(state.channel, '按场景');
  assert.equal(state.scenario, '通勤');
  assert.equal(state.view, 'feed');
});

test('opens all content types and restores browsing context', () => {
  for (const card of createCatalog().cards) {
    const base = { ...createState(), scrollTop: 720 };
    const detail = openContent(base, card);
    assert.equal(detail.view, `${card.type}-detail`);
    const restored = returnToFeed(detail);
    assert.equal(restored.scrollTop, 720);
    assert.equal(restored.scenario, '通勤');
  }
});

test('reactions, following, removal and undo are reversible', () => {
  let state = toggleReaction(createState(), 'creator-1', 'saved');
  state = toggleFollow(state, 'author-1');
  state = hideCard(state, 'creator-1');
  state = undoHide(state);
  assert.equal(state.reactions['creator-1'].saved, true);
  assert.deepEqual(state.followingAuthorIds, ['author-1']);
  assert.equal(state.hiddenCardIds.length, 0);
});

test('replacement and cart updates are observable', () => {
  let state = replaceItem(createState(), 'outfit-1', 'top', 'product-top-2');
  state = addOutfitToCart(state, 'outfit-1');
  assert.equal(state.replacements['outfit-1'].top, 'product-top-2');
  assert.ok(state.cartCount > 0);
});

test('supports recoverable feed states', () => {
  for (const status of ['loading', 'empty', 'error', 'image-failure', 'ended', 'ready']) {
    assert.equal(setFeedStatus(createState(), status).feedStatus, status);
  }
});
```

- [ ] **Step 2: Run tests and verify module failure**

Run: `node --test qa/outfit-scenario-first-state.test.mjs`

Expected: FAIL because `catalog.js` and `state.js` do not exist.

- [ ] **Step 3: Create the catalog**

Export `createCatalog()` with this stable shape:

```js
{
  channels: ['按场景', '适合我', '博主推荐'],
  scenarios: ['通勤', '约会', '出游', '校园', '运动', '聚会'],
  cards: [
    { id: 'creator-1', type: 'creator', gender: '女', authorId: 'author-1', title: '米白与浅灰的干净层次', tags: ['通勤'], assetPath: './assets/creator-1.svg' },
    { id: 'creator-2', type: 'creator', gender: '男', authorId: 'author-2', title: '清爽利落的衬衫叠穿', tags: ['通勤'], assetPath: './assets/creator-2.svg' },
    { id: 'collection-1', type: 'collection', title: '不同身高的通勤比例', count: 18, tags: ['通勤'], assetPath: './assets/collection-1.svg' },
    { id: 'outfit-1', type: 'outfit', gender: '女', title: '不费力的周一通勤', itemIds: ['product-top-1', 'product-bottom-1', 'product-shoe-1', 'product-bag-1'], tags: ['通勤'], assetPath: './assets/outfit-1.svg' },
    { id: 'outfit-2', type: 'outfit', gender: '男', title: '衬衫也能穿得松弛', itemIds: ['product-top-3', 'product-bottom-2', 'product-shoe-2'], tags: ['通勤'], assetPath: './assets/outfit-2.svg' },
  ],
  products: [
    { id: 'product-top-1', slot: 'top', name: '轻薄层次上装', assetPath: './assets/product-top-1.svg' },
    { id: 'product-top-2', slot: 'top', name: '利落短款上装', assetPath: './assets/product-top-2.svg' },
  ],
}
```

Extend the fixture to at least twelve cards, two outfits per scenario, six replaceable products, and balanced male/female first-screen outfits. Keep all copy neutral and non-commercial.

- [ ] **Step 4: Implement immutable state transitions**

`createState()` returns channel, scenario, filter maps, scroll map, view, active content ID, reactions, following author IDs, hidden card IDs, undo payload, replacements, cart count, feed status, and toast message. Every transition returns a fresh object, validates IDs against the catalog, and never accesses DOM globals.

- [ ] **Step 5: Run state tests and commit**

Run: `node --test qa/outfit-scenario-first-state.test.mjs`

Expected: 5 tests PASS.

```bash
git add work/douyin-outfit-scenario-first/catalog.js work/douyin-outfit-scenario-first/state.js qa/outfit-scenario-first-state.test.mjs
git commit -m "feat: add outfit scenario state model"
```

### Task 3: Build the Scenario-First Mobile Feed

**Files:**
- Create: `work/douyin-outfit-scenario-first/index.html`
- Create: `work/douyin-outfit-scenario-first/assets/*.svg`
- Modify: `qa/outfit-scenario-first-contract.test.mjs`

- [ ] **Step 1: Add failing static UI checks**

```js
test('mobile shell exposes stable editable regions and local assets', () => {
  const html = fs.readFileSync(`${root}/index.html`, 'utf8');
  for (const key of [
    'page-title', 'channel-scene', 'channel-fit', 'channel-creator',
    'scenario-grid', 'featured-outfits', 'inspiration-feed', 'bottom-nav-outfit',
  ]) assert.match(html, new RegExp(`data-proto-key="${key}"`));
  assert.match(html, /data-card-type="creator"/);
  assert.match(html, /data-card-type="collection"/);
  assert.match(html, /data-card-type="outfit"/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}]/u);
});
```

- [ ] **Step 2: Run contract tests and verify failure**

Run: `node --test qa/outfit-scenario-first-contract.test.mjs`

Expected: FAIL with `ENOENT` for `index.html`.

- [ ] **Step 3: Create local visual assets**

Create self-contained SVGs for twelve content cards, six product thumbnails, six scenario icons, and search, message, back, more, like, collect, follow, retry, home, video, outfit, cart, and profile controls. Use abstract silhouettes and clothing shapes; include no logos, remote URLs, embedded fonts, or text-as-icon glyphs.

- [ ] **Step 4: Implement the responsive feed shell**

Use CSS custom properties mapped only to registered ecommerce values. Build a fluid 320–430px page without a device frame: sticky title and channel tabs, a 3×2 scenario grid, horizontal featured outfit cards, two-column mixed inspiration feed, and fixed bottom navigation with safe-area padding. Every interactive control must be a semantic `button` or `a`, have a minimum 44px target, a focus-visible style, and a stable `data-proto-key`.

- [ ] **Step 5: Bind catalog rendering and scenario switching**

Import `catalog.js` and `state.js` as modules. Render the female and male featured outfits side by side, then render distinct creator, collection, and outfit card templates. Clicking a scenario updates `aria-selected`, shows an equal-size skeleton, replaces both feed regions, and restores per-channel scroll state.

- [ ] **Step 6: Run tests and commit**

Run: `node --test qa/outfit-scenario-first-contract.test.mjs qa/outfit-scenario-first-state.test.mjs`

Expected: all tests PASS.

```bash
git add work/douyin-outfit-scenario-first/index.html work/douyin-outfit-scenario-first/assets qa/outfit-scenario-first-contract.test.mjs
git commit -m "feat: build scenario-first outfit feed"
```

### Task 4: Add Details, Replacement, Feedback, and Recovery

**Files:**
- Modify: `work/douyin-outfit-scenario-first/index.html`
- Modify: `work/douyin-outfit-scenario-first/state.js`
- Modify: `qa/outfit-scenario-first-state.test.mjs`
- Modify: `qa/outfit-scenario-first-contract.test.mjs`

- [ ] **Step 1: Add failing interaction contracts**

```js
test('details and recoverable controls are present', () => {
  const html = fs.readFileSync(`${root}/index.html`, 'utf8');
  for (const action of [
    'open-content', 'back-to-feed', 'toggle-like', 'toggle-save', 'toggle-follow',
    'hide-card', 'undo-hide', 'open-replacement', 'select-replacement',
    'add-outfit-cart', 'clear-filter', 'retry-feed',
  ]) assert.match(html, new RegExp(`data-action="${action}"`));
  for (const screen of ['creator-detail', 'collection-detail', 'outfit-detail', 'replacement-sheet']) {
    assert.match(html, new RegExp(`data-screen="${screen}"`));
  }
  assert.match(html, /aria-live="polite"/);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test qa/outfit-scenario-first-contract.test.mjs qa/outfit-scenario-first-state.test.mjs`

Expected: FAIL because the detail regions and controls are absent.

- [ ] **Step 3: Implement three details and the replacement sheet**

Creator detail shows media, author, explanation, tags, and related items. Collection detail renders a continuous list plus adjacent themes. Outfit detail shows the full look, rationale, audience, item list, replace controls, and sticky add-to-cart action. The replacement sheet lists the current item and same-slot alternatives, traps focus while open, closes on Escape, and returns focus to its trigger.

- [ ] **Step 4: Implement observable feedback and recovery states**

Bind like, save, follow, hide, undo, replacement, and cart actions to pure state transitions. Use one `aria-live="polite"` toast. Add a prototype-state control that can trigger loading, empty, error, image failure, ended, and ready. Empty exposes clear-filter; error exposes retry; image failure preserves card aspect ratio; ended recommends another scenario.

- [ ] **Step 5: Verify state and contract tests**

Run: `node --test qa/outfit-scenario-first-contract.test.mjs qa/outfit-scenario-first-state.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add work/douyin-outfit-scenario-first/index.html work/douyin-outfit-scenario-first/state.js qa/outfit-scenario-first-contract.test.mjs qa/outfit-scenario-first-state.test.mjs
git commit -m "feat: add outfit details and recovery states"
```

### Task 5: Add Editable Manifests and Review Documentation

**Files:**
- Create: `work/douyin-outfit-scenario-first/prototype.manifest.json`
- Create: `work/douyin-outfit-scenario-first/demo-summary.md`
- Modify: `qa/outfit-scenario-first-contract.test.mjs`

- [ ] **Step 1: Add failing manifest checks**

```js
test('manifest covers every screen, route and editable key', () => {
  const html = fs.readFileSync(`${root}/index.html`, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(`${root}/prototype.manifest.json`, 'utf8'));
  for (const route of ['#/feed', '#/creator/creator-1', '#/collection/collection-1', '#/outfit/outfit-1', '#/state/error']) {
    assert.ok(manifest.routes.some((item) => item.hash === route));
  }
  const keys = [...html.matchAll(/data-proto-key="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) assert.ok(manifest.elements.some((item) => item.key === key));
});
```

- [ ] **Step 2: Run tests and verify manifest failure**

Run: `node --test qa/outfit-scenario-first-contract.test.mjs`

Expected: FAIL with `ENOENT` for `prototype.manifest.json`.

- [ ] **Step 3: Create manifest and summary**

The manifest must list schema version, five screen groups, every hash route, every editable key, allowed edits (`text`, `color`, `image`, `position`, `size`, `visibility`, `disabled`, `target`), and every interaction target. `demo-summary.md` must document the main journey, state trigger control, factual boundaries, viewport support, and deep links.

- [ ] **Step 4: Run contract tests and commit**

Run: `node --test qa/outfit-scenario-first-contract.test.mjs`

Expected: all tests PASS.

```bash
git add work/douyin-outfit-scenario-first/prototype.manifest.json work/douyin-outfit-scenario-first/demo-summary.md qa/outfit-scenario-first-contract.test.mjs
git commit -m "docs: add outfit prototype manifest"
```

### Task 6: Verify Browser Journeys, Responsive Layout, and Tokens

**Files:**
- Create: `qa/outfit-scenario-first-browser.mjs`
- Create: `qa/evidence/outfit-scenario-first/*.png`
- Modify: `work/douyin-outfit-scenario-first/index.html` only if QA finds a defect

- [ ] **Step 1: Write browser journey assertions**

Create a local static server and run Chromium at widths 320, 390, and 430. At each width assert:

```js
await page.goto(`${baseURL}/work/douyin-outfit-scenario-first/index.html`);
await page.getByRole('button', { name: '约会' }).click();
assert.equal(await page.getByRole('button', { name: '约会' }).getAttribute('aria-selected'), 'true');
await page.locator('[data-action="open-content"][data-content-type="outfit"]').first().click();
await page.locator('[data-action="open-replacement"]').first().click();
await page.locator('[data-action="select-replacement"]').last().click();
await page.locator('[data-action="add-outfit-cart"]').click();
await page.locator('[data-action="back-to-feed"]').click();
assert.equal(await page.getByRole('button', { name: '约会' }).getAttribute('aria-selected'), 'true');
const size = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
assert.ok(size.scrollWidth <= size.clientWidth);
```

Also exercise creator follow, save consistency, collection detail, hide/undo, loading, empty/clear, error/retry, image failure, content ended, keyboard traversal, Escape-to-close, and scroll restoration. Fail on unexpected console errors, page errors, broken visible images, targets below 44px, duplicate editable keys, and focus loss after rerender.

- [ ] **Step 2: Run browser QA and verify initial failures**

Run: `node qa/outfit-scenario-first-browser.mjs`

Expected: FAIL until the browser journey satisfies every focus, sizing, scroll, recovery-state, and console-error assertion listed in Step 1. Record each failing assertion message before editing.

- [ ] **Step 3: Fix only observed defects and rerun all checks**

Run:

```bash
node --test qa/outfit-scenario-first-contract.test.mjs qa/outfit-scenario-first-state.test.mjs
node qa/outfit-scenario-first-browser.mjs
node /Users/bytedance/.codex/skills/ecommerce-design-language/scripts/validate-assets.js work/douyin-outfit-scenario-first/index.html
```

Expected: all Node tests PASS, browser QA prints PASS for 320/390/430, and token validation exits 0 with no unregistered colors, radii, spacing, font sizes, or line heights.

- [ ] **Step 4: Capture visual evidence**

Save viewport screenshots for `feed-390.png`, `outfit-detail-390.png`, `replacement-sheet-390.png`, and `error-state-390.png`. Assert each file contains rendered pixels and is larger than 10 KB.

- [ ] **Step 5: Commit verified output**

```bash
git add work/douyin-outfit-scenario-first qa/outfit-scenario-first-*.mjs qa/evidence/outfit-scenario-first
git commit -m "test: verify scenario-first outfit prototype"
```

### Task 7: Final Handoff Check

**Files:**
- Modify: `work/douyin-outfit-scenario-first/demo-summary.md`

- [ ] **Step 1: Run the complete verification set from a clean page load**

```bash
node --test qa/outfit-scenario-first-contract.test.mjs qa/outfit-scenario-first-state.test.mjs
node qa/outfit-scenario-first-browser.mjs
git diff --check
git status -sb
```

Expected: all tests PASS, browser QA passes at three widths, `git diff --check` has no output, and status contains no uncommitted files from this implementation.

- [ ] **Step 2: Add final review instructions**

In `demo-summary.md`, provide the local `index.html` path, `#/feed`, three detail deep links, `#/state/error`, the state-control location, the main click journey, verified viewport widths, and explicit statements that data is neutral demo content and payment is not connected.

- [ ] **Step 3: Commit the handoff update**

```bash
git add work/douyin-outfit-scenario-first/demo-summary.md
git commit -m "docs: finalize outfit prototype handoff"
```
