import test from 'node:test';
import assert from 'node:assert/strict';

import { createCatalog } from '../work/douyin-outfit-content-feed/catalog.js';
import {
  createState,
  hideCard,
  openCard,
  returnToFeed,
  selectChannel,
  selectFilter,
  setFeedStatus,
  toggleFollow,
  toggleReaction,
  undoHide,
} from '../work/douyin-outfit-content-feed/state.js';

test('keeps filter and scroll independently per channel', () => {
  let state = createState();
  state = selectFilter(state, '通勤');
  state = selectChannel(state, '适合我', 640);
  state = selectFilter(state, '不限性别');
  state = selectChannel(state, '按场景', 320);

  assert.equal(state.filterByChannel['按场景'], '通勤');
  assert.equal(state.scrollByChannel['按场景'], 640);
  assert.equal(state.scrollTop, 640);
});

test('keeps active channel scroll fields in sync', () => {
  const state = selectChannel(createState(), '按场景', 480);

  assert.equal(state.scrollByChannel['按场景'], 480);
  assert.equal(state.scrollTop, 480);
});

test('opens and returns from every supported catalog card type', () => {
  const cards = createCatalog().cards;
  assert.ok(cards.length >= 12);
  assert.deepEqual(new Set(cards.map(({ type }) => type)), new Set(['creator', 'collection', 'outfit']));

  for (const card of cards) {
    const detail = openCard(createState(), card);
    assert.equal(detail.view, `${card.type}-detail`);
    assert.equal(detail.activeCardId, card.id);
    assert.equal(returnToFeed(detail).view, 'feed');
  }
});

test('rejects cards that are not in the catalog', () => {
  assert.throws(
    () => openCard(createState(), { id: 'invented-card', type: 'creator' }),
    /Unsupported card/,
  );
});

test('rejects unsupported card types', () => {
  assert.throws(
    () => openCard(createState(), { id: 'creator-1', type: 'advertisement' }),
    /Unsupported card/,
  );
});

test('likes, hides, and restores only the most recently hidden card', () => {
  let state = toggleReaction(createState(), 'creator-1', 'liked');
  assert.equal(state.reactions['creator-1'].liked, true);

  state = hideCard(state, 'creator-1');
  state = hideCard(state, 'collection-1');
  assert.deepEqual(state.hiddenCardIds, ['creator-1', 'collection-1']);
  state = undoHide(state);
  assert.deepEqual(state.hiddenCardIds, ['creator-1']);
  assert.equal(state.undo, null);
});

test('keeps reactions and author follows consistent while a card is hidden and restored', () => {
  let state = toggleReaction(createState(), 'creator-1', 'liked');
  state = toggleReaction(state, 'creator-1', 'saved');
  state = toggleFollow(state, 'author-1');
  state = hideCard(state, 'creator-1');
  state = undoHide(state);

  assert.deepEqual(state.reactions['creator-1'], { liked: true, saved: true });
  assert.deepEqual(state.followingAuthorIds, ['author-1']);
  assert.equal(state.cardOrder.indexOf('creator-1'), 0);
});

test('preserves catalog order without accepting injected card order', () => {
  assert.equal(createState.length, 0);
  const state = createState([{ id: 'invented-card' }]);
  assert.deepEqual(state.cardOrder, createCatalog().cards.map(({ id }) => id));
});

test('no-op transitions still return immutable state snapshots', () => {
  const initial = createState();
  assert.notStrictEqual(selectChannel(initial, 'unknown-channel'), initial);
  assert.notStrictEqual(undoHide(initial), initial);

  const hidden = hideCard(initial, 'creator-1');
  assert.notStrictEqual(hideCard(hidden, 'creator-1'), hidden);
});

test('supports every feed status including image failure', () => {
  for (const status of ['loading', 'empty', 'error', 'image-failure', 'ready']) {
    assert.equal(setFeedStatus(createState(), status).feedStatus, status);
  }
});

test('catalog exposes the accepted channel filters and neutral card metadata', () => {
  const catalog = createCatalog();
  assert.deepEqual(catalog.channels, {
    '按场景': ['推荐', '日常', '通勤', '约会', '出游', '运动', '校园'],
    '适合我': ['不限性别', '男生', '女生', '小个子', '高个子', '梨形', '宽肩', '暖肤色', '冷肤色'],
    '博主推荐': ['精选', '关注', '新锐', '男生穿搭', '女生穿搭'],
  });
  for (const card of catalog.cards) {
    assert.ok(card.id && card.title);
    assert.match(card.assetPath, /^\.\/assets\/[a-z0-9-]+\.svg$/);
    assert.ok(Array.isArray(card.tags) && card.tags.length > 0);
    assert.deepEqual(Object.keys(card.filters), Object.keys(catalog.channels));
  }
  for (const card of catalog.cards.filter(({ type }) => type === 'creator')) {
    assert.ok(card.authorName, `creator needs an explicit authorName: ${card.id}`);
    assert.doesNotMatch(card.authorName, /author-|作者\s*\d/i, 'authorName must not be synthesized from authorId');
  }
});
