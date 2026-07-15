# Douyin Mall Outfit Content Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency, editable mobile HTML prototype for a Douyin Mall outfit Tab that improves browsing and dwell time through mixed creator looks, editorial collections, and shoppable outfit content.

**Architecture:** Keep the accepted design and its verbatim evidence in a semantic requirements document, then use a small pure state module to drive channel filters, feedback actions, detail navigation, scroll restoration, and recoverable states. Render the experience as a self-contained `index.html` with local SVG/image assets and the editable prototype runtime, then emit the manifests required by `prd-to-editable-demo`.

**Tech Stack:** HTML5, CSS3, browser JavaScript, Node.js built-in test runner, Playwright-compatible browser QA, `prd-to-editable-demo v0.2.0` artifact contracts.

---

## File Structure

- `work/douyin-outfit-content-feed/prd.md`: accepted requirements in full, used as the evidence source.
- `work/douyin-outfit-content-feed/semantic-requirements.json`: model-semantic extraction with verbatim evidence, assumptions, and gaps.
- `work/douyin-outfit-content-feed/catalog.js`: neutral demo creators, collections, outfits, filters, and local asset references.
- `work/douyin-outfit-content-feed/state.js`: pure state transitions and selectors.
- `work/douyin-outfit-content-feed/index.html`: mobile UI, styles, SVG icons, runtime, and interactive views.
- `work/douyin-outfit-content-feed/demo-context.json`: complete page, interaction, state, evidence, and assumption context.
- `work/douyin-outfit-content-feed/design-profile.json`: ecommerce token and component choices.
- `work/douyin-outfit-content-feed/prototype.manifest.json`: editable element and navigation manifest.
- `work/douyin-outfit-content-feed/prototype.patches.json`: initial empty patch collection.
- `work/douyin-outfit-content-feed/agent-comments.json`: initial empty Agent comment collection.
- `work/douyin-outfit-content-feed/demo-summary.md`: flows, states, and prototype boundaries.
- `work/douyin-outfit-content-feed/assumptions.md`: inferred content and unavailable commercial facts.
- `qa/outfit-content-feed-state.test.mjs`: deterministic state tests.
- `qa/outfit-content-feed-contract.test.mjs`: artifact, accessibility, token, and editable-runtime tests.
- `qa/outfit-content-feed-browser.mjs`: browser path and viewport checks.

### Task 1: Freeze the Semantic Requirements Contract

**Files:**
- Create: `work/douyin-outfit-content-feed/prd.md`
- Create: `work/douyin-outfit-content-feed/semantic-requirements.json`
- Create: `qa/outfit-content-feed-contract.test.mjs`

- [ ] **Step 1: Write the failing evidence contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = 'work/douyin-outfit-content-feed';

