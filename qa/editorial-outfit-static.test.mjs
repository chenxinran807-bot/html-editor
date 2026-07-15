import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contextUrl = new URL(
  '../work/editorial-outfit-tab/demo-context.json',
  import.meta.url,
);

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
  assert.ok(context.open_questions.length > 0);
  assert.ok(
    context.open_questions.every(
      ({ blocking_level: blockingLevel }) => blockingLevel === 'soft',
    ),
  );
});
