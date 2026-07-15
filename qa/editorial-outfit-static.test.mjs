import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contextUrl = new URL(
  '../work/editorial-outfit-tab/demo-context.json',
  import.meta.url,
);
const tokensUrl = new URL('../work/editorial-outfit-tab/tokens.css', import.meta.url);
const stylesUrl = new URL('../work/editorial-outfit-tab/styles.css', import.meta.url);

const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function declarations(css) {
  return [...withoutComments(css).matchAll(/([\w-]+)\s*:\s*([^;{}]+)\s*;/g)]
    .map(([, property, value]) => [property.toLowerCase(), value.trim()]);
}

function customProperties(css) {
  return new Map(
    declarations(css).filter(([property]) => property.startsWith('--')),
  );
}

test('visual foundation exposes the approved semantic aliases', async () => {
  const css = withoutComments(await readFile(tokensUrl, 'utf8'));
  const expected = {
    '--text-primary': '#161823',
    '--text-secondary': '#5C5D65',
    '--text-tertiary': '#8A8B91',
    '--text-disabled': '#B9BABD',
    '--text-on-dark': '#FFFFFF',
    '--surface-primary': '#FFFFFF',
    '--surface-subtle': '#F5F6F9',
    '--divider': '#E1E4E8',
    '--brand-primary': '#FF003C',
    '--stroke-divider': '1px',
    '--radius-xs': '4px',
    '--radius-card': '8px',
    '--radius-medium': '12px',
    '--radius-large': '16px',
    '--radius-xl': '20px',
    '--gap-4': '4px',
    '--gap-8': '8px',
    '--gap-12': '12px',
    '--gap-16': '16px',
    '--gap-20': '20px',
    '--gap-24': '24px',
    '--gap-32': '32px',
    '--font-page-title': '20px',
    '--line-page-title': '28px',
    '--font-card-title': '16px',
    '--line-card-title': '22px',
    '--font-body-large': '16px',
    '--line-body-large': '22px',
    '--font-body': '14px',
    '--line-body': '20px',
    '--line-body-multi': '22px',
    '--font-caption': '12px',
    '--line-caption': '17px',
    '--font-price-major': '18px',
    '--line-price-major': '19px',
    '--font-price-minor': '13px',
    '--line-price-minor': '17px',
  };
  assert.deepEqual(Object.fromEntries(customProperties(css)), expected);
});

test('layout styles consume tokens and contain no raw hex colors', async () => {
  const css = withoutComments(await readFile(stylesUrl, 'utf8'));
  assert.match(css, /var\(\s*--text-primary\s*\)/);
  assert.match(css, /var\(\s*--radius-card\s*\)/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
});

test('visual declarations in layout styles use aliases', async () => {
  const css = await readFile(stylesUrl, 'utf8');
  const pureVars = /^(?:var\(\s*--[\w-]+\s*\)(?:\s+|$))+$/i;
  const allowedLiteral = /^(?:0|none|transparent|inherit|initial|unset|auto)$/i;
  const visualProperties = /^(?:color|background-color|border-color|border-(?:top|right|bottom|left)-(?:color|width)|font-size|line-height|gap|row-gap|column-gap|padding(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|border-radius)$/;

  assert.match('var(--gap-4) var(--gap-8)', pureVars);
  assert.doesNotMatch('var(--gap-4) 8px', pureVars);
  assert.doesNotMatch('var(--gap-4, 8px)', pureVars);

  for (const [property, value] of declarations(css)) {
    if (visualProperties.test(property)) {
      assert.ok(pureVars.test(value) || allowedLiteral.test(value), `${property}: ${value} must use only registered aliases`);
    }
  }
});

test('every style alias is declared and var fallbacks are forbidden', async () => {
  const tokens = customProperties(await readFile(tokensUrl, 'utf8'));
  const css = withoutComments(await readFile(stylesUrl, 'utf8'));
  const references = [...css.matchAll(/var\(\s*(--[\w-]+)([^)]*)\)/g)];

  for (const [, name, suffix] of references) {
    assert.equal(suffix.trim(), '', `fallback is forbidden for ${name}`);
    assert.ok(tokens.has(name), `${name} must be declared in tokens.css`);
  }
});

test('styles provide every required visual primitive and state hook', async () => {
  const css = withoutComments(await readFile(stylesUrl, 'utf8'));
  const selectors = [
    '.app-shell', '.app-header', '.channel-tabs', '.feed', '.feature-card',
    '.story-gallery', '.segmented-view', '.product-row', '.checkout-bar',
    '.toast', '.skeleton', '.state-panel--empty', '.state-panel--error',
    '.image-fallback', ':focus-visible',
  ];
  for (const selector of selectors) {
    assert.match(css, new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*(?:,|\\{)`), `missing ${selector}`);
  }
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/);
  assert.match(css, /\.product-row__price-major\s*\{[^}]*font-size:\s*var\(--font-price-major\)[^}]*line-height:\s*var\(--line-price-major\)/s);
  assert.match(css, /\.product-row__price-minor\s*\{[^}]*font-size:\s*var\(--font-price-minor\)[^}]*line-height:\s*var\(--line-price-minor\)/s);
});

test('feed and channel spacing follow component authorization', async () => {
  const css = withoutComments(await readFile(stylesUrl, 'utf8'));
  const channelTabs = css.match(/\.channel-tabs\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.doesNotMatch(channelTabs, /(?:^|;)\s*(?:gap|column-gap|row-gap)\s*:/);
  assert.match(css, /\.feed\s*\{[^}]*column-gap:\s*var\(--gap-4\)/s);
  assert.match(css, /\.story-card\s*\{[^}]*margin-bottom:\s*var\(--gap-4\)/s);
});

test('fixed checkout stays inside the mobile shell and dividers are rendered', async () => {
  const css = withoutComments(await readFile(stylesUrl, 'utf8'));
  const checkout = css.match(/\.checkout-bar\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(checkout, /width:\s*100%\s*;/);
  assert.match(checkout, /max-width:\s*430px\s*;/);
  assert.match(checkout, /margin-inline:\s*auto\s*;/);
  assert.match(checkout, /left:\s*0\s*;/);
  assert.match(checkout, /right:\s*0\s*;/);

  const productRow = css.match(/\.product-row\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(productRow, /border-bottom-style:\s*solid\s*;/);
  assert.match(productRow, /border-bottom-width:\s*var\(--stroke-divider\)\s*;/);
  assert.match(productRow, /border-bottom-color:\s*var\(--divider\)\s*;/);
  assert.match(checkout, /border-top-style:\s*solid\s*;/);
  assert.match(checkout, /border-top-width:\s*var\(--stroke-divider\)\s*;/);
  assert.match(checkout, /border-top-color:\s*var\(--divider\)\s*;/);
});

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
