import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import test from 'node:test';

const contextUrl = new URL(
  '../work/editorial-outfit-tab/demo-context.json',
  import.meta.url,
);
const tokensUrl = new URL('../work/editorial-outfit-tab/tokens.css', import.meta.url);
const stylesUrl = new URL('../work/editorial-outfit-tab/styles.css', import.meta.url);
const indexUrl = new URL('../work/editorial-outfit-tab/index.html', import.meta.url);
const appUrl = new URL('../work/editorial-outfit-tab/app.mjs', import.meta.url);
const renderUrl = new URL('../work/editorial-outfit-tab/render.mjs', import.meta.url);
const catalogUrl = new URL('../work/editorial-outfit-tab/catalog.mjs', import.meta.url);

const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('catalog uses local SVG artwork and every referenced asset exists', async () => {
  const { stories, feedEntriesByChannel } = await import(catalogUrl);
  const references = stories.flatMap((story) => [
    story.image,
    ...story.gallery,
    ...story.products.map((product) => product.image),
  ]);
  for (const entry of feedEntriesByChannel['精选']) {
    if (entry.type === 'feature') references.push(entry.image);
  }
  assert.ok(references.length > 0);
  for (const reference of references) {
    assert.match(reference, /^\.\/assets\/[\w-]+\.svg$/);
    await access(new URL(`../work/editorial-outfit-tab/${reference.slice(2)}`, import.meta.url));
  }
});

test('catalog maps product semantics to artwork and varies story galleries', async () => {
  const { productAssetFor, stories, feedEntriesByChannel } = await import(catalogUrl);
  assert.equal(productAssetFor('外套', '轻量长风衣'), './assets/product-1.svg');
  assert.equal(productAssetFor('上装', '宽松棉质衬衫'), './assets/product-4.svg');
  assert.equal(productAssetFor('下装', '垂感长裙'), './assets/product-5.svg');
  assert.equal(productAssetFor('下装', '直筒长裤'), './assets/product-2.svg');
  assert.equal(productAssetFor('鞋', '方头便鞋'), './assets/product-3.svg');
  assert.equal(productAssetFor('包', '小号托特包'), './assets/product-6.svg');
  for (const story of stories) {
    assert.equal(story.gallery[0], story.image, `${story.id} gallery must lead with its look`);
    for (const product of story.products) {
      assert.equal(product.image, productAssetFor(product.category, product.title));
    }
  }
  assert.ok(new Set(stories.map((story) => story.gallery.join('|'))).size >= 3);
  const feature = feedEntriesByChannel['精选'].find((entry) => entry.type === 'feature');
  assert.equal(feature.image, './assets/weekly-city-edit.svg');
  assert.notEqual(feature.image, stories[0].image);
});

test('rendered UI gives all visible components semantic classes', async () => {
  const source = await readFile(renderUrl, 'utf8');
  for (const className of [
    'story-card__open', 'story-card__label', 'story-card__meta', 'save-button',
    'detail-header', 'detail-action', 'story-detail__intro', 'story-detail__tips',
    'story-detail__topics', 'outfit-summary__content', 'product-row__select',
    'product-row__content', 'product-row__spec', 'product-row__status',
    'checkout-bar__count', 'checkout-bar__total', 'checkout-bar__cta',
  ]) assert.match(source, new RegExp(`class=["'][^"']*${className}`), `missing ${className}`);

  const html = await readFile(indexUrl, 'utf8');
  for (const className of ['search-action', 'prototype-state', 'prototype-state__select', 'bottom-nav', 'bottom-nav__item']) {
    assert.match(html, new RegExp(`class=["'][^"']*${className}`), `missing ${className}`);
  }
});

function declarations(css) {
  return [...withoutComments(css).matchAll(/([\w-]+)\s*:\s*([^;{}]+)\s*;/g)]
    .map(([, property, value]) => [property.toLowerCase(), value.trim()]);
}

function customProperties(css) {
  return new Map(
    declarations(css).filter(([property]) => property.startsWith('--')),
  );
}

test('HTML exposes stable semantic feed and detail shells', async () => {
  const html = await readFile(indexUrl, 'utf8').catch(() => '');
  for (const pattern of [
    /<header\b/i, /<nav\b/i, /<main\b/i,
    /data-screen="feed"/, /data-screen="detail"/,
    /data-detail-view="story"/, /data-detail-view="products"/,
    /aria-live="polite"/, /<script\s+type="module"\s+src="\.\/app\.mjs"/,
    /<button[^>]+aria-current="page"/,
  ]) assert.match(html, pattern);
  assert.match(html, /<link[^>]+href="\.\/tokens\.css"/);
  assert.match(html, /<link[^>]+href="\.\/styles\.css"/);

  const buttons = [...html.matchAll(/<button\b[^>]*>/gi)].map(([tag]) => tag);
  assert.ok(buttons.length > 0);
  for (const button of buttons) {
    assert.match(button, /\bdata-action="[^"]+"|\brole="tab"/i, `dead static control: ${button}`);
  }
});