test('semantic requirements preserve accepted facts and isolate assumptions', () => {
  const prd = fs.readFileSync(`${root}/prd.md`, 'utf8');
  const requirements = JSON.parse(fs.readFileSync(`${root}/semantic-requirements.json`, 'utf8'));
  assert.equal(requirements.extractionMode, 'model-semantic');
  assert.deepEqual(requirements.screens, ['穿搭内容流', '真人穿搭详情', '主题合集详情', '商品搭配详情']);
  assert.ok(requirements.businessObjects.includes('真人穿搭'));
  assert.ok(requirements.businessObjects.includes('主题合集'));
  assert.ok(requirements.businessObjects.includes('商品搭配'));
  for (const item of requirements.evidence) assert.ok(prd.includes(item.quote));
  assert.ok(requirements.assumptions.some((item) => item.includes('演示内容')));
  assert.ok(requirements.gaps.some((item) => item.includes('真实商品')));
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test qa/outfit-content-feed-contract.test.mjs`

Expected: FAIL with `ENOENT` because the semantic input files do not exist.

- [ ] **Step 3: Write the accepted PRD source**

Create `prd.md` from the approved specification. It must include these exact statements so evidence can be verified:

```markdown
# 抖音商城独立端穿搭 Tab

首要目标是提升穿搭内容浏览时长和连续浏览意愿。
页面面向男女混合用户，覆盖更多风格与场景。
页面采用真人穿搭、主题合集与商品搭配混排的内容流。
二级结构采用三个平行 Tab：按场景、适合我、博主推荐。
用户可以喜欢、收藏、关注，也可以标记不感兴趣并撤销。
用户可以进入真人穿搭详情、主题合集详情和商品搭配详情，返回后恢复频道、筛选和滚动位置。
页面覆盖加载、空内容、加载失败、图片失败和重试状态。
```

- [ ] **Step 4: Write the semantic JSON**

Create `semantic-requirements.json` with `schemaVersion: 1`, `confidence: "high"`, the four screens asserted by the test, evidence for every business object and user action, transitions for opening and returning from all three detail types, and explicit assumptions and gaps. Use only continuous quotes from `prd.md` in `quote` and `evidence` fields.

- [ ] **Step 5: Run the test and commit**

Run: `node --test qa/outfit-content-feed-contract.test.mjs`

Expected: 1 test PASS.

```bash
git add work/douyin-outfit-content-feed/prd.md work/douyin-outfit-content-feed/semantic-requirements.json qa/outfit-content-feed-contract.test.mjs
git commit -m "test: define outfit content feed requirements"
```

### Task 2: Implement the Browsing State Model

**Files:**
- Create: `work/douyin-outfit-content-feed/catalog.js`
- Create: `work/douyin-outfit-content-feed/state.js`
- Create: `qa/outfit-content-feed-state.test.mjs`

- [ ] **Step 1: Write failing state transition tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog } from '../work/douyin-outfit-content-feed/catalog.js';
import { createState, selectChannel, selectFilter, openCard, returnToFeed, toggleReaction, hideCard, undoHide, setFeedStatus } from '../work/douyin-outfit-content-feed/state.js';

test('keeps filter and scroll independently for each channel', () => {
  let state = createState();
  state = selectFilter(state, '通勤');
  state = selectChannel({ ...state, scrollTop: 640 }, '适合我');
  state = selectFilter(state, '不限性别');
  state = selectChannel({ ...state, scrollTop: 320 }, '按场景');
  assert.equal(state.filterByChannel['按场景'], '通勤');
  assert.equal(state.scrollByChannel['按场景'], 640);
});

test('opens every supported detail type and restores feed context', () => {
  const catalog = createCatalog();
  for (const card of catalog.cards.filter((item) => ['creator', 'collection', 'outfit'].includes(item.type))) {
    const opened = openCard(createState(), card.id, catalog);
    assert.equal(opened.view, `${card.type}-detail`);
    const returned = returnToFeed(opened);
    assert.equal(returned.view, 'feed');
  }
});

test('reactions, hide and undo are observable and reversible', () => {
  let state = toggleReaction(createState(), 'creator-1', 'liked');
  assert.equal(state.reactions['creator-1'].liked, true);
  state = hideCard(state, 'creator-1');
  assert.ok(state.hiddenCardIds.includes('creator-1'));
  state = undoHide(state);
  assert.ok(!state.hiddenCardIds.includes('creator-1'));
});

test('feed status exposes loading, empty, error and ready', () => {
  let state = createState();
  for (const status of ['loading', 'empty', 'error', 'ready']) {
    state = setFeedStatus(state, status);
    assert.equal(state.feedStatus, status);
  }
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `node --test qa/outfit-content-feed-state.test.mjs`

Expected: FAIL because `catalog.js` and `state.js` do not exist.

- [ ] **Step 3: Create neutral catalog fixtures**

Export `createCatalog()` returning:

```js
{
  channels: {
    '按场景': ['推荐', '日常', '通勤', '约会', '出游', '运动', '校园'],
    '适合我': ['不限性别', '男生', '女生', '小个子', '高个子', '梨形', '宽肩', '暖肤色', '冷肤色'],
    '博主推荐': ['精选', '关注', '新锐', '男生穿搭', '女生穿搭']
  },
  cards: [
    { id: 'creator-1', type: 'creator', title: '轻松层次感', reason: '适合需要利落比例的日常造型', authorId: 'author-1', tags: ['日常', '不限性别'], asset: './assets/creator-1.svg' },
    { id: 'collection-1', type: 'collection', title: '一周轻通勤灵感', description: '从简洁层次到柔和配色', count: 8, tags: ['通勤'], asset: './assets/collection-1.svg' },
    { id: 'outfit-1', type: 'outfit', title: '低饱和出游搭配', reason: '颜色克制，适合长时间户外活动', itemCount: 4, tags: ['出游', '男生'], asset: './assets/outfit-1.svg' }
  ]
}
```

Add enough neutral fixtures to render at least twelve mixed cards across all three channel dimensions. Do not add real brands, discounts, sales, reviews, or unsupported prices.

- [ ] **Step 4: Implement pure state transitions**

`createState()` returns channel, filter maps, scroll maps, view, active card, reaction map, following author IDs, hidden IDs, undo payload, and feed status. Every exported transition returns a new object and does not access DOM globals. `openCard` validates the card type before choosing a detail view. `undoHide` only restores the most recently hidden card.

- [ ] **Step 5: Run tests and commit**

Run: `node --test qa/outfit-content-feed-state.test.mjs`

Expected: 4 tests PASS.

```bash
git add work/douyin-outfit-content-feed/catalog.js work/douyin-outfit-content-feed/state.js qa/outfit-content-feed-state.test.mjs
git commit -m "feat: add outfit browsing state model"
```

### Task 3: Build the Mobile Mixed Feed

**Files:**
- Create: `work/douyin-outfit-content-feed/index.html`
- Create: `work/douyin-outfit-content-feed/assets/*.svg`
- Modify: `qa/outfit-content-feed-contract.test.mjs`

- [ ] **Step 1: Add failing static UI checks**

Append tests that assert `index.html` contains:

```js
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
for (const key of ['nav-title', 'channel-scene', 'channel-fit', 'channel-creator', 'featured-theme', 'inspiration-strip', 'mixed-feed', 'bottom-nav-outfit']) {
  assert.match(html, new RegExp(`data-proto-key="${key}"`));
}
assert.match(html, /data-card-type="creator"/);
assert.match(html, /data-card-type="collection"/);
assert.match(html, /data-card-type="outfit"/);
assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}]/u);
assert.doesNotMatch(html, /https?:\/\//);
```

- [ ] **Step 2: Run the contract tests and verify failure**

Run: `node --test qa/outfit-content-feed-contract.test.mjs`

Expected: FAIL with `ENOENT` for `index.html`.

- [ ] **Step 3: Create local visual assets**

Create self-contained SVG assets for twelve content cards plus search, back, more, like, collect, follow, retry, home, outfit, cart, and profile roles. Use abstract editorial silhouettes, clothing shapes, and color blocks; include no text, logos, external fonts, or embedded remote URLs.

- [ ] **Step 4: Implement the feed shell and token system**

In `index.html`, define only the registered ecommerce values: text `#161823/#5C5D65/#8A8B91`, surfaces `#FFFFFF/#F5F6F9`, commerce red `#FF003C`, spacing `0/2/4/8/12/16/20/24/32`, radii `4/8/12/16/20`, and registered font sizes and line heights. Build a fluid 320–430px layout without a device frame, with sticky title/channel/filter areas, featured theme, horizontal collection strip, two-column mixed feed, and bottom navigation.

- [ ] **Step 5: Render catalog data and bind channel/filter switching**

Use `type="module"` scripts to import the catalog and state modules. Render each card with its distinct semantic structure, apply `data-proto-key` values derived from stable IDs, and preserve scroll/filter state per channel. Filtering must produce visible loading and ready states.

- [ ] **Step 6: Run tests and commit**

Run: `node --test qa/outfit-content-feed-state.test.mjs qa/outfit-content-feed-contract.test.mjs`

Expected: all tests PASS.

```bash
git add work/douyin-outfit-content-feed/index.html work/douyin-outfit-content-feed/assets qa/outfit-content-feed-contract.test.mjs
git commit -m "feat: build mixed outfit content feed"
```

### Task 4: Add Details, Feedback, and Recoverable States

**Files:**
- Modify: `work/douyin-outfit-content-feed/index.html`
- Modify: `work/douyin-outfit-content-feed/state.js`
- Modify: `qa/outfit-content-feed-state.test.mjs`
- Modify: `qa/outfit-content-feed-contract.test.mjs`

- [ ] **Step 1: Add failing interaction contract checks**

Assert the HTML contains buttons or handlers for `open-card`, `back-to-feed`, `toggle-like`, `toggle-collect`, `toggle-follow`, `hide-card`, `undo-hide`, `clear-filter`, and `retry-feed`. Assert detail regions exist for `creator-detail`, `collection-detail`, and `outfit-detail`, plus `aria-live="polite"` feedback.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test qa/outfit-content-feed-state.test.mjs qa/outfit-content-feed-contract.test.mjs`

Expected: FAIL on missing interaction actions and detail regions.

- [ ] **Step 3: Implement three detail experiences**

Render creator detail with author, immersive imagery, explanation and related items; collection detail with continuous cards and adjacent collection; outfit detail with styling rationale, audience fit, neutral item list, and secondary commerce action. Every detail must expose a back button and restore the source context.

- [ ] **Step 4: Implement content feedback**

Bind like, collect, follow, hide, and undo actions. Keep reactions consistent across feed and detail. Hide removes the card with a live-region message; undo restores it in its original order. Use a non-modal toast for success and failure feedback.

- [ ] **Step 5: Implement visible state controls**

Add a prototype-only state menu under the existing more button. It must switch the current feed between loading, empty, error, image-failure, and ready states. Empty exposes `clear-filter`; error exposes `retry-feed`; image failure preserves the card ratio and text hierarchy.

- [ ] **Step 6: Run tests and commit**

Run: `node --test qa/outfit-content-feed-state.test.mjs qa/outfit-content-feed-contract.test.mjs`

Expected: all tests PASS.

```bash
git add work/douyin-outfit-content-feed/index.html work/douyin-outfit-content-feed/state.js qa/outfit-content-feed-state.test.mjs qa/outfit-content-feed-contract.test.mjs
git commit -m "feat: add outfit details and feedback states"
```

### Task 5: Add Editable Runtime and Delivery Artifacts

**Files:**
- Modify: `work/douyin-outfit-content-feed/index.html`
- Create: `work/douyin-outfit-content-feed/demo-context.json`
- Create: `work/douyin-outfit-content-feed/design-profile.json`
- Create: `work/douyin-outfit-content-feed/prototype.manifest.json`
- Create: `work/douyin-outfit-content-feed/prototype.patches.json`
- Create: `work/douyin-outfit-content-feed/agent-comments.json`
- Create: `work/douyin-outfit-content-feed/demo-summary.md`
- Create: `work/douyin-outfit-content-feed/assumptions.md`
- Modify: `qa/outfit-content-feed-contract.test.mjs`

- [ ] **Step 1: Add failing delivery contract tests**

Check that every visible editable region has a unique `data-proto-key`; the HTML exposes preview/edit modes, undo, redo, local persistence, patch export, and Agent comment export; JSON artifacts parse successfully; and `demo-context.json` includes `completeness`, `pageUnits`, `visualInventory`, `interactionInventory`, `stateMatrix`, `assumptions`, `openQuestions`, `doNotInfer`, `evidenceSources`, and the full PRD text.

- [ ] **Step 2: Run the tests and verify failure**

Run: `node --test qa/outfit-content-feed-contract.test.mjs`

Expected: FAIL on missing editable controls and delivery files.

- [ ] **Step 3: Add the editable runtime**

Integrate the installed Skill runtime behavior into `index.html`: element selection, text/color/image/visibility/disabled/navigation edits, undo/redo stacks, `localStorage` persistence under a prototype-specific key, JSON patch export, and element-level Agent comment export. Keep all authoring controls hidden in preview mode.

- [ ] **Step 4: Write the delivery artifacts**

Create the manifest and context files from the semantic requirements and actual UI. Initialize patches and comments as schema-valid empty collections. In `assumptions.md`, list neutral demo authors/assets, inferred filters, simulated recommendation effects, and unavailable real commerce data. In `demo-summary.md`, document the three-channel flow, three details, state menu, and edit mode.

- [ ] **Step 5: Run tests and commit**

Run: `node --test qa/outfit-content-feed-state.test.mjs qa/outfit-content-feed-contract.test.mjs`

Expected: all tests PASS.

```bash
git add work/douyin-outfit-content-feed qa/outfit-content-feed-contract.test.mjs
git commit -m "feat: add editable outfit prototype delivery"
```

### Task 6: Browser QA and Skill Quality Gates

**Files:**
- Create: `qa/outfit-content-feed-browser.mjs`
- Modify: `work/douyin-outfit-content-feed/demo-summary.md`

- [ ] **Step 1: Write the browser acceptance script**

The script must open the prototype through a local server and, at 390×844 and 320×700 viewports, use the current entry UI to verify: all three channels switch; each card type opens its detail; back restores channel/filter/scroll; like, collect, follow, hide, and undo visibly change state; loading, empty, error, image-failure, and retry are reachable; edit mode can change and undo a title; and the page has no horizontal overflow, console errors, broken images, or overlapping fixed navigation.

- [ ] **Step 2: Run unit and contract tests**

Run: `node --test qa/outfit-content-feed-state.test.mjs qa/outfit-content-feed-contract.test.mjs`

Expected: all tests PASS.

- [ ] **Step 3: Run browser QA**

Run: `node qa/outfit-content-feed-browser.mjs`

Expected: PASS at both viewports and screenshots written under `qa/evidence/outfit-content-feed/`.

- [ ] **Step 4: Run the installed Skill gates**

Run from `/Users/bytedance/.codex/skills/prd-to-editable-demo`:

```bash
npm test
npm run benchmark
npm run smoke
```

Expected: all three commands exit 0. If an unrelated packaged fixture fails, record the exact failure and do not claim the corresponding gate passed.

- [ ] **Step 5: Record evidence and commit**

Update `demo-summary.md` with commands, viewport results, screenshot paths, known prototype-only data, and any failed gate. Do not call the result high fidelity unless deterministic checks and screenshot review both pass.

```bash
git add qa/outfit-content-feed-browser.mjs qa/evidence/outfit-content-feed work/douyin-outfit-content-feed/demo-summary.md
git commit -m "test: verify outfit content feed prototype"
```

