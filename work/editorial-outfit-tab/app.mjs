import { channels, feedEntriesByChannel, stories } from './catalog.mjs';
import {
  closeStory, createState, openStory, saveScrollPosition, setChannel,
  setDetailView, summarizeSelection, toggleProduct, toggleSave,
} from './state.mjs';
import {
  renderChannelTabs, renderEmpty, renderError, renderFeed, renderProducts,
  renderSkeleton, renderStory,
} from './render.mjs';

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
let shouldFocusDetailTab = false;
let pendingProductFocus = null;
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

function render() {
  const fixtureCatalog = currentStories();
  channelTabs.innerHTML = renderChannelTabs(channels, state.channel);
  if (prototypeState === 'loading') feedScreen.innerHTML = `${renderSkeleton()}${renderSkeleton()}`;
  else if (prototypeState === 'empty') feedScreen.innerHTML = renderEmpty();
  else if (prototypeState === 'error') feedScreen.innerHTML = renderError();
  else feedScreen.innerHTML = renderFeed(feedEntriesByChannel[state.channel], fixtureCatalog, state.savedStoryIds);
  const story = activeStory();
  if (story) {
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
  } else if (action === 'open-story') {
    rememberFeedScroll();
    state = openStory(state, control.dataset.storyId, stories);
  } else if (action === 'close-story') {
    pendingFeedFocusStoryId = state.activeStoryId;
    state = closeStory(state);
  } else if (action === 'toggle-save') {
    if (state.screen === 'feed') rememberFeedScroll();
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
  prototypeState = control.value;
  resolvedSpecProductIds = [];
  if (['partial-sold-out', 'all-unavailable'].includes(prototypeState)) {
    state = openStory(createState(), stories[0].id, currentStories());
    state = setDetailView(state, 'products', currentStories());
  } else {
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
