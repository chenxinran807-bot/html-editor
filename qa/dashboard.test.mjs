import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

async function buildFixture() {
  const output = await mkdtemp(path.join(tmpdir(), 'native-dashboard-'));
  const run = spawnSync(process.execPath, ['scripts/experiment/build-dashboard.mjs', '--output', output], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, `dashboard build failed:\n${run.stdout}\n${run.stderr}`);
  const data = JSON.parse(await readFile(path.join(output, 'data.json'), 'utf8'));
  return { output, data, run };
}

test('validates and aggregates exactly twelve experiment results', async () => {
  const { data } = await buildFixture();
  assert.equal(data.summary.resultCount, 12);
  assert.equal(data.summary.scoredCount, 11);
  assert.equal(data.summary.blockedCount, 1);
  assert.deepEqual(data.dimensions, ['fidelity', 'flowCoverage', 'interaction', 'visualHierarchy', 'edgeStates', 'stability', 'handoff']);
});

test('ranks each input by total then fidelity, interaction, and stability', async () => {
  const { data } = await buildFixture();
  assert.deepEqual(data.rankings['camera-upload'].map((row) => row.skillId), [
    'pm-kakaxi', 'open-design', 'huashu-design', 'prd-generator', 'vne-prototype', 'inspire-prototype',
  ]);
  assert.deepEqual(data.rankings['outfit-tab'].map((row) => row.skillId), [
    'open-design', 'huashu-design', 'prd-generator', 'pm-kakaxi', 'inspire-prototype',
  ]);
});

test('keeps blocked results scoreless and excludes them from ranking', async () => {
  const { data } = await buildFixture();
  const blocked = data.results.find((row) => row.inputId === 'outfit-tab' && row.skillId === 'vne-prototype');
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.total, null);
  assert.equal(blocked.scores, null);
  assert.equal(data.rankings['outfit-tab'].some((row) => row.skillId === 'vne-prototype'), false);
  assert.deepEqual(data.applicability.find((row) => row.skillId === 'vne-prototype').rankedInputs, ['camera-upload']);
});

test('computes cross-input deltas only when both inputs have scores', async () => {
  const { data } = await buildFixture();
  assert.equal(data.crossInput.find((row) => row.skillId === 'pm-kakaxi').delta, 10);
  assert.equal(data.crossInput.find((row) => row.skillId === 'open-design').delta, 2);
  assert.equal(data.crossInput.find((row) => row.skillId === 'vne-prototype').delta, null);
});

test('publishes dashboard sections, report recommendations, and loopback-safe relative links', async () => {
  const { output, data } = await buildFixture();
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const report = await readFile(path.join(output, 'report.md'), 'utf8');
  assert.equal(report.endsWith('\n\n'), false, 'report must end with exactly one newline');
  for (const label of ['概览', 'camera-upload 排名', 'outfit-tab 排名', '七维分解', '证据画廊', 'Artifact 链接', '偏离', '跨输入', '适用性']) {
    assert.match(html, new RegExp(label));
  }
  for (const skill of ['open-design', 'huashu-design', 'prd-generator', 'pm-kakaxi', 'vne-prototype', 'inspire-prototype']) {
    assert.match(report, new RegExp(`## ${skill}`));
  }
  for (const label of ['Best use', 'Weakness', 'Recommended', 'Avoid']) assert.match(report, new RegExp(label));
  const localArtifact = data.results.flatMap((row) => row.artifacts).find((item) => item.exists && !item.external);
  assert.ok(localArtifact.href.startsWith('../../'));
  assert.equal(localArtifact.href.includes('\\'), false);
});
