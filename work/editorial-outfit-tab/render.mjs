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

export function renderChannelTabs(channels, activeChannel) {
  return `<div class="channel-tabs" role="tablist" aria-label="穿搭场景">${channels.map((channel) => `<button type="button" class="channel-tab" role="tab" data-action="set-channel" data-channel="${escapeAttribute(channel)}" aria-selected="${channel === activeChannel}">${escapeHtml(channel)}</button>`).join('')}</div>`;
}

export function renderFeed(entries, stories, savedStoryIds = []) {
  const byId = new Map(stories.map((story) => [story.id, story]));
  return `<div class="feed" id="feed-scroller">${entries.map((entry) => {
    if (entry.type === 'feature') return `<article class="feature-card" id="feature-${escapeAttribute(entry.id)}">${image(entry.image, entry.title, 'feature-card__image')}<div class="feature-card__body"><small class="feature-card__label">编辑专题</small><p class="feature-card__title">${escapeHtml(entry.title)}</p></div></article>`;
    const story = byId.get(entry.storyId);
    if (!story) return '';
    const saved = savedStoryIds.includes(story.id);
    return `<article class="story-card" id="story-${escapeAttribute(story.id)}">
      <button class="story-card__open" type="button" data-action="open-story" data-story-id="${escapeAttribute(story.id)}" aria-label="打开${escapeAttribute(story.title)}">${image(story.image, story.title, 'story-card__image')}</button>
      <div class="story-card__body"><small class="story-card__label">${escapeHtml(story.editorialLabel)}</small><h2 class="story-card__title">${escapeHtml(story.title)}</h2>
      <div class="story-card__meta"><span>${escapeHtml(story.savedCountLabel)}</span><button class="save-button" type="button" data-action="toggle-save" data-story-id="${escapeAttribute(story.id)}" aria-pressed="${saved}">${saved ? '已收藏' : '收藏'}</button></div></div>
    </article>`;
  }).join('')}</div><p class="state-panel">已经到底了</p>`;
}

export function renderStory(story, saved = false, activeView = 'story') {
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

export function renderProducts(story, activeView = 'products') {
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

export const renderSkeleton = () => '<div class="skeleton" aria-busy="true"><div class="skeleton__image"></div><div class="skeleton__line"></div><div class="skeleton__line skeleton__line--short"></div></div>';
export const renderEmpty = () => '<section class="state-panel state-panel--empty"><span class="state-panel__icon" aria-hidden="true">◇</span><p>当前频道暂无内容</p><button class="state-panel__action" type="button" data-action="return-featured">返回精选</button></section>';
export const renderError = () => '<section class="state-panel state-panel--error"><span class="state-panel__icon" aria-hidden="true">!</span><p>内容暂时无法加载</p><button class="state-panel__action" type="button" data-action="retry-feed">重试</button></section>';
