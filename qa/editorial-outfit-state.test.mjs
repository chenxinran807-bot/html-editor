import assert from 'node:assert/strict';
import test from 'node:test';

import {
  channels,
  feedEntriesByChannel,
  stories,
} from '../work/editorial-outfit-tab/catalog.mjs';
import {
  closeStory,
  createState,
  openStory,
  saveScrollPosition,
  setChannel,
  setDetailView,
  summarizeSelection,
  toggleProduct,
  toggleSave,
} from '../work/editorial-outfit-tab/state.mjs';

const story = stories.find((candidate) =>
  candidate.products.filter((product) => product.status === 'available').length >= 2
  && candidate.products.some((product) => product.status === 'sold-out'));

test('catalog provides the editorial channels and complete neutral story records', () => {
  assert.deepEqual(channels, ['精选', '通勤', '约会', '周末', '显高']);
  assert.ok(stories.length >= 10);
  for (const channel of channels) {
    assert.ok(stories.some((item) => item.channels.includes(channel)));
  }
  for (const item of stories) {
    assert.equal(item.priceNote, '价格仅为原型演示参考');
    for (const key of ['id', 'channels', 'title', 'editorialLabel', 'savedCountLabel', 'image', 'gallery', 'intro', 'tips', 'topics', 'products']) {
      assert.ok(Object.hasOwn(item, key), `${item.id} is missing ${key}`);
    }
    for (const product of item.products) {
      assert.equal(Number.isInteger(product.priceFen), true);
      for (const key of ['id', 'category', 'title', 'spec', 'image', 'status']) {
        assert.ok(Object.hasOwn(product, key), `${product.id} is missing ${key}`);
      }
    }
  }
  assert.ok(story, 'fixture story with available and sold-out products is required');
});

test('精选 inserts one feature after every six to eight ordinary cards', () => {
  let ordinaryCount = 0;
  let featureCount = 0;
  for (const entry of feedEntriesByChannel['精选']) {
    if (entry.type === 'story') ordinaryCount += 1;
    if (entry.type === 'feature') {
      featureCount += 1;
      assert.ok(ordinaryCount >= 6 && ordinaryCount <= 8);
      ordinaryCount = 0;
    }
  }
  assert.ok(featureCount >= 1);
});

test('setChannel preserves the previous channel scroll position', () => {
  const initial = saveScrollPosition(createState(), '精选', 640);
  const next = setChannel(initial, '通勤');

  assert.equal(next.channel, '通勤');
  assert.equal(next.scrollByChannel['精选'], 640);
});

test('openStory defaults to story view and closeStory restores feed scroll state', () => {
  const initial = saveScrollPosition(createState(), '精选', 420);
  const opened = openStory(initial, story.id, stories);
  const closed = closeStory(opened);

  assert.equal(opened.screen, 'detail');
  assert.equal(opened.detailView, 'story');
  assert.equal(closed.screen, 'feed');
  assert.equal(closed.scrollByChannel['精选'], 420);
});

test('toggleSave shares one savedStoryIds collection across feed and detail', () => {
  const feedState = toggleSave(createState(), story.id, stories);
  const detailState = openStory(feedState, story.id, stories);

  assert.ok(feedState.savedStoryIds.includes(story.id));
  assert.ok(detailState.savedStoryIds.includes(story.id));
});

test('products view selects only available products and partial selection is summarized', () => {
  const opened = openStory(createState(), story.id, stories);
  const productsView = setDetailView(opened, 'products', stories);
  const available = story.products.filter((product) => product.status === 'available');
  const soldOut = story.products.find((product) => product.status === 'sold-out');

  assert.deepEqual(productsView.selectedProductIds, available.map((product) => product.id));
  assert.ok(!productsView.selectedProductIds.includes(soldOut.id));

  const partial = toggleProduct(productsView, available[0].id, stories);
  const summary = summarizeSelection(partial, stories);
  assert.equal(summary.count, available.length - 1);
  assert.equal(summary.actionLabel, '购买已选');
  assert.equal(summary.disabled, false);
});

test('products view preserves a partial selection when returning from story view', () => {
  const available = story.products.filter((product) => product.status === 'available');
  let state = openStory(createState(), story.id, stories);
  state = setDetailView(state, 'products', stories);
  state = toggleProduct(state, available[0].id, stories);
  state = setDetailView(state, 'story', stories);
  state = setDetailView(state, 'products', stories);

  assert.deepEqual(state.selectedProductIds, available.slice(1).map((product) => product.id));
  assert.equal(summarizeSelection(state, stories).actionLabel, '购买已选');
});

test('products view preserves an intentional zero selection when returning from story view', () => {
  let state = openStory(createState(), story.id, stories);
  state = setDetailView(state, 'products', stories);
  for (const productId of [...state.selectedProductIds]) {
    state = toggleProduct(state, productId, stories);
  }
  state = setDetailView(state, 'story', stories);
  state = setDetailView(state, 'products', stories);

  assert.deepEqual(state.selectedProductIds, []);
  assert.equal(summarizeSelection(state, stories).actionLabel, '请选择商品');
});

test('sold-out products cannot be selected', () => {
  const productsView = setDetailView(openStory(createState(), story.id, stories), 'products', stories);
  const soldOut = story.products.find((product) => product.status === 'sold-out');

  assert.deepEqual(toggleProduct(productsView, soldOut.id, stories), productsView);
});

test('zero selection is disabled and asks the user to select products', () => {
  let state = setDetailView(openStory(createState(), story.id, stories), 'products', stories);
  for (const productId of [...state.selectedProductIds]) {
    state = toggleProduct(state, productId, stories);
  }

  assert.deepEqual(summarizeSelection(state, stories), {
    count: 0,
    totalFen: 0,
    actionLabel: '请选择商品',
    disabled: true,
  });
});

test('all available products are summarized as a complete outfit', () => {
  const state = setDetailView(openStory(createState(), story.id, stories), 'products', stories);
  const available = story.products.filter((product) => product.status === 'available');

  assert.deepEqual(summarizeSelection(state, stories), {
    count: available.length,
    totalFen: available.reduce((total, product) => total + product.priceFen, 0),
    actionLabel: '购买整套',
    disabled: false,
  });
});

test('unknown channel, story, and product throw explicit TypeErrors', () => {
  assert.throws(() => setChannel(createState(), '不存在'), { name: 'TypeError', message: /未知频道/ });
  assert.throws(() => openStory(createState(), 'missing-story', stories), { name: 'TypeError', message: /未知故事/ });
  const opened = openStory(createState(), story.id, stories);
  assert.throws(() => toggleProduct(opened, 'missing-product', stories), { name: 'TypeError', message: /未知商品/ });
});