test('app uses the required delegated action vocabulary', async () => {
  const source = await readFile(appUrl, 'utf8').catch(() => '');
  for (const action of ['set-channel', 'open-story', 'close-story', 'toggle-save', 'set-detail-view']) {
    assert.match(source, new RegExp(`data-action[^\\n]*${action}|${action}`));
  }
  assert.match(source, /addEventListener\(\s*['"]click['"]/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /window\.scrollY/);
  assert.match(source, /window\.scrollTo\(\s*\{/);
  assert.match(source, /behavior:\s*['"]auto['"]/);
  assert.doesNotMatch(source, /feedScreen\.scrollTop|#feed-scroller/);
  assert.match(source, /share-story/);
  assert.match(source, /分享功能为原型演示/);
  assert.match(source, /prototype-search/);
  assert.match(source, /搜索功能为原型演示/);
  assert.match(source, /prototype-nav/);
  assert.match(source, /该导航为原型演示/);
  assert.match(source, /replaceWith/);
  assert.match(source, /role:\s*['"]img['"]/);
  assert.match(source, /aria-label/);
  assert.match(source, /detailContent\.innerHTML\s*=\s*state\.detailView\s*===\s*['"]story['"]/);
  assert.doesNotMatch(source, /storyView\.innerHTML|productsView\.innerHTML/);
  assert.match(source, /clearTimeout\(toastTimer\)/);
  assert.match(source, /setTimeout\([^]*TOAST_DURATION_MS\)/);
  assert.match(source, /TOAST_DURATION_MS\s*=\s*(?:1[6-9]\d{2}|2000)/);
  assert.match(source, /toastTimer\s*=\s*null/);
  assert.match(source, /action === ['"]toggle-save['"][^]*state\.screen === ['"]feed['"][^]*rememberFeedScroll\(\)[^]*toggleSave/s);
  assert.match(source, /focus\(\{\s*preventScroll:\s*true\s*\}\)/);
  assert.match(source, /data-story-id/);
  for (const action of ['toggle-product', 'choose-spec', 'buy-selection', 'retry-feed', 'return-featured']) {
    assert.match(source, new RegExp(action), `missing ${action} action`);
  }
  assert.match(source, /addEventListener\(\s*['"]change['"]/);
  assert.match(source, /已确认购买整套（原型）/);
  assert.match(source, /已确认购买已选商品（原型）/);
  assert.match(source, /status:\s*productIndex\s*===\s*0[\s\S]{0,160}spec:\s*productIndex\s*===\s*0\s*\?\s*['"]{2}/, 'partial fixture must expose the unresolved-spec path');
  assert.match(source, /pendingProductFocus/);
  assert.match(source, /data-action[^]*data-product-id[^]*focus\(\{\s*preventScroll:\s*true\s*\}\)/);
});

test('HTML exposes a non-blocking prototype edge-state chooser with exact fixture values', async () => {
  const html = await readFile(indexUrl, 'utf8').catch(() => '');
  assert.match(html, /<details[^>]*>[\s\S]*原型状态[\s\S]*<select[^>]+data-action="set-prototype-state"/);
  for (const value of ['normal', 'loading', 'empty', 'error', 'broken-image', 'partial-sold-out', 'all-unavailable']) {
    assert.match(html, new RegExp(`<option\\s+value=["']${value}["']`));
  }
});

test('render module exports the feed, detail and stable state renderers', async () => {
  const source = await readFile(renderUrl, 'utf8').catch(() => '');
  for (const name of ['renderChannelTabs', 'renderFeed', 'renderStory', 'renderProducts', 'renderSkeleton', 'renderDetailSkeleton', 'renderDetailError', 'renderEmpty', 'renderError']) {
    assert.match(source, new RegExp(`export\\s+(?:const|function)\\s+${name}\\b`));
  }
  const render = await import(renderUrl);
  assert.deepEqual(Object.keys(render).sort(), [
    'renderChannelTabs', 'renderDetailError', 'renderDetailSkeleton', 'renderEmpty',
    'renderError', 'renderFeed', 'renderProducts', 'renderSkeleton', 'renderStory',
  ]);
});

test('renderers escape fixture content and expose accessible selected states', async () => {
  const render = await import(renderUrl);
  const fixture = {
    id: 'fixture-story', title: '<img src=x onerror=alert(1)>', editorialLabel: '编辑精选',
    savedCountLabel: '灵感收藏', image: '" onerror="alert(1)', gallery: [], intro: '<b>intro</b>',
    tips: ['<script>bad</script>'], topics: ['"topic'], products: [],
  };
  const feed = render.renderFeed([{ type: 'story', storyId: fixture.id }], [fixture], ['fixture-story']);
  assert.doesNotMatch(feed, /<script>|<img src=x/);
  assert.match(feed, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(feed, /aria-pressed="true"/);
  assert.match(feed, /<a[^>]+href="#fixture-story"[^>]+data-action="open-story"[^>]+data-story-id="fixture-story"/);
  assert.match(feed, /<a[^>]*>[\s\S]*story-card__title[\s\S]*story-card__meta[\s\S]*<\/a>[\s\S]*<button[^>]+data-action="toggle-save"/);
  assert.doesNotMatch(feed, /<a[^>]*>[\s\S]*<button[^>]+data-action="toggle-save"[\s\S]*<\/a>/);

  const tabs = render.renderChannelTabs(['精选', '通勤'], '通勤');
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /data-channel="通勤"[^>]*aria-selected="true"/);

  const story = render.renderStory(fixture, true, 'story');
  assert.match(story, /role="tablist"/);
  assert.match(story, /role="tab"[^>]*aria-selected="true"/);
  assert.match(story, /role="tabpanel"/);
  assert.match(story, /aria-pressed="true"/);
  assert.equal((story.match(/role="tabpanel"/g) ?? []).length, 1);
  const storyIds = [...story.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(storyIds).size, storyIds.length);

  const products = render.renderProducts(fixture, 'products');
  assert.equal((products.match(/role="tabpanel"/g) ?? []).length, 1);
  const productIds = [...products.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(productIds).size, productIds.length);
  assert.match(products, /aria-controls="detail-panel-products"/);
  assert.doesNotMatch(products, /id="detail-panel-story"/);

  const feature = render.renderFeed([{ type: 'feature', id: 'f', title: '专题', image: './f.jpg' }], [], []);
  assert.match(feature, /feature-card/);
});

test('product renderer exposes safe selection, specs, prices, availability and checkout semantics', async () => {
  const { renderProducts } = await import(renderUrl);
  const fixture = {
    id: 'fixture', title: '<造型>', image: './look.jpg', priceNote: '参考价格', products: [
      { id: 'available', category: '上装', title: '<衬衫>', spec: '', image: './a.jpg', status: 'available', priceFen: 26905 },
      { id: 'sold', category: '鞋', title: '便鞋', spec: '黑色 38', image: './b.jpg', status: 'sold-out', priceFen: 45900 },
      { id: 'invalid', category: '包', title: '旧款包', spec: '棕色', image: './c.jpg', status: 'invalid', priceFen: Number.NaN },
    ],
  };
  const html = renderProducts(fixture, 'products', {
    selectedProductIds: ['available'],
    resolvedSpecProductIds: [],
  });
  assert.match(html, /当前造型/);
  assert.match(html, /data-action="toggle-product"[^>]+type="checkbox"[^>]+checked/);
  assert.match(html, /data-product-id="sold"[^>]+disabled/);
  assert.match(html, /已售罄/);
  assert.match(html, /已失效/);
  assert.match(html, /请选择规格/);
  assert.match(html, /data-action="choose-spec"/);
  assert.match(html, /product-row__price-major[^>]*>269</);
  assert.match(html, /product-row__price-minor[^>]*>\.05</);
  assert.doesNotMatch(html, /NaN|Infinity|<衬衫>|<造型>/);
  assert.match(html, /class="checkout-bar"/);
  assert.match(html, /已选 1 件/);
  assert.match(html, /data-action="buy-selection"/);
  assert.match(html, /data-action="buy-selection"[^>]+disabled[^>]+aria-describedby="unresolved-spec-message"/);
  assert.match(html, /id="unresolved-spec-message"/);

  const resolved = renderProducts(fixture, 'products', {
    selectedProductIds: ['available'],
    resolvedSpecProductIds: ['available'],
  });
  assert.match(resolved, /data-action="buy-selection"(?![^>]+disabled)[^>]*>/);
  assert.doesNotMatch(resolved, /id="unresolved-spec-message"/);
});

test('edge-state renderers expose retry and return-featured actions', async () => {
  const render = await import(renderUrl);
  assert.match(render.renderEmpty(), /data-action="return-featured"/);
  assert.match(render.renderError(), /data-action="retry-feed"/);
  assert.match(render.renderSkeleton(), /aria-busy="true"/);
  assert.match(render.renderDetailSkeleton('story'), /aria-label="穿搭故事加载中"/);
  assert.match(render.renderDetailSkeleton('products'), /aria-label="整套商品加载中"/);
  assert.match(render.renderDetailError('story'), /穿搭故事暂时无法加载/);
  assert.match(render.renderDetailError('products'), /商品数据暂时无法加载/);
  assert.match(render.renderDetailError('products'), /data-action="retry-detail"/);
});

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
  assert.match(productRow, /grid-template-columns:\s*auto\s+minmax\(0,\s*72px\)\s+minmax\(0,\s*1fr\)\s+auto\s*;/);
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
