import { createCatalog } from './catalog.js';

const validStatuses = new Set(['loading', 'empty', 'error', 'ready']);
const validCardTypes = new Set(['creator', 'collection', 'outfit']);
const catalogCardTypesById = new Map(createCatalog().cards.map(({ id, type }) => [id, type]));
const catalogCardOrder = [...catalogCardTypesById.keys()];

export function createState() {
  return {
    channel: '按场景',
    filterByChannel: { '按场景': '推荐', '适合我': '不限性别', '博主推荐': '精选' },
    scrollByChannel: { '按场景': 0, '适合我': 0, '博主推荐': 0 },
    scrollTop: 0,
    view: 'feed',
    activeCardId: null,
    reactions: {},
    followingAuthorIds: [],
    hiddenCardIds: [],
    undo: null,
    cardOrder: [...catalogCardOrder],
    feedStatus: 'ready',
  };
}

export function selectChannel(state, channel, currentScrollTop = state.scrollTop) {
  if (!(channel in state.filterByChannel)) return { ...state };
  const scrollByChannel = { ...state.scrollByChannel, [state.channel]: currentScrollTop };
  return {
    ...state,
    channel,
    scrollByChannel,
    scrollTop: scrollByChannel[channel],
  };
}

export function selectFilter(state, filter) {
  return { ...state, filterByChannel: { ...state.filterByChannel, [state.channel]: filter } };
}

export function openCard(state, card) {
  if (
    !card
    || !validCardTypes.has(card.type)
    || catalogCardTypesById.get(card.id) !== card.type
  ) throw new TypeError('Unsupported card');
  return { ...state, view: `${card.type}-detail`, activeCardId: card.id };
}

export function returnToFeed(state) {
  return { ...state, view: 'feed', activeCardId: null };
}

export function toggleReaction(state, cardId, reaction) {
  const previous = state.reactions[cardId] ?? {};
  return {
    ...state,
    reactions: { ...state.reactions, [cardId]: { ...previous, [reaction]: !previous[reaction] } },
  };
}

export function hideCard(state, cardId) {
  if (state.hiddenCardIds.includes(cardId)) return { ...state };
  return {
    ...state,
    hiddenCardIds: [...state.hiddenCardIds, cardId],
    undo: { cardId, originalIndex: state.cardOrder.indexOf(cardId) },
  };
}

export function undoHide(state) {
  if (!state.undo) return { ...state };
  return {
    ...state,
    hiddenCardIds: state.hiddenCardIds.filter((id) => id !== state.undo.cardId),
    undo: null,
  };
}

export function setFeedStatus(state, feedStatus) {
  if (!validStatuses.has(feedStatus)) throw new TypeError(`Unsupported feed status: ${feedStatus}`);
  return { ...state, feedStatus };
}
