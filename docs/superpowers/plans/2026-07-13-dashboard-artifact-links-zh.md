# 看板 Artifact 链接与中文化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除看板证据画廊，按两份输入直接展示 12 个实验的 Artifact 链接，并将可见界面标签统一为中文。

**Architecture:** 保留 `result.json → build-dashboard.mjs → data.json/index.html` 的现有生成链。测试先约束中文标签、画廊删除和 Artifact 链接完整性，再修改生成器并重新生成静态看板；实验结果和排序逻辑保持不变。

**Tech Stack:** Node.js、原生 HTML/CSS/JavaScript、Node Test Runner、本机静态服务器。

---

## 文件结构

- 修改 `qa/dashboard.test.mjs`：定义中文界面、无证据画廊和 Artifact 链接的回归要求。
- 修改 `scripts/experiment/build-dashboard.mjs`：删除画廊聚合和渲染，生成中文页面与按输入分组的 Artifact 卡片。
- 重新生成 `comparison/native-experiment/data.json`：删除顶层 `gallery` 数据，保留结果中的 evidence 审计路径。
- 重新生成 `comparison/native-experiment/index.html`：应用中文标签和新的 Artifact 展示。

### Task 1：用测试锁定中文看板与 Artifact 入口

**Files:**
- Modify: `qa/dashboard.test.mjs`

- [ ] **Step 1: 修改看板测试**

在现有发布测试中断言：

```js
for (const label of ['原型能力实验对比', '相机上传排名', '穿搭 Tab 排名', '原型产物', '原生流程偏离', '跨输入比较', '适用性']) {
  assert.match(html, new RegExp(label));
}
assert.doesNotMatch(html, /证据画廊|id="gallery"|class="gallery"/);
assert.equal(Object.hasOwn(data, 'gallery'), false);
assert.equal(data.results.length, 12);
for (const row of data.results) {
  assert.match(html, new RegExp(row.skillId));
}
for (const status of ['通过，但有关注项', '已阻断']) {
  assert.match(html, new RegExp(status));
}
```

同时遍历有产物记录，检查所有存在的本地 Artifact 使用 `../../` 相对路径且不包含反斜线。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test qa/dashboard.test.mjs`

Expected: FAIL，原因包含旧页面仍有“证据画廊”、英文标签或 `data.gallery`。

- [ ] **Step 3: 提交测试红灯不单独提交**

测试与最小实现同一次提交，避免分支停留在已知失败状态。

### Task 2：实现中文页面和 Artifact 分组

**Files:**
- Modify: `scripts/experiment/build-dashboard.mjs`
- Generate: `comparison/native-experiment/data.json`
- Generate: `comparison/native-experiment/index.html`

- [ ] **Step 1: 删除画廊数据聚合**

删除 `gallery` 的构造和 `data.gallery` 字段，但保留每条 result 中的 `evidence`，确保报告和审计能力不变。

- [ ] **Step 2: 增加中文映射**

在生成的页面脚本中加入：

```js
const 输入名称 = { 'outfit-tab': '穿搭 Tab', 'camera-upload': '相机上传' };
const 状态名称 = {
  PASS: '通过',
  PASS_WITH_CONCERNS: '通过，但有关注项',
  BLOCKED: '已阻断',
  NOT_APPLICABLE: '不适用',
};
const 维度名称 = {
  fidelity: '需求忠实度', flowCoverage: '核心流程覆盖', interaction: '交互真实性',
  visualHierarchy: '视觉与信息层级', edgeStates: '异常与边界状态',
  stability: '运行稳定性', handoff: '交付与迭代能力',
};
```

所有标题、表头、状态、按钮和缺失提示均通过这些中文名称渲染。

- [ ] **Step 3: 按输入展示 Artifact 卡片**

每个结果渲染一张卡片，包含技能正式名称、中文状态、总分，以及所有存在的 Artifact 按钮：

```js
const links = row.artifacts.filter(item => item.exists).map((item, index) =>
  '<a class="artifact-link" href="' + esc(item.href) + '">打开产物' + (row.artifacts.length > 1 ? ' ' + (index + 1) : '') + '</a>'
).join('');
```

没有可用 Artifact 时显示“暂无可打开产物”，不生成链接。

- [ ] **Step 4: 重建并运行测试**

Run:

```bash
node scripts/experiment/build-dashboard.mjs
node --test qa/dashboard.test.mjs
node --test qa/result-contract.test.mjs qa/native-experiment.test.mjs qa/dashboard.test.mjs
```

Expected: 看板测试通过；完整测试 23/23 通过。

- [ ] **Step 5: 本机浏览器验收**

打开 `http://127.0.0.1:8765/comparison/native-experiment/`，确认：

- 没有证据图片网格；
- 12 个实验均有 Artifact 卡片；
- 可用 Artifact 链接可打开；
- 可见栏目、状态和操作全部为中文；
- 排名和分数与修改前一致。

- [ ] **Step 6: 提交**

```bash
git add qa/dashboard.test.mjs scripts/experiment/build-dashboard.mjs comparison/native-experiment/data.json comparison/native-experiment/index.html docs/superpowers/plans/2026-07-13-dashboard-artifact-links-zh.md
git commit -m "feat: localize artifact dashboard"
```
