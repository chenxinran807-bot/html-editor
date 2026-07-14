# Dashboard Experiment Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise four-card experiment settings section to the local prototype comparison dashboard.

**Architecture:** The dashboard builder owns one structured `experimentSettings` object and writes it into `data.json`. The generated HTML renders four cards from that object before the cross-input comparison, keeping experiment facts out of duplicated markup and leaving rankings and prototype links unchanged.

**Tech Stack:** Node.js ESM, Node test runner, generated HTML/CSS/JavaScript, Playwright browser assertions.

---

### Task 1: Add failing data and rendering tests

**Files:**
- Modify: `qa/dashboard.test.mjs`

- [ ] **Step 1: Assert the structured experiment settings contract**

Add a test after the twelve-result aggregation test:

```js
test('publishes the concise experiment settings contract', async () => {
  const { data } = await buildFixture();
  assert.deepEqual(data.experimentSettings.map((item) => item.id), [
    'inputs', 'skills', 'execution', 'dimensions',
  ]);
  assert.equal(data.experimentSettings.find((item) => item.id === 'skills').items.length, 6);
  assert.deepEqual(
    data.experimentSettings.find((item) => item.id === 'dimensions').items.map((item) => item.points),
    [20, 15, 20, 15, 10, 10, 10],
  );
});
```

- [ ] **Step 2: Assert the four visible cards and their order**

Extend the existing Chinese-section test with:

```js
for (const label of ['实验设置', '输入', '参测 Skill 及来源', '执行主体与方式', '评分维度']) {
  assert.match(html, new RegExp(label));
}
assert.ok(html.indexOf('实验设置') < html.indexOf('跨输入比较'));
```

Extend the Playwright rendering test with:

```js
assert.equal(await page.locator('.experiment-setting').count(), 4);
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
node --test qa/dashboard.test.mjs
```

Expected: FAIL because `experimentSettings` and `.experiment-setting` do not exist.

### Task 2: Generate and render the experiment settings

**Files:**
- Modify: `scripts/experiment/build-dashboard.mjs`
- Generate: `comparison/native-experiment/data.json`
- Generate: `comparison/native-experiment/index.html`
- Generate: `comparison/native-experiment/report.md`

- [ ] **Step 1: Define the four structured settings groups**

Add an `experimentSettings` constant beside `dimensions` containing these exact groups:

```js
const experimentSettings = [
  {
    id: 'inputs',
    title: '输入',
    items: [
      '穿搭 Tab 迭代方案（飞书 Wiki，已固化为本地输入）',
      'AI 试穿相机上传 PRD（飞书文档，已固化为本地输入）',
    ],
  },
  {
    id: 'skills',
    title: '参测 Skill 及来源',
    items: [
      'Open Design｜本机 Open Design 桌面应用内置能力',
      'huashu-design｜下载到实验环境的本地 Skill 包',
      'prd-generator｜本机 Codex Skills 目录',
      'pm-kakaxi-skills｜本机 Codex Skills 目录；pengmingyu；v2.1.0',
      'vne-prototype｜本机 Codex Skills 目录；v1.0.3',
      'inspire-prototype｜全局 @byted-inspire/prototype-cli 内置 Skill',
    ],
  },
  {
    id: 'execution',
    title: '执行主体与方式',
    items: [
      'Codex 主 Agent：编排、实验约束、汇总与统一验收',
      '独立 Subagent：按一个输入 × 一个 Skill 执行实验任务',
      '12 个隔离单元；按 Skill 原生流程生成；统一固定任务与浏览器验证',
    ],
  },
  {
    id: 'dimensions',
    title: '评分维度',
    items: [
      { label: '需求忠实度', points: 20 },
      { label: '流程覆盖', points: 15 },
      { label: '交互', points: 20 },
      { label: '视觉层级', points: 15 },
      { label: '边界状态', points: 10 },
      { label: '稳定性', points: 10 },
      { label: '交付质量', points: 10 },
    ],
  },
];
```

- [ ] **Step 2: Include the settings in generated data**

Add `experimentSettings` to the top-level `data` object before `summary`.

- [ ] **Step 3: Add the section and renderer**

Insert this section before cross-input comparison:

```html
<section><h2>实验设置</h2><div id="experiment-settings" class="settings-grid"></div></section>
```

Add `.settings-grid`, `.experiment-setting`, `.setting-list`, and `.score-chip` styles using the existing card colors and responsive grid. In the data callback, render four cards from `d.experimentSettings`, formatting dimension objects as `标签 · 分值分` and all other items as escaped text.

- [ ] **Step 4: Regenerate dashboard artifacts**

Run:

```bash
node scripts/experiment/build-dashboard.mjs
```

Expected: `Validated 12/12 results; dashboard written to comparison/native-experiment`.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
node --test qa/dashboard.test.mjs
```

Expected: all dashboard tests pass.

- [ ] **Step 6: Commit the feature**

```bash
git add qa/dashboard.test.mjs scripts/experiment/build-dashboard.mjs comparison/native-experiment docs/superpowers/plans/2026-07-14-dashboard-experiment-settings.md
git commit -m "feat: show experiment settings on dashboard"
```

### Task 3: Verify the complete local dashboard

**Files:**
- Verify: `comparison/native-experiment/index.html`
- Verify: `comparison/native-experiment/data.json`

- [ ] **Step 1: Run the complete experiment QA suite**

Run:

```bash
node --test qa/result-contract.test.mjs qa/native-experiment.test.mjs qa/dashboard.test.mjs
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Verify the live local page**

Open `http://127.0.0.1:8765/comparison/native-experiment/` and assert:

```text
实验设置位于跨输入比较之前
页面包含四张 experiment-setting 卡片
参测 Skill 卡包含六个来源条目
评分卡包含七个维度且总分为 100
现有 11 个“打开原型”入口保持可访问
```

- [ ] **Step 3: Record any verification-only correction as a focused commit**

If live verification exposes a defect, add only the related test and builder change, rerun the complete suite, then commit with:

```bash
git add qa/dashboard.test.mjs scripts/experiment/build-dashboard.mjs comparison/native-experiment
git commit -m "fix: verify dashboard experiment settings"
```
