(() => {

'use strict';

const channels = ['精选', '通勤', '约会', '周末', '显高'];

const productAssetFor = (category, title) => {
  if (category === '外套') return './assets/product-1.svg';
  if (category === '上装') return './assets/product-4.svg';
  if (category === '鞋') return './assets/product-3.svg';
  if (category === '包') return './assets/product-6.svg';
  if (category === '下装' && title.includes('裙')) return './assets/product-5.svg';
  if (category === '下装') return './assets/product-2.svg';
  throw new TypeError(`未知商品品类：${category}`);
};

const product = (storyId, number, category, title, spec, priceFen, status = 'available') => ({
  id: `${storyId}-p${number}`,
  category,
  title,
  spec,
  priceFen,
  image: productAssetFor(category, title),
  status,
});

const detailArt = ['./assets/detail-fabric.svg', './assets/detail-silhouette.svg', './assets/detail-accessory.svg'];
let storyNumber = 0;
const story = (id, storyChannels, title, intro, tips, topics, products) => {
  const image = `./assets/${id}.svg`;
  const offset = storyNumber++ % detailArt.length;
  return ({
  id,
  channels: storyChannels,
  title,
  editorialLabel: '编辑精选',
  savedCountLabel: '灵感收藏',
  image,
  gallery: [image, detailArt[offset], detailArt[(offset + 1) % detailArt.length]],
  intro,
  tips,
  topics,
  priceNote: '价格仅为原型演示参考',
  products,
  });
};

const stories = [
  story('city-trench', ['精选', '通勤'], '一件风衣的三种城市穿法', '从清晨通勤到傍晚散步，用轻薄层次连接一天的不同场景。', ['内搭保持同色系', '裤脚留出利落线条', '用小包收束比例'], ['城市通勤', '轻层次'], [
    product('city-trench', 1, '外套', '轻量长风衣', '燕麦色 M', 69900),
    product('city-trench', 2, '下装', '直筒长裤', '深灰 M', 32900),
    product('city-trench', 3, '鞋', '方头便鞋', '黑色 38', 45900, 'sold-out'),
  ]),
  story('blue-shirt', ['精选', '通勤', '显高'], '蓝衬衫与高腰线的清爽组合', '用明确的腰线和松紧对比，整理日常衬衫的穿着节奏。', ['前摆轻收进腰头', '袖口卷至手腕上方'], ['清爽通勤', '比例灵感'], [
    product('blue-shirt', 1, '上装', '宽松棉质衬衫', '雾蓝 M', 26900),
    product('blue-shirt', 2, '下装', '高腰阔腿裤', '米白 M', 35900),
  ]),
  story('soft-dinner', ['精选', '约会'], '柔和晚餐色调穿搭', '低饱和色彩让针织与长裙自然衔接，适合从日落到晚餐的场景。', ['上短下长保持轻盈', '饰品选择哑光质感'], ['晚餐约会', '柔和配色'], [
    product('soft-dinner', 1, '上装', '细针织开衫', '浅杏 S', 29900),
    product('soft-dinner', 2, '下装', '垂感长裙', '灰粉 S', 39900),
  ]),
  story('park-denim', ['精选', '周末'], '周末公园里的牛仔层次', '耐看的牛仔与棉质单品，适合步行和短暂停留。', ['深浅牛仔错开', '内搭露出少量白色'], ['周末散步', '牛仔层次'], [
    product('park-denim', 1, '外套', '短款牛仔夹克', '水洗蓝 M', 42900),
    product('park-denim', 2, '上装', '基础圆领衫', '白色 M', 12900),
  ]),
  story('long-line', ['精选', '显高'], '长线条外套的比例练习', '纵向开襟和接近的内搭色彩，让整体轮廓更连贯。', ['外套敞开形成纵线', '鞋裤选择相近颜色'], ['长线条', '日常比例'], [
    product('long-line', 1, '外套', '直线型长外套', '炭灰 M', 75900),
    product('long-line', 2, '下装', '窄直筒长裤', '深灰 M', 34900),
  ]),
  story('linen-morning', ['精选', '通勤'], '亚麻早晨的自然叠穿', '柔软肌理与简洁剪裁组合，为温暖天气保留呼吸感。', ['领口保持简洁', '包袋选择硬挺轮廓'], ['暖日通勤', '自然肌理'], [
    product('linen-morning', 1, '上装', '亚麻混纺衬衣', '米色 M', 31900),
    product('linen-morning', 2, '包', '小号托特包', '棕色', 38900),
  ]),
  story('gallery-black', ['精选', '约会'], '看展时的轻黑色组合', '不同材质的黑色单品彼此区分，让简洁造型保留细节。', ['用材质差异区分层次', '留出颈部轻盈空间'], ['看展约会', '轻黑色'], [
    product('gallery-black', 1, '上装', '薄纱拼接上衣', '黑色 S', 28900),
    product('gallery-black', 2, '下装', '微光半身裙', '黑色 S', 41900),
  ]),
  story('market-stripes', ['精选', '周末'], '条纹衫与市集帆布包', '轻松的条纹和宽松裤装，回应周末市集的步行节奏。', ['条纹作为唯一图案', '裤装保留活动余量'], ['周末市集', '轻松条纹'], [
    product('market-stripes', 1, '上装', '棉质条纹衫', '蓝白 M', 19900),
    product('market-stripes', 2, '包', '宽带帆布包', '原色', 15900),
  ]),
  story('short-jacket', ['精选', '显高'], '短外套与直筒裤的上下呼应', '短款轮廓和连续裤线形成清晰分区，适合日常借鉴。', ['外套下摆靠近腰线', '裤长覆盖部分鞋面'], ['短外套', '比例灵感'], [
    product('short-jacket', 1, '外套', '短款斜纹夹克', '卡其 M', 46900),
    product('short-jacket', 2, '下装', '高腰直筒裤', '咖色 M', 33900),
  ]),
  story('knit-coffee', ['精选', '通勤', '约会'], '针织背心的咖啡馆午后', '细针织叠在清爽衬衫之外，在室内外温差中保持舒适层次。', ['背心与裤装色彩呼应', '衬衫下摆自然露出'], ['咖啡馆', '针织叠穿'], [
    product('knit-coffee', 1, '上装', '细针织背心', '可可色 M', 22900),
    product('knit-coffee', 2, '上装', '宽松白衬衫', '白色 M', 25900),
  ]),
];

const feature = {
  type: 'feature',
  id: 'weekly-city-edit',
  title: '本周城市通勤灵感',
  image: './assets/weekly-city-edit.svg',
};

const feedEntriesByChannel = Object.fromEntries(channels.map((channel) => {
  const entries = stories
    .filter((item) => item.channels.includes(channel))
    .map((item) => ({ type: 'story', storyId: item.id }));
  if (channel === '精选') entries.splice(7, 0, feature);
  return [channel, entries];
}));


const catalogChannels = channels;

const createState = () => ({
  channel: '精选',
  screen: 'feed',
  activeStoryId: null,
  detailView: 'story',
  savedStoryIds: [],
  selectedProductIds: [],
  selectionInitializedForStoryId: null,
  scrollByChannel: Object.fromEntries(catalogChannels.map((channel) => [channel, 0])),
});

const findStory = (storyId, stories) => {
  const story = stories.find((candidate) => candidate.id === storyId);
  if (!story) throw new TypeError(`未知故事: ${storyId}`);
  return story;
};

const saveScrollPosition = (state, channel, position) => {
  if (!catalogChannels.includes(channel)) throw new TypeError(`未知频道: ${channel}`);
  return { ...state, scrollByChannel: { ...state.scrollByChannel, [channel]: position } };
};

const setChannel = (state, channel) => {
  if (!catalogChannels.includes(channel)) throw new TypeError(`未知频道: ${channel}`);
  return { ...state, channel };
};

const openStory = (state, storyId, stories) => {
  findStory(storyId, stories);
  return {
    ...state,
    screen: 'detail',
    activeStoryId: storyId,
    detailView: 'story',
    selectedProductIds: [],
    selectionInitializedForStoryId: null,
  };
};

const closeStory = (state) => ({
  ...state,
  screen: 'feed',
  activeStoryId: null,
  detailView: 'story',
  selectedProductIds: [],
  selectionInitializedForStoryId: null,
});

const toggleSave = (state, storyId, stories) => {
  findStory(storyId, stories);
  const saved = state.savedStoryIds.includes(storyId);
  return {
    ...state,
    savedStoryIds: saved
      ? state.savedStoryIds.filter((id) => id !== storyId)
      : [...state.savedStoryIds, storyId],
  };
};

const setDetailView = (state, detailView, stories) => {
  if (!['story', 'products'].includes(detailView)) throw new TypeError(`未知详情视图: ${detailView}`);
  if (detailView === 'story') return { ...state, detailView };
  const story = findStory(state.activeStoryId, stories);
  if (state.selectionInitializedForStoryId === story.id) return { ...state, detailView };
  return {
    ...state,
    detailView,
    selectionInitializedForStoryId: story.id,
    selectedProductIds: story.products
      .filter((product) => product.status === 'available')
      .map((product) => product.id),
  };
};

const toggleProduct = (state, productId, stories) => {
  const story = findStory(state.activeStoryId, stories);
  const product = story.products.find((candidate) => candidate.id === productId);
  if (!product) throw new TypeError(`未知商品: ${productId}`);
  if (product.status !== 'available') return state;
  const selected = state.selectedProductIds.includes(productId);
  return {
    ...state,
    selectedProductIds: selected
      ? state.selectedProductIds.filter((id) => id !== productId)
      : [...state.selectedProductIds, productId],
  };
};

const summarizeSelection = (state, stories) => {
  const story = findStory(state.activeStoryId, stories);
  const available = story.products.filter((product) => product.status === 'available');
  const selected = available.filter((product) => state.selectedProductIds.includes(product.id));
  const count = selected.length;
  let totalFen = 0;
  for (const product of selected) {
    if (!Number.isSafeInteger(product.priceFen) || product.priceFen < 0) {
      throw new TypeError(`商品价格无效: ${product.id}`);
    }
    const nextTotal = totalFen + product.priceFen;
    if (!Number.isSafeInteger(nextTotal)) throw new TypeError('商品价格合计溢出');
    totalFen = nextTotal;
  }
  return {
    count,
    totalFen,
    actionLabel: count === 0 ? '请选择商品' : count === available.length ? '购买整套' : '购买已选',
    disabled: count === 0,
  };
};


const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const escapeAttribute = escapeHtml;

const image = (src, alt, className) => `<img class="${className}" src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}">`;

const detailTabs = (active) => `<div class="segmented-view" role="tablist" aria-label="详情视图">
  ${['story', 'products'].map((view) => `<button type="button" class="segmented-view__option" role="tab" id="detail-tab-${view}"${active === view ? ` aria-controls="detail-panel-${view}"` : ''} aria-selected="${active === view}" data-action="set-detail-view" data-detail-view="${view}">${view === 'story' ? '穿搭故事' : '整套商品'}</button>`).join('')}
</div>`;

function renderChannelTabs(channels, activeChannel) {
  return `<div class="channel-tabs" role="tablist" aria-label="穿搭场景">${channels.map((channel) => `<button type="button" class="channel-tab" role="tab" data-action="set-channel" data-channel="${escapeAttribute(channel)}" aria-selected="${channel === activeChannel}">${escapeHtml(channel)}</button>`).join('')}</div>`;
}

function renderFeed(entries, stories, savedStoryIds = []) {
  const byId = new Map(stories.map((story) => [story.id, story]));
  return `<div class="feed" id="feed-scroller">${entries.map((entry) => {
    if (entry.type === 'feature') return `<article class="feature-card" id="feature-${escapeAttribute(entry.id)}">${image(entry.image, entry.title, 'feature-card__image')}<div class="feature-card__body"><small class="feature-card__label">编辑专题</small><p class="feature-card__title">${escapeHtml(entry.title)}</p></div></article>`;
    const story = byId.get(entry.storyId);
    if (!story) return '';
    const saved = savedStoryIds.includes(story.id);
    return `<article class="story-card" id="story-${escapeAttribute(story.id)}">
      <a class="story-card__open" href="#${escapeAttribute(story.id)}" data-action="open-story" data-story-id="${escapeAttribute(story.id)}" aria-label="打开${escapeAttribute(story.title)}">${image(story.image, story.title, 'story-card__image')}
      <div class="story-card__body"><small class="story-card__label">${escapeHtml(story.editorialLabel)}</small><h2 class="story-card__title">${escapeHtml(story.title)}</h2>
      <div class="story-card__meta"><span>${escapeHtml(story.savedCountLabel)}</span></div></div></a>
      <button class="save-button story-card__save" type="button" data-action="toggle-save" data-story-id="${escapeAttribute(story.id)}" aria-pressed="${saved}">${saved ? '已收藏' : '收藏'}</button>
    </article>`;
  }).join('')}</div><p class="state-panel">已经到底了</p>`;
}

function renderStory(story, saved = false, activeView = 'story') {
  return `<article class="story-detail" id="story-detail-${escapeAttribute(story.id)}">
    <header class="detail-header"><button class="detail-action detail-action--back" type="button" data-action="close-story">‹ 返回</button><div class="detail-header__actions"><button class="detail-action" type="button" data-action="share-story">分享</button><button class="detail-action save-button" type="button" data-action="toggle-save" data-story-id="${escapeAttribute(story.id)}" aria-pressed="${saved}">${saved ? '已收藏' : '收藏'}</button></div></header>
    <div class="story-gallery">${story.gallery.map((src, index) => `<figure class="story-gallery__item">${image(src, `${story.title} ${index + 1}`, 'story-card__image')}</figure>`).join('')}</div>
    <div class="story-detail__body"><small class="story-detail__eyebrow">编辑穿搭故事</small><h2 class="story-detail__title">${escapeHtml(story.title)}</h2><p class="story-detail__intro">${escapeHtml(story.intro)}</p>
    <ul class="story-detail__tips">${story.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>
    <p class="story-detail__topics">${story.topics.map((topic) => `<span>#${escapeHtml(topic)}</span>`).join(' ')}</p></div>
    ${detailTabs(activeView)}
    <section class="story-panel" id="detail-panel-story" role="tabpanel" aria-labelledby="detail-tab-story">穿搭故事</section>
  </article>`;
}

function renderProducts(story, activeView = 'products') {
  const options = arguments[2] ?? {};
  const selectedProductIds = options.selectedProductIds ?? story.products
    .filter(({ status }) => status === 'available').map(({ id }) => id);
  const resolvedSpecProductIds = options.resolvedSpecProductIds ?? story.products
    .filter(({ spec }) => Boolean(spec)).map(({ id }) => id);
  const available = story.products.filter(({ status }) => status === 'available');
  const selected = available.filter(({ id }) => selectedProductIds.includes(id));
  const pricesValid = selected.every(({ priceFen }) => Number.isSafeInteger(priceFen) && priceFen >= 0);
  const totalFen = pricesValid ? selected.reduce((total, product) => total + product.priceFen, 0) : null;
  const summary = options.summary ?? {
    count: selected.length,
    totalFen,
    actionLabel: selected.length === 0 ? '请选择商品' : selected.length === available.length ? '购买整套' : '购买已选',
    disabled: selected.length === 0 || !pricesValid,
  };
  const formatFen = (fen) => {
    if (!Number.isSafeInteger(fen) || fen < 0) return null;
    return { major: String(Math.floor(fen / 100)), minor: `.${String(fen % 100).padStart(2, '0')}` };
  };
  const rows = story.products.map((product) => {
    const selectable = product.status === 'available';
    const checked = selectable && selectedProductIds.includes(product.id);
    const specResolved = Boolean(product.spec) || resolvedSpecProductIds.includes(product.id);
    const price = formatFen(product.priceFen);
    const statusLabel = product.status === 'sold-out' ? '已售罄' : product.status === 'invalid' ? '已失效' : '可购买';
    return `<div class="product-row" id="product-${escapeAttribute(product.id)}">
      <input class="product-row__select" data-action="toggle-product" data-product-id="${escapeAttribute(product.id)}" type="checkbox" aria-label="选择${escapeAttribute(product.title)}"${checked ? ' checked' : ''}${selectable ? '' : ' disabled'}>
      ${image(product.image, product.title, 'product-row__image')}
      <div class="product-row__content"><strong class="product-row__category">${escapeHtml(product.category)}</strong><p class="product-row__title">${escapeHtml(product.title)}</p>
        ${specResolved ? `<small class="product-row__spec">${escapeHtml(product.spec || '演示规格')}</small>` : `<small class="product-row__spec" id="spec-${escapeAttribute(product.id)}">请选择规格</small><button class="spec-button" type="button" data-action="choose-spec" data-product-id="${escapeAttribute(product.id)}">选择演示规格</button>`}
        ${price ? `<p class="product-row__price" aria-label="参考价格 ${price.major}${price.minor} 元"><span class="product-row__price-major">${price.major}</span><span class="product-row__price-minor">${price.minor}</span></p>` : '<p class="product-row__price">价格待补充</p>'}
      </div><span class="product-row__status product-row__status--${escapeAttribute(product.status)}">${statusLabel}</span>
    </div>`;
  }).join('');
  const total = formatFen(summary.totalFen);
  const hasUnresolvedSelected = selected.some((product) => !product.spec && !resolvedSpecProductIds.includes(product.id));
  const checkoutDisabled = summary.disabled || hasUnresolvedSelected || !total;
  const checkoutHint = hasUnresolvedSelected ? '<p class="checkout-bar__hint" id="unresolved-spec-message">请先为已选商品选择规格</p>' : '';
  return `<article id="products-detail-${escapeAttribute(story.id)}">
    <header class="detail-header"><button class="detail-action detail-action--back" type="button" data-action="close-story">‹ 返回</button><strong class="detail-header__title">整套商品</strong></header>
    ${detailTabs(activeView)}
    <section id="detail-panel-products" role="tabpanel" aria-labelledby="detail-tab-products">
      <div class="outfit-summary">${image(story.image, story.title, 'outfit-summary__image')}<div class="outfit-summary__content"><small>当前造型</small><h2>${escapeHtml(story.title)}</h2><p>${escapeHtml(story.priceNote)}</p></div></div>
      <div class="product-list">${rows}</div>
    </section>
    <div class="checkout-bar"><div class="checkout-bar__summary"><span class="checkout-bar__count">已选 ${summary.count} 件</span><span class="checkout-bar__total">${total ? `合计参考 ¥${total.major}${total.minor}` : '合计价格待补充'}</span>${checkoutHint}</div><button class="checkout-bar__cta" type="button" data-action="buy-selection"${checkoutDisabled ? ' disabled' : ''}${hasUnresolvedSelected ? ' aria-describedby="unresolved-spec-message"' : ''}>${escapeHtml(summary.actionLabel)}</button></div>
  </article>`;
}

const renderSkeleton = () => '<div class="skeleton" aria-busy="true"><div class="skeleton__image"></div><div class="skeleton__line"></div><div class="skeleton__line skeleton__line--short"></div></div>';
const renderDetailSkeleton = (activeView = 'story') => {
  const label = activeView === 'products' ? '整套商品' : '穿搭故事';
  return `<article class="detail-state" data-detail-state="loading"><header class="detail-header"><button class="detail-action detail-action--back" type="button" data-action="close-story">‹ 返回</button><strong class="detail-header__title">${label}</strong></header>${detailTabs(activeView)}<section class="skeleton detail-state__skeleton" aria-busy="true" aria-label="${label}加载中"><div class="skeleton__image"></div><div class="skeleton__line"></div><div class="skeleton__line skeleton__line--short"></div></section></article>`;
};
const renderDetailError = (activeView = 'story') => {
  const message = activeView === 'products' ? '商品数据暂时无法加载' : '穿搭故事暂时无法加载';
  return `<article class="detail-state" data-detail-state="error"><header class="detail-header"><button class="detail-action detail-action--back" type="button" data-action="close-story">‹ 返回</button></header>${detailTabs(activeView)}<section class="state-panel state-panel--error"><span class="state-panel__icon" aria-hidden="true">!</span><p>${message}</p><button class="state-panel__action" type="button" data-action="retry-detail">重试</button></section></article>`;
};
const renderEmpty = () => '<section class="state-panel state-panel--empty"><span class="state-panel__icon" aria-hidden="true">◇</span><p>当前频道暂无内容</p><button class="state-panel__action" type="button" data-action="return-featured">返回精选</button></section>';
const renderError = () => '<section class="state-panel state-panel--error"><span class="state-panel__icon" aria-hidden="true">!</span><p>内容暂时无法加载</p><button class="state-panel__action" type="button" data-action="retry-feed">重试</button></section>';


const shell = document.querySelector('#app-shell');
const channelTabs = document.querySelector('#channel-tabs');
const feedScreen = document.querySelector('#feed-screen');
const detailScreen = document.querySelector('#detail-screen');
const detailContent = document.querySelector('#detail-content');
const toast = document.querySelector('#toast');
const TOAST_DURATION_MS = 1800;
let state = createState();
let toastTimer = null;
let pendingFeedFocusStoryId = null;
let pendingChannelFocus = null;
let pendingSaveFocus = null;
let shouldFocusDetailTab = false;
let pendingProductFocus = null;
let pendingDetailScroll = false;
let prototypeState = 'normal';
let resolvedSpecProductIds = [];

const fixtureStories = () => {
  if (prototypeState === 'broken-image') {
    return stories.map((story) => ({ ...story, image: './assets/missing-image.jpg', gallery: ['./assets/missing-gallery.jpg'], products: story.products.map((product) => ({ ...product, image: './assets/missing-product.jpg' })) }));
  }
  if (prototypeState === 'partial-sold-out') {
    return stories.map((story, storyIndex) => storyIndex === 0 ? {
      ...story,
      products: story.products.map((product, productIndex) => ({
        ...product,
        status: productIndex === 0 ? 'available' : 'sold-out',
        spec: productIndex === 0 ? '' : product.spec,
      })),
    } : story);
  }
  if (prototypeState === 'all-unavailable') {
    return stories.map((story, storyIndex) => storyIndex === 0 ? {
      ...story, products: story.products.map((product) => ({ ...product, status: 'invalid' })),
    } : story);
  }
  return stories;
};
const currentStories = () => fixtureStories();
const activeStory = () => currentStories().find((story) => story.id === state.activeStoryId);
const rememberFeedScroll = () => {
  state = saveScrollPosition(state, state.channel, window.scrollY);
};
const restoreFeedScroll = () => requestAnimationFrame(() => {
  window.scrollTo({ top: state.scrollByChannel[state.channel], behavior: 'auto' });
  if (pendingFeedFocusStoryId) {
    feedScreen.querySelector(`[data-action="open-story"][data-story-id="${pendingFeedFocusStoryId}"]`)
      ?.focus({ preventScroll: true });
    pendingFeedFocusStoryId = null;
  }
});
const matchingControl = (root, action, key, value) => [...root.querySelectorAll(`[data-action="${action}"]`)]
  .find((control) => control.dataset[key] === value);

function render() {
  const fixtureCatalog = currentStories();
  channelTabs.innerHTML = renderChannelTabs(channels, state.channel);
  if (prototypeState === 'loading') feedScreen.innerHTML = `${renderSkeleton()}${renderSkeleton()}`;
  else if (prototypeState === 'empty') feedScreen.innerHTML = renderEmpty();
  else if (prototypeState === 'error') feedScreen.innerHTML = renderError();
  else feedScreen.innerHTML = renderFeed(feedEntriesByChannel[state.channel], fixtureCatalog, state.savedStoryIds);
  const story = activeStory();
  if (story && prototypeState === 'loading') {
    detailContent.innerHTML = renderDetailSkeleton(state.detailView);
  } else if (story && prototypeState === 'error') {
    detailContent.innerHTML = renderDetailError(state.detailView);
  } else if (story) {
    const saved = state.savedStoryIds.includes(story.id);
    let summary;
    if (state.detailView === 'products') {
      try {
        summary = summarizeSelection(state, fixtureCatalog);
      } catch {
        summary = { count: state.selectedProductIds.length, totalFen: null, actionLabel: '价格待补充', disabled: true };
      }
    }
    detailContent.innerHTML = state.detailView === 'story'
      ? renderStory(story, saved, state.detailView)
      : renderProducts(story, state.detailView, {
        selectedProductIds: state.selectedProductIds,
        resolvedSpecProductIds,
        summary,
      });
  } else {
    detailContent.innerHTML = '';
  }
  const onFeed = state.screen === 'feed';
  feedScreen.hidden = !onFeed;
  channelTabs.hidden = !onFeed;
  detailScreen.hidden = onFeed;
  if (onFeed) restoreFeedScroll();
  if (onFeed && pendingChannelFocus) {
    requestAnimationFrame(() => {
      matchingControl(channelTabs, 'set-channel', 'channel', pendingChannelFocus)?.focus({ preventScroll: true });
      pendingChannelFocus = null;
    });
  }
  if (pendingSaveFocus) {
    requestAnimationFrame(() => {
      const root = pendingSaveFocus.screen === 'feed' ? feedScreen : detailContent;
      matchingControl(root, 'toggle-save', 'storyId', pendingSaveFocus.storyId)?.focus({ preventScroll: true });
      pendingSaveFocus = null;
    });
  }
  if (!onFeed && pendingDetailScroll) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      pendingDetailScroll = false;
    });
  }
  if (!onFeed && shouldFocusDetailTab) {
    requestAnimationFrame(() => {
      detailContent.querySelector(`#detail-tab-${state.detailView}`)?.focus({ preventScroll: true });
      shouldFocusDetailTab = false;
    });
  }
  if (!onFeed && pendingProductFocus) {
    requestAnimationFrame(() => {
      const { action, productId } = pendingProductFocus;
      const exact = detailContent.querySelector(`[data-action="${action}"][data-product-id="${productId}"]`);
      const fallback = detailContent.querySelector(`[data-action="toggle-product"][data-product-id="${productId}"]`)
        ?? detailContent.querySelector('[data-action="buy-selection"]');
      (exact ?? fallback)?.focus({ preventScroll: true });
      pendingProductFocus = null;
    });
  }
}

