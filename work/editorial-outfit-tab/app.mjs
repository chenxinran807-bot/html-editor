import { channels, feedEntriesByChannel, stories } from './catalog.mjs';
import {
  closeStory, createState, openStory, saveScrollPosition, setChannel,
  setDetailView, toggleSave,
} from './state.mjs';
import { renderChannelTabs, renderFeed, renderProducts, renderStory } from './render.mjs';

const shell = document.querySelector('#app-shell');
const channelTabs = document.querySelector('#channel-tabs');
const feedScreen = document.querySelector('#feed-screen');
const detailScreen = document.querySelector('#detail-screen');
const detailContent = document.querySelector('#detail-content');
const toast = document.querySelector('#toast');
let state = createState();

const activeStory = () => stories.find((story) => story.id === state.activeStoryId);
const rememberFeedScroll = () => {
  state = saveScrollPosition(state, state.channel, window.scrollY);
};
const restoreFeedScroll = () => requestAnimationFrame(() => {
  window.scrollTo({ top: state.scrollByChannel[state.channel], behavior: 'auto' });
});

function render() {
  channelTabs.innerHTML = renderChannelTabs(channels, state.channel);
  feedScreen.innerHTML = renderFeed(feedEntriesByChannel[state.channel], stories, state.savedStoryIds);
  const story = activeStory();
  if (story) {
    const saved = state.savedStoryIds.includes(story.id);
    detailContent.innerHTML = state.detailView === 'story'
      ? renderStory(story, saved, state.detailView)
      : renderProducts(story, state.detailView);
  } else {
    detailContent.innerHTML = '';
  }
  const onFeed = state.screen === 'feed';
  feedScreen.hidden = !onFeed;
  channelTabs.hidden = !onFeed;
  detailScreen.hidden = onFeed;
  if (onFeed) restoreFeedScroll();
}

const showToast = (message) => {
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => { toast.hidden = true; });
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
    state = closeStory(state);
  } else if (action === 'toggle-save') {
    state = toggleSave(state, control.dataset.storyId, stories);
    showToast(state.savedStoryIds.includes(control.dataset.storyId) ? '已收藏' : '已取消收藏');
  } else if (action === 'set-detail-view') {
    state = setDetailView(state, control.dataset.detailView, stories);
  } else if (action === 'share-story') {
    showToast('分享功能为原型演示');
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
