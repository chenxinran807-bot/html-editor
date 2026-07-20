const test = require('node:test');
const assert = require('node:assert/strict');

const {
  safeNodeId,
  assertRelativeTaskPath,
  createTaskEnvelope,
  createUnifiedManifest,
  createExportModel
} = require('../shared/task-protocol');

test('safeNodeId creates stable filesystem-safe names', () => {
  assert.equal(safeNodeId('123:456'), '123-456');
  assert.equal(safeNodeId('I12:34;56:78'), 'I12-34-56-78');
});

test('assertRelativeTaskPath rejects absolute and traversal paths', () => {
  assert.equal(assertRelativeTaskPath('pages/123-456.png'), 'pages/123-456.png');
  assert.throws(() => assertRelativeTaskPath('../secret'), /不安全/);
  assert.throws(() => assertRelativeTaskPath('/tmp/file'), /不安全/);
  assert.throws(() => assertRelativeTaskPath('pages\\..\\secret'), /不安全/);
});

test('createUnifiedManifest declares only capabilities actually provided', () => {
  const manifest = createUnifiedManifest({
    exporterVersion: '2.0.0',
    source: { fileKey: 'abc', fileName: 'Draft', pageName: 'Page 1', exportedAt: '2026-07-20T00:00:00.000Z' },
    pages: [{ nodeId: '1:2', name: '首页', width: 375, height: 812, png: 'pages/1-2.png' }],
    assets: [],
    tokens: null,
    hasLayerMetadata: false
  });

  assert.equal(manifest.schemaVersion, '1.0');
  assert.equal(manifest.exporter.version, '2.0.0');
  assert.deepEqual(manifest.exporter.capabilities, ['frame-png']);
  assert.equal(manifest.pages[0].png, 'pages/1-2.png');
  assert.deepEqual(manifest.tokens, {});
});

test('createExportModel preserves selection order and uses node ids for filenames', () => {
  const model = createExportModel([
    { id: '9:2', name: '第二页', type: 'FRAME', width: 375, height: 812 },
    { id: '3:4', name: '第二页', type: 'FRAME', width: 375, height: 812 }
  ], { scale: 2 });

  assert.deepEqual(model.map(item => item.nodeId), ['9:2', '3:4']);
  assert.deepEqual(model.map(item => item.png), ['pages/9-2.png', 'pages/3-4.png']);
  assert.deepEqual(model.map(item => [item.width, item.height]), [[750, 1624], [750, 1624]]);
});

test('createTaskEnvelope inventories each payload file independently', () => {
  const envelope = createTaskEnvelope({
    taskId: '123e4567-e89b-42d3-a456-426614174000',
    createdAt: '2026-07-20T00:00:00.000Z',
    figma: { fileKey: 'abc', fileName: 'Draft', pageName: 'Page 1' },
    files: [
      { path: 'pages/1-2.png', kind: 'page-png', nodeId: '1:2', sha256: 'a'.repeat(64), bytes: 12 },
      { path: 'pages/1-2.svg', kind: 'page-svg', nodeId: '1:2', sha256: 'b'.repeat(64), bytes: 8 }
    ]
  });

  assert.equal(envelope.taskSchemaVersion, '1.0');
  assert.equal(envelope.files.length, 2);
  assert.equal(envelope.files[1].sha256, 'b'.repeat(64));
});
