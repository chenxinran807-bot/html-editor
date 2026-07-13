import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
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

const hash = (value) => createHash('sha256').update(value).digest('hex');
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

async function makeHarnessRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'experiment-contract-'));
  const inputs = ['input-a', 'input-b'];
  const skills = Array.from({ length: 6 }, (_, index) => ({ id: `skill-${index + 1}`, capabilityName: `Skill ${index + 1}` }));
  await mkdir(path.join(root, 'experiments'), { recursive: true });
  await writeFile(path.join(root, 'experiments/manifest.json'), JSON.stringify({ inputs, skills }));
  for (const inputId of inputs) {
    const input = path.join(root, 'experiments/inputs', inputId);
    const source = Buffer.from(`# ${inputId}\n![asset](assets/image.png)\n`);
    await mkdir(path.join(input, 'assets'), { recursive: true });
    await writeFile(path.join(input, 'source.md'), source);
    await writeFile(path.join(input, 'metadata.json'), JSON.stringify({ fixtureSha256: hash(source), assetCount: 1 }));
    await writeFile(path.join(input, 'assets/image.png'), png);
    await writeFile(path.join(input, 'assets-manifest.json'), JSON.stringify({ assetCount: 1, assets: [{ file: 'assets/image.png', mime: 'image/png', bytes: png.length, sha256: hash(png), sourceReferenceIndex: 1, sourceAltTextSha256: hash('asset') }] }));
  }
  return root;
}

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

test('rejects unknown result fields and blank array entries', () => {
  for (const candidate of [
    { ...validResult, unexpected: true },
    { ...validResult, deviations: ['   '] },
    { ...validResult, artifacts: [''] },
    { ...validResult, evidence: [42] },
    { ...validResult, runtime: { durationMs: -1 } },
  ]) assert.equal(validateResult(candidate).valid, false);
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
  const root = await makeHarnessRoot();
  const artifact = path.join(root, 'experiments/cells/input-a/skill-1/artifact');
  await mkdir(artifact, { recursive: true });
  await writeFile(path.join(artifact, 'keep.txt'), 'do not overwrite');
  const { initializeCells } = await import('../scripts/experiment/init-cells.mjs');
  await assert.rejects(initializeCells(root), /existing|artifact/i);
  assert.equal(await readFile(path.join(artifact, 'keep.txt'), 'utf8'), 'do not overwrite');
});

test('fixture integrity validation is reusable for copied cell inputs', async () => {
  const { validateFixtureDirectory } = await import('../scripts/experiment/init-cells.mjs');
  const input = new URL('../experiments/inputs/outfit-tab/', import.meta.url);
  await assert.doesNotReject(validateFixtureDirectory(fileURLToPath(input), 'copied outfit fixture'));
});

test('initializer rejects duplicate and unsafe manifest identifiers', async () => {
  const { initializeCells } = await import('../scripts/experiment/init-cells.mjs');
  for (const mutate of [
    (manifest) => { manifest.inputs[1] = manifest.inputs[0]; },
    (manifest) => { manifest.skills[1].id = manifest.skills[0].id; },
    (manifest) => { manifest.inputs[0] = '../escape'; },
    (manifest) => { manifest.skills[0].id = 'bad/skill'; },
  ]) {
    const root = await makeHarnessRoot();
    const file = path.join(root, 'experiments/manifest.json');
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    mutate(manifest);
    await writeFile(file, JSON.stringify(manifest));
    await assert.rejects(initializeCells(root), /manifest|duplicate|unsafe/i);
  }
});

test('fixture validation rejects extra assets and symlinked manifest assets', async () => {
  const { validateFixtureDirectory } = await import('../scripts/experiment/init-cells.mjs');
  const extraRoot = await makeHarnessRoot();
  const extraInput = path.join(extraRoot, 'experiments/inputs/input-a');
  await writeFile(path.join(extraInput, 'assets/extra.png'), png);
  await assert.rejects(validateFixtureDirectory(extraInput), /extra|manifest/i);

  const linkRoot = await makeHarnessRoot();
  const linkInput = path.join(linkRoot, 'experiments/inputs/input-a');
  const target = path.join(linkRoot, 'outside.png');
  await writeFile(target, png);
  await import('node:fs/promises').then(({ rm }) => rm(path.join(linkInput, 'assets/image.png')));
  await symlink(target, path.join(linkInput, 'assets/image.png'));
  await assert.rejects(validateFixtureDirectory(linkInput), /symlink|regular/i);
});

test('initializer is exact-idempotent and rejects a mutated existing cell without overwrite', async () => {
  const { initializeCells } = await import('../scripts/experiment/init-cells.mjs');
  const root = await makeHarnessRoot();
  await initializeCells(root);
  await assert.doesNotReject(initializeCells(root));
  const copied = path.join(root, 'experiments/cells/input-a/skill-1/input/source.md');
  await writeFile(copied, 'mutated');
  await assert.rejects(initializeCells(root), /existing|differ|overwrite|hash/i);
  assert.equal(await readFile(copied, 'utf8'), 'mutated');
});
