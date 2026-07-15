import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = 'work/douyin-outfit-content-feed';

const acceptedStatements = [
  '# 抖音商城独立端穿搭 Tab',
  '首要目标是提升穿搭内容浏览时长和连续浏览意愿。',
  '页面面向男女混合用户，覆盖更多风格与场景。',
  '页面采用真人穿搭、主题合集与商品搭配混排的内容流。',
  '二级结构采用三个平行 Tab：按场景、适合我、博主推荐。',
  '用户可以喜欢、收藏、关注，也可以标记不感兴趣并撤销。',
  '用户可以进入真人穿搭详情、主题合集详情和商品搭配详情，返回后恢复频道、筛选和滚动位置。',
  '页面覆盖加载、空内容、加载失败、图片失败和重试状态。',
];

test('freezes the accepted outfit content feed requirements', async () => {
  const [prd, semanticRequirementsSource] = await Promise.all([
    readFile(`${root}/prd.md`, 'utf8'),
    readFile(`${root}/semantic-requirements.json`, 'utf8'),
  ]);
  const requirements = JSON.parse(semanticRequirementsSource);

  assert.equal(requirements.schemaVersion, 1);
  assert.equal(requirements.confidence, 'high');

  assert.equal(requirements.extractionMode, 'model-semantic');
  assert.deepEqual(requirements.screens, [
    '穿搭内容流',
    '真人穿搭详情',
    '主题合集详情',
    '商品搭配详情',
  ]);

  for (const statement of acceptedStatements) {
    assert.ok(prd.includes(statement), `accepted statement missing: ${statement}`);
  }

  const evidenceById = new Map(requirements.evidence.map((item) => [item.id, item]));
  for (const item of requirements.evidence) {
    assert.ok(prd.includes(item.quote), `evidence quote not found verbatim: ${item.quote}`);
  }

  assert.deepEqual(requirements.businessObjects.map(({ name }) => name), [
    '真人穿搭',
    '主题合集',
    '商品搭配',
  ]);
  for (const object of requirements.businessObjects) {
    const evidence = evidenceById.get(object.evidenceId);
    assert.ok(evidence, `business object lacks linked evidence: ${object.name}`);
    assert.ok(evidence.quote.includes(object.name), `business object evidence mismatches term: ${object.name}`);
  }

  const actionTerms = new Map([
    ['喜欢', ['喜欢']],
    ['收藏', ['收藏']],
    ['关注', ['关注']],
    ['标记不感兴趣', ['标记不感兴趣']],
    ['撤销不感兴趣', ['不感兴趣', '撤销']],
    ['进入真人穿搭详情', ['进入', '真人穿搭详情']],
    ['进入主题合集详情', ['进入', '主题合集详情']],
    ['进入商品搭配详情', ['进入', '商品搭配详情']],
    ['返回内容流并恢复状态', ['返回', '恢复']],
    ['失败后重试', ['失败', '重试']],
  ]);
  assert.deepEqual(requirements.userActions.map(({ name }) => name), [...actionTerms.keys()]);
  for (const action of requirements.userActions) {
    const evidence = evidenceById.get(action.evidenceId);
    assert.ok(evidence, `user action lacks linked evidence: ${action.name}`);
    for (const term of actionTerms.get(action.name)) {
      assert.ok(evidence.quote.includes(term), `user action evidence mismatches term: ${action.name} / ${term}`);
    }
  }

  assert.ok(Object.keys(requirements.pageContent).length > 0, 'pageContent must be non-empty');
  assert.deepEqual(requirements.pageContent.feed, ['真人穿搭', '主题合集', '商品搭配']);
  assert.deepEqual(requirements.pageContent.states, ['加载', '空内容', '加载失败', '图片失败', '重试']);
  for (const contentType of requirements.pageContent.feed) {
    assert.ok(evidenceById.get('content-mix').quote.includes(contentType), `feed item lacks verbatim evidence: ${contentType}`);
  }
  for (const state of requirements.pageContent.states) {
    assert.ok(evidenceById.get('page-states').quote.includes(state), `page state lacks verbatim evidence: ${state}`);
  }

  assert.ok(Object.keys(requirements.informationArchitecture).length > 0, 'informationArchitecture must be non-empty');
  assert.deepEqual(requirements.informationArchitecture.secondaryTabs, ['按场景', '适合我', '博主推荐']);
  assert.equal(requirements.informationArchitecture.relationship, 'parallel');
  for (const tab of requirements.informationArchitecture.secondaryTabs) {
    assert.ok(evidenceById.get('secondary-tabs').quote.includes(tab), `IA tab lacks verbatim evidence: ${tab}`);
  }

  assert.equal(requirements.transitions.length * 2, 6, 'three open and three return transitions are required');
  for (const transition of requirements.transitions) {
    assert.equal(transition.from, '穿搭内容流');
    assert.ok(requirements.screens.includes(transition.to), `unknown detail destination: ${transition.to}`);
    assert.ok(transition.action.startsWith('打开'));
    assert.equal(transition.return, '恢复频道、筛选和滚动位置');
    assert.ok(evidenceById.get('detail-navigation').quote.includes(transition.to));
    for (const restoredState of ['频道', '筛选', '滚动位置']) {
      assert.ok(evidenceById.get('detail-navigation').quote.includes(restoredState));
    }
  }

  assert.ok(requirements.assumptions.length > 0);
  assert.ok(requirements.assumptions.some((item) => item.includes('演示内容')));
  assert.ok(requirements.assumptions.every((item) => prd.includes(item)), 'assumptions must be verbatim in the PRD');
  assert.ok(requirements.gaps.length > 0);
  assert.ok(requirements.gaps.some((item) => item.includes('真实商品')));
  assert.ok(requirements.gaps.every((item) => prd.includes(item)), 'gaps must be verbatim in the PRD');
});