const showToast = (message) => {
  if (toastTimer !== null) clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
    toastTimer = null;
  }, TOAST_DURATION_MS);
};

shell.addEventListener('click', (event) => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const action = control.dataset.action;
  if (action === 'set-channel') {
    rememberFeedScroll();
    state = setChannel(state, control.dataset.channel);
    pendingChannelFocus = control.dataset.channel;
  } else if (action === 'open-story') {
    event.preventDefault();
    rememberFeedScroll();
    state = openStory(state, control.dataset.storyId, stories);
    pendingDetailScroll = true;
  } else if (action === 'close-story') {
    pendingFeedFocusStoryId = state.activeStoryId;
    state = closeStory(state);
  } else if (action === 'toggle-save') {
    if (state.screen === 'feed') rememberFeedScroll();
    pendingSaveFocus = { screen: state.screen, storyId: control.dataset.storyId };
    state = toggleSave(state, control.dataset.storyId, stories);
    showToast(state.savedStoryIds.includes(control.dataset.storyId) ? '已收藏' : '已取消收藏');
  } else if (action === 'set-detail-view') {
    state = setDetailView(state, control.dataset.detailView, currentStories());
    shouldFocusDetailTab = true;
  } else if (action === 'toggle-product') {
    pendingProductFocus = { action, productId: control.dataset.productId };
    state = toggleProduct(state, control.dataset.productId, currentStories());
    shouldFocusDetailTab = false;
  } else if (action === 'choose-spec') {
    pendingProductFocus = { action, productId: control.dataset.productId };
    resolvedSpecProductIds = [...new Set([...resolvedSpecProductIds, control.dataset.productId])];
  } else if (action === 'buy-selection') {
    const story = activeStory();
    const unresolved = story.products.find((product) => state.selectedProductIds.includes(product.id)
      && !product.spec && !resolvedSpecProductIds.includes(product.id));
    if (unresolved) {
      showToast('请先选择商品规格');
      detailContent.querySelector(`[data-action="choose-spec"][data-product-id="${unresolved.id}"]`)?.focus({ preventScroll: true });
      return;
    } else {
      const summary = summarizeSelection(state, currentStories());
      showToast(summary.actionLabel === '购买整套' ? '已确认购买整套（原型）' : '已确认购买已选商品（原型）');
      return;
    }
  } else if (action === 'retry-feed') {
    prototypeState = 'normal';
    shell.querySelector('[data-action="set-prototype-state"]').value = prototypeState;
  } else if (action === 'retry-detail') {
    prototypeState = 'normal';
    shell.querySelector('[data-action="set-prototype-state"]').value = prototypeState;
  } else if (action === 'return-featured') {
    prototypeState = 'normal';
    state = setChannel(state, '精选');
    shell.querySelector('[data-action="set-prototype-state"]').value = prototypeState;
  } else if (action === 'share-story') {
    showToast('分享功能为原型演示');
  } else if (action === 'prototype-search') {
    showToast('搜索功能为原型演示');
  } else if (action === 'prototype-nav') {
    showToast('该导航为原型演示');
  }
  render();
});

shell.addEventListener('change', (event) => {
  const control = event.target.closest('[data-action="set-prototype-state"]');
  if (!control) return;
  const nextPrototypeState = control.value;
  const preserveDetail = state.screen === 'detail' && ['normal', 'loading', 'error'].includes(nextPrototypeState);
  prototypeState = nextPrototypeState;
  resolvedSpecProductIds = [];
  if (['partial-sold-out', 'all-unavailable'].includes(prototypeState)) {
    state = openStory(createState(), stories[0].id, currentStories());
    state = setDetailView(state, 'products', currentStories());
  } else if (!preserveDetail) {
    state = createState();
  }
  render();
});

shell.addEventListener('error', (event) => {
  if (!(event.target instanceof HTMLImageElement)) return;
  if (event.target.dataset.fallbackHandled === 'true') return;
  event.target.dataset.fallbackHandled = 'true';
  const fallback = Object.assign(document.createElement('div'), {
    className: 'image-fallback',
    role: 'img',
    textContent: '图片暂时无法显示',
  });
  fallback.setAttribute('aria-label', `${event.target.alt || '图片'}加载失败`);
  event.target.replaceWith(fallback);
}, true);

render();


})();