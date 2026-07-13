import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { validateResult } from '../scripts/experiment/validate-result.mjs';

const dimensions = {
  fidelity: 20,
  flowCoverage: 15,
  interaction: 20,
  visualHierarchy: 15,
  edgeStates: 10,
  stability: 10,
  handoff: 10,
};

const validResult = {
  inputId: 'outfit-tab',
  skillId: 'open-design',
  status: 'PASS',
  scores: dimensions,
  total: 100,
  artifacts: ['artifact/index.html'],
  evidence: ['qa/entry.png'],
  deviations: [],
  runtime: { startedAt: '2026-07-13T00:00:00.000Z', finishedAt: '2026-07-13T00:01:00.000Z', durationMs: 60000 },
};

test('accepts a complete result with seven scores and a matching total', () => {
  assert.deepEqual(validateResult(validResult), { valid: true, errors: [] });
});

test('rejects a total that differs from the seven score values', () => {
  const result = validateResult({ ...validResult, total: 99 });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /total/i);
});

test('enforces score maxima and exactly seven dimensions', () => {
  const result = validateResult({ ...validResult, scores: { ...dimensions, fidelity: 21, bonus: 1 }, total: 101 });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /fidelity|score/i);
});

for (const status of ['BLOCKED', 'NOT_APPLICABLE']) {
  test(`${status} requires null scores, deviations, and a concrete reason`, () => {
    const accepted = validateResult({
      ...validResult,
      status,
      scores: null,
      total: null,
      deviations: ['Authentication unavailable; recover by signing in and rerunning this cell.'],
      reason: 'The required platform session is unavailable in this environment.',
    });
    assert.equal(accepted.valid, true, accepted.errors.join('\n'));

    const rejected = validateResult({ ...validResult, status, scores: null, total: null, deviations: [], reason: '' });
    assert.equal(rejected.valid, false);
    assert.match(rejected.errors.join('\n'), /deviation|reason/i);
  });
}

test('schema and fixed tasks encode the complete contract', async () => {
  const schema = JSON.parse(await readFile(new URL('../experiments/contracts/result.schema.json', import.meta.url)));
  const tasks = JSON.parse(await readFile(new URL('../experiments/contracts/tasks.json', import.meta.url)));
  for (const key of ['inputId', 'skillId', 'status', 'scores', 'total', 'artifacts', 'evidence', 'deviations', 'runtime']) {
    assert.ok(schema.required.includes(key), `schema must require ${key}`);
  }
  assert.deepEqual(Object.keys(schema.$defs.scores.properties), Object.keys(dimensions));
  assert.deepEqual(tasks['outfit-tab'].map(({ id }) => id), [
    'switch-category', 'open-reason-card', 'read-guidance', 'open-product-or-alternative', 'enter-ai-styling-or-try-on',
  ]);
  assert.deepEqual(tasks['camera-upload'].map(({ id }) => id), [
    'open-upload-choices', 'enter-camera', 'flip-camera', 'open-album', 'close-camera', 'shutter', 'retake', 'use-photo', 'review-failure', 'retry',
  ]);
  for (const taskList of Object.values(tasks)) {
    for (const task of taskList) assert.ok(task.steps.length > 0, `${task.id} needs fixed steps`);
  }
});

test('cell initializer rejects an artifact-bearing destination before changing it', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'experiment-contract-'));
  const artifact = path.join(root, 'experiments/cells/outfit-tab/open-design/artifact');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(artifact, { recursive: true }));
  await writeFile(path.join(artifact, 'keep.txt'), 'do not overwrite');
  const { initializeCells } = await import('../scripts/experiment/init-cells.mjs');
  await assert.rejects(initializeCells(root), /artifact/i);
  assert.equal(await readFile(path.join(artifact, 'keep.txt'), 'utf8'), 'do not overwrite');
});

test('fixture integrity validation is reusable for copied cell inputs', async () => {
  const { validateFixtureDirectory } = await import('../scripts/experiment/init-cells.mjs');
  const input = new URL('../experiments/inputs/outfit-tab/', import.meta.url);
  await assert.doesNotReject(validateFixtureDirectory(fileURLToPath(input), 'copied outfit fixture'));
});
