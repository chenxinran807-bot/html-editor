const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, utimes } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { findCandidateArchives } = require('../uploader/watcher');

test('findCandidateArchives returns only stable unprocessed figma task zips', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'watcher-test-'));
  const valid = 'figma-task-123e4567-e89b-42d3-a456-426614174000.zip';
  const recent = 'figma-task-223e4567-e89b-42d3-a456-426614174000.zip';
  await writeFile(join(directory, valid), 'ok');
  await writeFile(join(directory, recent), 'new');
  await writeFile(join(directory, 'other.zip'), 'ignore');
  const old = new Date(Date.now() - 10_000);
  await utimes(join(directory, valid), old, old);

  const result = await findCandidateArchives(directory, { processed: [], stableForMs: 3000, now: Date.now() });
  assert.deepEqual(result.map(item => item.name), [valid]);

  const none = await findCandidateArchives(directory, { processed: [valid], stableForMs: 3000, now: Date.now() });
  assert.equal(none.length, 0);
});
