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
const storyView = document.querySelector('#story-view');
const productsView = document.querySelector('#products-view');
const toast = document.querySelector('#toast');
let state = createState();

const activeStory = () => stories.find((story) => story.id === state.activeStoryId);
const feedScroller = () => feedScreen;
const rememberFeedScroll = () => {
  const scroller = feedScroller();
  if (scroller) state = saveScrollPosition(state, state.channel, scroller.scrollTop);
};
const restoreFeedScroll = () => requestAnimationFrame(() => {
  const scroller = feedScroller();
  if (scroller) scroller.scrollTop = state.scrollByChannel[state.channel];
});

function render() {
  channelTabs.innerHTML = renderChannelTabs(channels, state.channel);
  feedScreen.innerHTML = renderFeed(feedEntriesByChannel[state.channel], stories, state.savedStoryIds);
  const story = activeStory();
  if (story) {
    const saved = state.savedStoryIds.includes(story.id);
    storyView.innerHTML = renderStory(story, saved, state.detailView);
    productsView.innerHTML = renderProducts(story, state.detailView);
  }
  const onFeed = state.screen === 'feed';
  feedScreen.hidden = !onFeed;
  channelTabs.hidden = !onFeed;
  detailScreen.hidden = onFeed;
  storyView.hidden = state.detailView !== 'story';
  productsView.hidden = state.detailView !== 'products';
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
  }
  render();
});

shell.addEventListener('error', (event) => {
  if (!(event.target instanceof HTMLImageElement)) return;
  event.target.classList.add('image-fallback');
  event.target.alt = `${event.target.alt || '图片'}加载失败`;
}, true);

render();
