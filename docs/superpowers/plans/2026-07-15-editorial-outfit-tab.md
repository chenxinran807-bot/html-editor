# Editorial Outfit Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first interactive prototype for a Douyin Mall “Outfit” Tab centered on editorial image browsing, story reading, collecting, and an explicit story/product dual-view detail.

**Architecture:** Create a zero-dependency static prototype with deterministic catalog fixtures and pure state transitions. Keep visual values isolated in token aliases validated against the bundled ecommerce design language; render the feed, story view, and product view from one state store through focused browser modules.

**Tech Stack:** HTML5, CSS3, browser ES modules, Node.js built-in test runner, Playwright or browser screenshot QA when available.

---

## File Structure

- `work/editorial-outfit-tab/index.html`: accessible mobile shell and stable view regions.
- `work/editorial-outfit-tab/tokens.css`: aliases for registered ecommerce colors, typography, spacing, and radii only.
- `work/editorial-outfit-tab/styles.css`: feed, story, product, state, and responsive presentation using token aliases.
- `work/editorial-outfit-tab/catalog.mjs`: neutral editorial stories, channels, products, and deterministic edge-state fixtures.
- `work/editorial-outfit-tab/state.mjs`: pure channel, navigation, collection, view switching, selection, and price-summary transitions.
- `work/editorial-outfit-tab/render.mjs`: stateless HTML render functions for feed, story, products, loading, empty, and error states.
- `work/editorial-outfit-tab/app.mjs`: event delegation, scroll restoration, state updates, image fallbacks, and feedback.
- `work/editorial-outfit-tab/demo-context.json`: machine-readable Kakaxi context copied from the approved spec.
- `work/editorial-outfit-tab/README.md`: interaction map, demo boundaries, source specifications, and QA instructions.
- `qa/editorial-outfit-state.test.mjs`: unit tests for pure state behavior and price calculations.
- `qa/editorial-outfit-static.test.mjs`: semantic structure, token-only CSS, copy, and accessibility contracts.
- `qa/editorial-outfit-browser.mjs`: responsive interaction and screenshot checks at 390px and 320px.

The prototype is a debug deliverable. Do not modify files under `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/pages/` or `common/`.

### Task 1: Lock Design-Language Inputs and Demo Context

**Files:**
- Create: `work/editorial-outfit-tab/demo-context.json`
- Create: `work/editorial-outfit-tab/README.md`
- Create: `qa/editorial-outfit-static.test.mjs`

- [ ] **Step 1: Read the required source-of-truth specifications**

Read these exact files before writing CSS or HTML:

```text
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/全局通用规则.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/设计资产目录和映射.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/token/设计 Token.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件/标签栏Tab.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件/商品卡.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件/按钮.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件/货币／价格.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件元素/布局.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件元素/颜色.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件元素/文字.md
/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件元素/圆角.md
```

Record these paths in `README.md` under `Design-language sources`. Do not use HTML samples as rules.

