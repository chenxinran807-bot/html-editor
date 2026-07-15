import { channels as catalogChannels } from './catalog.mjs';

export const createState = () => ({
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

export const saveScrollPosition = (state, channel, position) => {
  if (!catalogChannels.includes(channel)) throw new TypeError(`未知频道: ${channel}`);
  return { ...state, scrollByChannel: { ...state.scrollByChannel, [channel]: position } };
};

export const setChannel = (state, channel) => {
  if (!catalogChannels.includes(channel)) throw new TypeError(`未知频道: ${channel}`);
  return { ...state, channel };
};

export const openStory = (state, storyId, stories) => {
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

export const closeStory = (state) => ({
  ...state,
  screen: 'feed',
  activeStoryId: null,
  detailView: 'story',
  selectedProductIds: [],
  selectionInitializedForStoryId: null,
});

export const toggleSave = (state, storyId, stories) => {
  findStory(storyId, stories);
  const saved = state.savedStoryIds.includes(storyId);
  return {
    ...state,
    savedStoryIds: saved
      ? state.savedStoryIds.filter((id) => id !== storyId)
      : [...state.savedStoryIds, storyId],
  };
};

export const setDetailView = (state, detailView, stories) => {
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

export const toggleProduct = (state, productId, stories) => {
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

export const summarizeSelection = (state, stories) => {
  const story = findStory(state.activeStoryId, stories);
  const available = story.products.filter((product) => product.status === 'available');
  const selected = available.filter((product) => state.selectedProductIds.includes(product.id));
  const count = selected.length;
  return {
    count,
    totalFen: selected.reduce((total, product) => total + product.priceFen, 0),
    actionLabel: count === 0 ? '请选择商品' : count === available.length ? '购买整套' : '购买已选',
    disabled: count === 0,
  };
};
