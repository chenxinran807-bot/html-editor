# Douyin Outfit Tab Interactive Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained high-fidelity mobile HTML prototype covering preference onboarding, personalized outfit discovery, outfit detail, product list, AI styling, and AI try-on.

**Architecture:** A single offline HTML file contains semantic page sections, inline design tokens, inline SVG/CSS visuals, and one centralized JavaScript state object. A small Node verification script parses the HTML as text and asserts required screens, controls, state transitions, and offline constraints without adding runtime dependencies.

**Tech Stack:** HTML5, CSS3, inline SVG, vanilla JavaScript, Node.js built-in test/assert modules.

---

## File Structure

- Create `work/prototype-builder-outfit-tab/index.html`: complete self-contained interactive prototype.
- Create `work/prototype-builder-outfit-tab/verify.mjs`: static contract checks for required screens, interactions, accessibility labels, and offline delivery.
- Create `work/prototype-builder-outfit-tab/README.md`: launch instructions and interaction coverage.

### Task 1: Define the prototype contract

**Files:**
- Create: `work/prototype-builder-outfit-tab/verify.mjs`
- Test: `work/prototype-builder-outfit-tab/verify.mjs`

- [ ] **Step 1: Write the failing contract test**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('./index.html', import.meta.url);
const html = await readFile(htmlPath, 'utf8');

const screens = ['onboarding', 'home', 'detail', 'ai-styling', 'tryon', 'tryon-result'];
for (const screen of screens) {
  assert.match(html, new RegExp(`data-screen=["']${screen}["']`), `missing screen: ${screen}`);
}

const actions = [
  'finish-onboarding', 'open-detail', 'open-products', 'toggle-like',
  'toggle-save', 'mark-dislike', 'generate-look', 'start-tryon',
  'retry-generation', 'add-look-to-cart'
];
for (const action of actions) {
  assert.match(html, new RegExp(`data-action=["']${action}["']`), `missing action: ${action}`);
}

assert.match(html, /const appState\s*=\s*\{/);
assert.match(html, /history\.pushState/);
assert.match(html, /addEventListener\(['"]popstate['"]/);
assert.match(html, /aria-label=/);
assert.doesNotMatch(html, /<script[^>]+src=/);
assert.doesNotMatch(html, /<link[^>]+href=/);
console.log('prototype contract: PASS');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node work/prototype-builder-outfit-tab/verify.mjs`

Expected: FAIL with `ENOENT` because `index.html` does not exist.

- [ ] **Step 3: Commit the contract**

```bash
git add work/prototype-builder-outfit-tab/verify.mjs
git commit -m "test: define outfit prototype contract"
```

### Task 2: Build the responsive screens and visual system

**Files:**
- Create: `work/prototype-builder-outfit-tab/index.html`
- Test: `work/prototype-builder-outfit-tab/verify.mjs`

- [ ] **Step 1: Create the self-contained document shell**

Create a valid HTML5 document with the following required structure:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>抖音商城 · 穿搭灵感</title>
  <style>
    :root {
      --brand: #fe2c55; --ink: #161616; --muted: #666;
      --surface: #fff; --canvas: #f7f7f8; --line: #ececef;
      --success: #19b242; --danger: #f04330;
      --r-card: 16px; --r-sheet: 22px;
      --shadow: 0 12px 36px rgba(0,0,0,.12);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; background: #ececef; color: var(--ink); }
    button, input { font: inherit; }
    .device { width: min(100%, 430px); min-height: 100dvh; margin: 0 auto; background: var(--canvas); position: relative; overflow: hidden; }
    .screen { display: none; min-height: 100dvh; padding-bottom: 78px; }
    .screen.is-active { display: block; animation: enter .24s ease; }
    @keyframes enter { from { opacity: 0; transform: translateY(6px); } }
  </style>
</head>
<body>
  <main class="device" aria-label="抖音商城穿搭原型">
    <section class="screen is-active" data-screen="onboarding"></section>
    <section class="screen" data-screen="home"></section>
    <section class="screen" data-screen="detail"></section>
    <section class="screen" data-screen="ai-styling"></section>
    <section class="screen" data-screen="tryon"></section>
    <section class="screen" data-screen="tryon-result"></section>
  </main>
  <script>const appState = {};</script>
</body>
</html>
```

- [ ] **Step 2: Add complete visual content for all screens**

Implement real Chinese demo copy and reusable CSS classes for:

```html
<button class="tag" data-tag="通勤" aria-pressed="false">通勤</button>
<article class="outfit-card" data-look-id="commute-01">
  <div class="outfit-visual" role="img" aria-label="酒红针织衫搭配高腰深色长裤的通勤穿搭"></div>
  <div class="fit-reason"><b>梨形身材通勤显瘦公式</b><span>短上衣提腰线，深色直筒裤收胯</span></div>
  <button data-action="open-detail">查看搭配详情</button>
</article>
<button data-action="open-products">查看同款 3 件</button>
<button data-action="generate-look">生成 3 套搭配</button>
<button data-action="start-tryon">开始 AI 试穿</button>
<button data-action="retry-generation">重新生成</button>
<button data-action="add-look-to-cart">整套加入购物车</button>
```

Use inline SVG icons for back, search, like, save, cart, close, camera, and share. Use CSS gradients and inline SVG illustration blocks so the file remains offline and does not require remote photography.

- [ ] **Step 3: Run the contract and confirm only behavior checks remain**

Run: `node work/prototype-builder-outfit-tab/verify.mjs`

Expected: FAIL only if an action/state hook required by Task 3 is missing; all screen checks pass.

- [ ] **Step 4: Commit the visual screens**

```bash
git add work/prototype-builder-outfit-tab/index.html
git commit -m "feat: build outfit prototype screens"
```

### Task 3: Implement navigation and interactions

**Files:**
- Modify: `work/prototype-builder-outfit-tab/index.html`
- Test: `work/prototype-builder-outfit-tab/verify.mjs`

- [ ] **Step 1: Add centralized state and screen navigation**

```js
const appState = {
  screen: 'onboarding', previousScreen: null,
  interests: new Set(), channel: '适合我', filter: '通勤',
  liked: new Set(), saved: new Set(), disliked: new Set(),
  productMode: '同款', selectedSize: 'M', cartCount: 0,
  generation: 'idle', scrollPositions: {}
};

function showScreen(name, push = true) {
  appState.scrollPositions[appState.screen] = window.scrollY;
  appState.previousScreen = appState.screen;
  appState.screen = name;
  document.querySelectorAll('[data-screen]').forEach(el => el.classList.toggle('is-active', el.dataset.screen === name));
  if (push) history.pushState({ screen: name }, '', `#${name}`);
  requestAnimationFrame(() => window.scrollTo(0, appState.scrollPositions[name] || 0));
}

addEventListener('popstate', event => showScreen(event.state?.screen || 'home', false));
```

- [ ] **Step 2: Add delegated action handling**

```js
document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'finish-onboarding') showScreen('home');
  if (action === 'open-detail') showScreen('detail');
  if (action === 'open-products') openSheet('product-sheet');
  if (action === 'toggle-like') toggleSet(appState.liked, 'commute-01', event.target.closest('button'));
  if (action === 'toggle-save') toggleSet(appState.saved, 'commute-01', event.target.closest('button'));
  if (action === 'mark-dislike') { appState.disliked.add('commute-01'); showToast('已减少此类推荐', '撤销'); }
  if (action === 'generate-look') runGeneration('ai-styling');
  if (action === 'start-tryon') runGeneration('tryon-result');
  if (action === 'retry-generation') runGeneration(appState.screen === 'tryon' ? 'tryon-result' : 'ai-styling');
  if (action === 'add-look-to-cart') { appState.cartCount += 3; showToast('3 件商品已加入购物车'); }
});
```

- [ ] **Step 3: Implement sheets, Toast, and simulated AI states**

```js
function openSheet(id) { document.getElementById(id).classList.add('is-open'); }
function closeSheet(id) { document.getElementById(id).classList.remove('is-open'); }
function toggleSet(set, id, button) {
  set.has(id) ? set.delete(id) : set.add(id);
  button?.setAttribute('aria-pressed', String(set.has(id)));
}
function showToast(message, undoLabel = '') {
  const toast = document.querySelector('[role="status"]');
  toast.innerHTML = `${message}${undoLabel ? `<button data-action="undo-dislike">${undoLabel}</button>` : ''}`;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}