- [ ] **Step 2: Write the failing context contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('demo context records the approved fresh design', () => {
  const context = JSON.parse(fs.readFileSync('work/editorial-outfit-tab/demo-context.json', 'utf8'));
  assert.equal(context.mode, 'fast');
  assert.equal(context.product_goal, 'editorial-browse-and-save');
  assert.deepEqual(context.confirmed_choices, {
    content: 'editorial-image-and-text',
    visual_direction: 'light-community-feed',
    card_structure: 'image-first',
    detail: 'story-detail',
    commerce: 'story-product-dual-view',
  });
  assert.ok(context.open_questions.every((question) => question.blocking_level === 'soft'));
});
```

- [ ] **Step 3: Run the test and verify failure**

Run: `node --test qa/editorial-outfit-static.test.mjs`

Expected: FAIL with `ENOENT` for `demo-context.json`.

- [ ] **Step 4: Create the context and source record**

Create `demo-context.json` with the approved page units, five interactions, normal/loading/empty/error/boundary states, the two soft open questions, and these explicit prohibitions:

```json
{
  "mode": "fast",
  "product_goal": "editorial-browse-and-save",
  "confirmed_choices": {
    "content": "editorial-image-and-text",
    "visual_direction": "light-community-feed",
    "card_structure": "image-first",
    "detail": "story-detail",
    "commerce": "story-product-dual-view"
  },
  "open_questions": [
    { "id": "Q-01", "question": "Which production API supplies product price and stock?", "blocking_level": "soft" },
    { "id": "Q-02", "question": "What is the final bottom-navigation icon and position?", "blocking_level": "soft" }
  ],
  "do_not_infer": [
    "No fabricated sales, reviews, discounts, or lowest-price claims",
    "Do not present editorial content as user-generated content",
    "Do not implement real login, cart, or payment",
    "Do not claim pixel-perfect fidelity without design evidence"
  ]
}
```

Copy the complete `Demo Context` JSON object verbatim from section 8 of `docs/superpowers/specs/2026-07-15-editorial-outfit-tab-design.md`, then add the `product_goal` and `confirmed_choices` fields shown above directly after `mode`. This preserves the approved page units, five interactions, five required states, two open questions, prohibitions, and evidence sources without reinterpretation.

- [ ] **Step 5: Run the test and commit**

Run: `node --test qa/editorial-outfit-static.test.mjs`

Expected: 1 test PASS.

```bash
git add work/editorial-outfit-tab/demo-context.json work/editorial-outfit-tab/README.md qa/editorial-outfit-static.test.mjs
git commit -m "test: lock editorial outfit demo context"
```

### Task 2: Build and Test the Pure Content State

**Files:**
- Create: `work/editorial-outfit-tab/catalog.mjs`
- Create: `work/editorial-outfit-tab/state.mjs`
- Create: `qa/editorial-outfit-state.test.mjs`

- [ ] **Step 1: Write failing state tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { stories } from '../work/editorial-outfit-tab/catalog.mjs';
import { createState, setChannel, openStory, closeStory, toggleSave, setDetailView, toggleProduct, summarizeSelection } from '../work/editorial-outfit-tab/state.mjs';

test('switches channels without losing each channel scroll position', () => {
  const state = setChannel({ ...createState(), scrollByChannel: { 精选: 640 } }, '通勤');
  assert.equal(state.channel, '通勤');
  assert.equal(state.scrollByChannel.精选, 640);
});

test('opens a story in story view and returns to the saved feed', () => {
  let state = openStory({ ...createState(), scrollByChannel: { 精选: 420 } }, stories[0].id);
  assert.equal(state.detailView, 'story');
  state = closeStory(state);
  assert.equal(state.screen, 'feed');
  assert.equal(state.scrollByChannel.精选, 420);
});

test('save state is shared by feed and detail', () => {
  const state = toggleSave(createState(), stories[0].id);
  assert.ok(state.savedStoryIds.includes(stories[0].id));
});

test('product view selection updates count total and purchase label', () => {
  let state = openStory(createState(), stories[0].id);
  state = setDetailView(state, 'products', stories);
  const first = state.selectedProductIds[0];
  state = toggleProduct(state, first, stories);
  const summary = summarizeSelection(state, stories);
  assert.equal(summary.count, state.selectedProductIds.length);
  assert.equal(summary.actionLabel, '购买已选');
});

test('sold-out products cannot be selected', () => {
  let state = setDetailView(openStory(createState(), stories[0].id), 'products', stories);
  const soldOut = stories[0].products.find((product) => product.status === 'sold-out');
  state = toggleProduct(state, soldOut.id, stories);
  assert.ok(!state.selectedProductIds.includes(soldOut.id));
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `node --test qa/editorial-outfit-state.test.mjs`

Expected: FAIL because `catalog.mjs` and `state.mjs` do not exist.

- [ ] **Step 3: Add neutral editorial fixtures**

Create five channels and at least ten stories. Each story uses this stable shape:

```js
export const channels = ['精选', '通勤', '约会', '周末', '显高'];
export const stories = [{
  id: 'story-trench-three-ways',
  channels: ['精选', '通勤'],
  title: '一件风衣的三种穿法',
  editorialLabel: '编辑精选',
  savedCountLabel: '1.2万收藏',
  image: './assets/look-trench.svg',
  gallery: ['./assets/look-trench.svg', './assets/look-trench-detail.svg'],
  intro: '从工作日通勤到周末散步，用层次和鞋型切换气质。',
  tips: ['用短内搭抬高视觉腰线', '同色鞋袜让下装线条更连贯'],
  topics: ['通勤', '风衣'],
  products: [
    { id: 'trench-1', category: '上装', title: '简洁长款外套', spec: '演示规格', priceFen: 32900, image: './assets/item-trench.svg', status: 'available' },
    { id: 'trouser-1', category: '下装', title: '直筒长裤', spec: '演示规格', priceFen: 23900, image: './assets/item-trouser.svg', status: 'available' },
    { id: 'shoe-1', category: '鞋', title: '轻便休闲鞋', spec: '演示规格', priceFen: 25900, image: './assets/item-shoe.svg', status: 'sold-out' }
  ]
}];
```

Add one `feature` record after every 6–8 normal cards in the `精选` sequence. Use only neutral editorial copy and explicitly labeled demonstration prices.

- [ ] **Step 4: Implement minimal pure transitions**

Implement the exported functions with immutable object and array updates. `setDetailView(state, 'products', stories)` initializes selection to available products only. `summarizeSelection` returns `{ count, totalFen, actionLabel, disabled }`; labels are `购买整套`, `购买已选`, or `请选择商品`.

- [ ] **Step 5: Run the tests and commit**

Run: `node --test qa/editorial-outfit-state.test.mjs`

Expected: 5 tests PASS.

```bash
git add work/editorial-outfit-tab/catalog.mjs work/editorial-outfit-tab/state.mjs qa/editorial-outfit-state.test.mjs
git commit -m "feat: add editorial outfit state model"
```

### Task 3: Establish Token-Only Visual Foundation

**Files:**
- Create: `work/editorial-outfit-tab/tokens.css`
- Create: `work/editorial-outfit-tab/styles.css`
- Modify: `qa/editorial-outfit-static.test.mjs`

- [ ] **Step 1: Add failing token contracts**

```js
test('token aliases use registered values', () => {
  const css = fs.readFileSync('work/editorial-outfit-tab/tokens.css', 'utf8');
  assert.match(css, /--text-primary:\s*#161823/);
  assert.match(css, /--brand-primary:\s*#FF003C/);
  assert.match(css, /--radius-card:\s*8px/);
  assert.match(css, /--font-card-title:\s*16px/);
  assert.match(css, /--line-card-title:\s*22px/);
});

test('component CSS references aliases instead of raw visual values', () => {
  const css = fs.readFileSync('work/editorial-outfit-tab/styles.css', 'utf8');
  assert.match(css, /var\(--text-primary\)/);
  assert.match(css, /var\(--radius-card\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
  assert.doesNotMatch(css, /(?:font-size|line-height|gap|padding|margin|border-radius):\s*\d+px/);
});
```

- [ ] **Step 2: Run the static tests and verify failure**

Run: `node --test qa/editorial-outfit-static.test.mjs`

Expected: FAIL with `ENOENT` for `tokens.css`.

- [ ] **Step 3: Create registered aliases**

Populate `tokens.css` only from the color and design-token manifests. At minimum define aliases for primary/secondary/tertiary/disabled text, white and subtle backgrounds, divider, brand red, 4/8/12/16/20px radii, registered gap sizes, and the exact typography pairs used by the page. Document each alias with its source token name.

- [ ] **Step 4: Add layout primitives**

Use CSS variables for every color, radius, gap, font size, and line height. Implement the 320–430px app shell, sticky header, horizontal tabs, two-column CSS-column feed, full-width feature cards, story gallery, segmented dual-view control, product rows, fixed checkout bar, toast, skeleton, empty/error blocks, image fallback, focus visibility, and reduced motion. Structural values such as `100%`, aspect ratios, viewport units, and fixed touch-target minimums must be documented separately from visual tokens.

- [ ] **Step 5: Run token validation and commit**

Run:

```bash
node --test qa/editorial-outfit-static.test.mjs
node /Users/bytedance/.codex/skills/ecommerce-design-language/scripts/validate-assets.js work/editorial-outfit-tab/tokens.css work/editorial-outfit-tab/styles.css
```

Expected: all tests PASS and validator reports zero unregistered visual values.

```bash
git add work/editorial-outfit-tab/tokens.css work/editorial-outfit-tab/styles.css qa/editorial-outfit-static.test.mjs
git commit -m "feat: add editorial outfit visual foundation"
```

### Task 4: Render Feed and Editorial Story

**Files:**
- Create: `work/editorial-outfit-tab/index.html`
- Create: `work/editorial-outfit-tab/render.mjs`
- Create: `work/editorial-outfit-tab/app.mjs`
- Modify: `qa/editorial-outfit-static.test.mjs`

- [ ] **Step 1: Add failing semantic contracts**

```js
test('shell exposes feed, story, products, feedback, and templates', () => {
  const html = fs.readFileSync('work/editorial-outfit-tab/index.html', 'utf8');
  for (const marker of ['data-screen="feed"', 'data-screen="detail"', 'data-detail-view="story"', 'data-detail-view="products"', 'aria-live="polite"']) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(html, /<script type="module" src="\.\/app\.mjs"><\/script>/);
});

test('application binds channel, story, save, and detail-view actions', () => {
  const app = fs.readFileSync('work/editorial-outfit-tab/app.mjs', 'utf8');
  for (const action of ['set-channel', 'open-story', 'close-story', 'toggle-save', 'set-detail-view']) {
    assert.match(app, new RegExp(action));
  }
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test qa/editorial-outfit-static.test.mjs`

Expected: FAIL because `index.html` and `app.mjs` do not exist.

- [ ] **Step 3: Create the accessible shell**

Use semantic `<header>`, `<nav>`, and `<main>` regions. Use real `<button>` elements for tabs, cards, save, back, share, and dual-view actions. Add `aria-current="page"` to the selected bottom-navigation item, `aria-pressed` to save controls, and `role="tablist"`, `role="tab"`, and `role="tabpanel"` to the dual view.

- [ ] **Step 4: Implement focused render functions**

Export `renderChannelTabs`, `renderFeed`, `renderStory`, `renderProducts`, `renderSkeleton`, `renderEmpty`, and `renderError`. Escape all fixture strings before interpolation. Keep event attributes limited to `data-action` and stable record IDs.

- [ ] **Step 5: Bind navigation and restoration**

In `app.mjs`, use one delegated click handler. Before changing channel or opening a story, store the current feed scroller position. After feed render, restore the saved position in `requestAnimationFrame`. Update all matching save buttons after a collection change.

- [ ] **Step 6: Run tests and commit**

Run: `node --test qa/editorial-outfit-state.test.mjs qa/editorial-outfit-static.test.mjs`

Expected: all tests PASS.

```bash
git add work/editorial-outfit-tab/index.html work/editorial-outfit-tab/render.mjs work/editorial-outfit-tab/app.mjs qa/editorial-outfit-static.test.mjs
git commit -m "feat: render editorial outfit feed and stories"
```

### Task 5: Add Product View, Purchase Feedback, and Edge States

**Files:**
- Modify: `work/editorial-outfit-tab/render.mjs`
- Modify: `work/editorial-outfit-tab/app.mjs`
- Modify: `work/editorial-outfit-tab/index.html`
- Modify: `qa/editorial-outfit-static.test.mjs`

- [ ] **Step 1: Add failing product-action contracts**

```js
test('product interactions are bound', () => {
  const app = fs.readFileSync('work/editorial-outfit-tab/app.mjs', 'utf8');
  for (const action of ['toggle-product', 'choose-spec', 'buy-selection', 'retry-feed', 'return-featured']) {
    assert.match(app, new RegExp(action));
  }
});

test('prototype exposes deterministic edge-state controls', () => {
  const html = fs.readFileSync('work/editorial-outfit-tab/index.html', 'utf8');
  assert.match(html, /原型状态/);
  for (const state of ['loading', 'empty', 'error', 'broken-image', 'partial-sold-out', 'all-unavailable']) {
    assert.match(html, new RegExp(`value="${state}"`));
  }
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test qa/editorial-outfit-static.test.mjs`

Expected: FAIL until every action and state control exists.

- [ ] **Step 3: Render the complete product view**

Render outfit summary, categorized product rows, selection controls, specification buttons, sold-out state, count, total price, and dynamic CTA. Missing specification disables purchase and places focus on the first unresolved product after CTA activation.

- [ ] **Step 4: Add deterministic state preview controls**

Place a clearly labeled `原型状态` control outside the default customer path. It switches fixtures without network calls. Loading uses matched skeleton dimensions; empty offers `返回精选`; error offers `重试`; broken images preserve aspect ratio; all-unavailable disables purchase.

- [ ] **Step 5: Add purchase feedback**

For a valid selection, announce `已确认购买整套（原型）` or `已确认购买已选商品（原型）` through the polite live region. Do not navigate to login, cart, cashier, or payment.

- [ ] **Step 6: Run tests and commit**

Run: `node --test qa/editorial-outfit-state.test.mjs qa/editorial-outfit-static.test.mjs`

Expected: all tests PASS.

```bash
git add work/editorial-outfit-tab/render.mjs work/editorial-outfit-tab/app.mjs work/editorial-outfit-tab/index.html qa/editorial-outfit-static.test.mjs
git commit -m "feat: add outfit product view and edge states"
```

### Task 6: Add Local Visual Fixtures and Browser QA

**Files:**
- Create: `work/editorial-outfit-tab/assets/*.svg`
- Modify: `work/editorial-outfit-tab/catalog.mjs`
- Create: `qa/editorial-outfit-browser.mjs`
- Modify: `work/editorial-outfit-tab/README.md`

- [ ] **Step 1: Create local neutral SVG fixtures**

Create at least ten vertical editorial compositions, three detail crops, and six square product images. Every SVG must include an accessible `<title>`, use only manifest-registered colors, contain no brand logo, and avoid unsupported product claims. Reference them from `catalog.mjs`; no remote image dependency is allowed.

- [ ] **Step 2: Write browser checks**

In `qa/editorial-outfit-browser.mjs`, open the prototype through a local static server and assert at 390×844 and 320×720 that:

```js
await expect(page.locator('html')).toHaveJSProperty('scrollWidth', await page.locator('html').evaluate((el) => el.clientWidth));
await page.getByRole('button', { name: /通勤/ }).click();
await page.locator('[data-action="open-story"]').first().click();
await page.getByRole('tab', { name: '整套商品' }).click();
await page.locator('[data-action="toggle-product"]').first().click();
await expect(page.locator('[data-purchase-label]')).toContainText('购买已选');
await page.getByRole('button', { name: /返回/ }).click();
await expect(page.getByRole('button', { name: /通勤/ })).toHaveAttribute('aria-selected', 'true');
```

Also capture `feed-390.png`, `story-390.png`, `products-390.png`, and `feed-320.png` under `qa/evidence/editorial-outfit/`.

- [ ] **Step 3: Run visual and token validation**

Run:

```bash
node --test qa/editorial-outfit-state.test.mjs qa/editorial-outfit-static.test.mjs
node qa/editorial-outfit-browser.mjs
node /Users/bytedance/.codex/skills/ecommerce-design-language/scripts/validate-assets.js work/editorial-outfit-tab
```

Expected: all tests PASS, four screenshots are created, no horizontal overflow is reported, and token validation reports zero violations.

- [ ] **Step 4: Complete README and commit**

Document how to open the prototype, the full interaction path, all state-preview options, the eleven md sources used, the lack of production APIs, the two soft open questions, and the exact validation commands and results.

```bash
git add work/editorial-outfit-tab qa/editorial-outfit-browser.mjs qa/evidence/editorial-outfit
git commit -m "test: verify editorial outfit prototype"
```

### Task 7: Final Verification and Handoff

**Files:**
- Modify: `work/editorial-outfit-tab/README.md`

- [ ] **Step 1: Run the complete verification suite from a clean shell**

```bash
node --test qa/editorial-outfit-state.test.mjs qa/editorial-outfit-static.test.mjs
node qa/editorial-outfit-browser.mjs
node /Users/bytedance/.codex/skills/ecommerce-design-language/scripts/validate-assets.js work/editorial-outfit-tab
git diff --check
```

Expected: zero test failures, zero token violations, four current screenshots, and no whitespace errors.

- [ ] **Step 2: Perform the Kakaxi delivery audit**

Confirm the delivery contains:

- Demo path and launch instruction.
- Feed, story, product, and state-preview scenario descriptions.
- Open questions Q-01 and Q-02.
- Explicit risk that visual fidelity is inferred without screenshots or Figma.
- Confirmation that no core ecommerce design-language asset was modified.
- Suggested next inputs: final bottom-navigation spec and production product-data contract.

- [ ] **Step 3: Record verification results**

Append the dated commands and observed pass counts to `README.md`. Do not write “passes” unless the command has just succeeded in the current environment.

- [ ] **Step 4: Commit the verified handoff**

```bash
git add work/editorial-outfit-tab/README.md
git commit -m "docs: hand off editorial outfit prototype"
```
