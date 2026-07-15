import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contextUrl = new URL(
  '../work/editorial-outfit-tab/demo-context.json',
  import.meta.url,
);

test('locks the approved editorial outfit demo context', async () => {
  const context = JSON.parse(await readFile(contextUrl, 'utf8'));

  assert.equal(context.mode, 'fast');
  assert.equal(context.product_goal, 'editorial-browse-and-save');
  assert.deepEqual(context.confirmed_choices, {
    content: 'editorial-image-and-text',
    visual_direction: 'light-community-feed',
    card_structure: 'image-first',
    detail: 'story-detail',
    commerce: 'story-product-dual-view',
  });
  assert.deepEqual(context.completeness, {
    visual: 'medium',
    interaction: 'high',
    state: 'high',
    semantic: 'high',
  });
  assert.deepEqual(context.page_units, [
    { id: 'P-01', name: '穿搭首页', type: 'feed', source: '用户确认', confidence: 'high', evidence_source_id: 'E-01' },
    { id: 'P-02', name: '编辑专题卡', type: 'editorial-feature', source: '设计方案', confidence: 'high', evidence_source_id: 'E-02' },
    { id: 'P-03', name: '图文故事详情', type: 'story-detail', source: '用户确认', confidence: 'high', evidence_source_id: 'E-01' },
    { id: 'P-04', name: '整套商品视图', type: 'commerce-view', source: '用户确认', confidence: 'high', evidence_source_id: 'E-01' },
  ]);
  assert.deepEqual(context.interaction_inventory, [
    { id: 'I-01', trigger: '点击场景频道', behavior: '切换瀑布流并保存各频道位置', source: '设计方案', confidence: 'high', evidence_source_id: 'E-02' },
    { id: 'I-02', trigger: '点击穿搭卡', behavior: '进入图文故事详情', source: '用户确认', confidence: 'high', evidence_source_id: 'E-01' },
    { id: 'I-03', trigger: '点击双视图标签', behavior: '在故事与整套商品间切换', source: '用户确认', confidence: 'high', evidence_source_id: 'E-01' },
    { id: 'I-04', trigger: '点击收藏', behavior: '同步首页与详情收藏状态', source: '设计方案', confidence: 'high', evidence_source_id: 'E-02' },
    { id: 'I-05', trigger: '选择或取消商品', behavior: '更新件数、合计与购买文案', source: '设计方案', confidence: 'high', evidence_source_id: 'E-02' },
  ]);
  assert.deepEqual(context.state_matrix, [
    { key: 'normal', label: '正常态', must_have: ['内容可浏览', '核心交互可用'] },
    { key: 'empty', label: '空态', must_have: ['空态说明', '返回精选入口'] },
    { key: 'loading', label: '加载态', must_have: ['稳定骨架', '布局不跳动'] },
    { key: 'error', label: '错误态', must_have: ['错误说明', '重试操作'] },
    { key: 'boundary', label: '边界态', must_have: ['长文案截断', '售罄与零选择处理'] },
  ]);
  assert.deepEqual(context.open_questions, [
    { id: 'Q-01', question: '正式商品数据、库存和价格来自哪个接口？', impact: '影响生产化数据接入，不阻塞静态原型', blocking_level: 'soft' },
    { id: 'Q-02', question: '穿搭 Tab 在正式底部导航中的具体位置与图标是什么？', impact: '影响导航最终视觉，不阻塞独立页面原型', blocking_level: 'soft' },
  ]);
  assert.deepEqual(context.do_not_infer, [
    '不编造真实销量、评价、折扣或最低价',
    '不把编辑精选伪装成普通用户 UGC',
    '不实现真实支付、登录或购物车接口',
    '不宣称无设计稿情况下已完成像素级还原',
  ]);
  assert.deepEqual(context.evidence_sources, [
    { id: 'E-01', type: '用户补充', scope: '目标、内容形态、视觉方向、卡片结构、详情形态与商品承接' },
    { id: 'E-02', type: '默认推断', scope: '频道集合、专题插卡频率、状态覆盖与滚动恢复' },
  ]);

  const allIds = [
    context.page_units.map(({ id }) => id),
    context.interaction_inventory.map(({ id }) => id),
    context.open_questions.map(({ id }) => id),
    context.evidence_sources.map(({ id }) => id),
    context.state_matrix.map(({ key }) => key),
  ].flat();
  assert.equal(
    new Set(allIds).size,
    allIds.length,
    `duplicate IDs: ${allIds.join(', ')}`,
  );

  const evidenceIds = new Set(context.evidence_sources.map(({ id }) => id));
  const sourceToEvidenceId = { 用户确认: 'E-01', 设计方案: 'E-02' };
  for (const item of [...context.page_units, ...context.interaction_inventory]) {
    assert.ok(evidenceIds.has(item.evidence_source_id));
    assert.equal(item.evidence_source_id, sourceToEvidenceId[item.source]);
  }
});