function runGeneration(destination) {
  appState.generation = 'loading';
  document.querySelector('[data-generation-label]').textContent = '正在分析适配…';
  setTimeout(() => { document.querySelector('[data-generation-label]').textContent = '正在匹配单品…'; }, 650);
  setTimeout(() => { appState.generation = 'success'; showScreen(destination); }, 1500);
}
```

- [ ] **Step 4: Run the contract**

Run: `node work/prototype-builder-outfit-tab/verify.mjs`

Expected: `prototype contract: PASS`

- [ ] **Step 5: Commit the interactions**

```bash
git add work/prototype-builder-outfit-tab/index.html work/prototype-builder-outfit-tab/verify.mjs
git commit -m "feat: add outfit prototype interactions"
```

### Task 4: Document and verify the finished prototype

**Files:**
- Create: `work/prototype-builder-outfit-tab/README.md`
- Modify: `work/prototype-builder-outfit-tab/index.html`
- Test: `work/prototype-builder-outfit-tab/verify.mjs`

- [ ] **Step 1: Add demo documentation**

```markdown
# 抖音商城穿搭 Tab 原型

直接打开 `index.html` 即可离线演示。

## 演示主链路

1. 选择兴趣标签并生成推荐。
2. 在“适合我”首页切换频道和场景筛选。
3. 点开首张穿搭卡，查看适配理由和搭配公式。
4. 打开商品清单，切换同款/平替并选择尺码。
5. 进入 AI 搭配，保留单品并生成方案。
6. 进入 AI 试穿，选择示例照片并查看对比结果。
```

- [ ] **Step 2: Run automated verification**

Run: `node work/prototype-builder-outfit-tab/verify.mjs`

Expected: `prototype contract: PASS`

- [ ] **Step 3: Run HTML hygiene checks**

Run: `rg -n '<script[^>]+src=|<link[^>]+href=|https?://' work/prototype-builder-outfit-tab/index.html`

Expected: no output.

- [ ] **Step 4: Perform manual viewport checks**

Open `work/prototype-builder-outfit-tab/index.html` at widths 390px and 430px. Complete onboarding, detail, product sheet, AI styling, AI try-on, result comparison, back navigation, loading, empty, error, and retry flows. Expected: no clipped primary action, every action gives visible feedback, and returning to home restores the prior channel and scroll position.

- [ ] **Step 5: Commit documentation and final QA fixes**

```bash
git add work/prototype-builder-outfit-tab/index.html work/prototype-builder-outfit-tab/README.md
git commit -m "docs: document outfit prototype demo"
```
