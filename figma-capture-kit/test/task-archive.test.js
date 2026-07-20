const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTaskArchive, inspectTaskArchive } = require('../shared/task-archive');

test('buildTaskArchive creates one self-consistent multi-page task zip', async () => {
  const taskId = '123e4567-e89b-42d3-a456-426614174000';
  const manifest = {
    schemaVersion: '1.0',
    exporter: { type: 'figma-plugin', version: '2.0.0', capabilities: ['frame-png'] },
    source: { fileKey: 'abc', fileName: 'Draft', pageName: 'Page 1', exportedAt: '2026-07-20T00:00:00.000Z' },
    pages: [
      { nodeId: '1:2', png: 'pages/1-2.png' },
      { nodeId: '3:4', png: 'pages/3-4.png' }
    ],
    assets: [], tokens: {}, constraints: {}
  };
  const archive = await buildTaskArchive({
    taskId,
    createdAt: '2026-07-20T00:00:00.000Z',
    figma: { fileKey: 'abc', fileName: 'Draft', pageName: 'Page 1' },
    manifest,
    files: [
      { path: 'pages/1-2.png', kind: 'page-png', nodeId: '1:2', bytes: Uint8Array.from([1, 2, 3]) },
      { path: 'pages/3-4.png', kind: 'page-png', nodeId: '3:4', bytes: Uint8Array.from([4, 5]) }
    ]
  });

  assert.equal(archive.filename, `figma-task-${taskId}.zip`);
  const inspected = await inspectTaskArchive(archive.bytes);
  assert.equal(inspected.task.taskId, taskId);
  assert.equal(inspected.task.files.length, 3);
  assert.deepEqual(inspected.paths.sort(), [
    'figma-export.manifest.json',
    'pages/1-2.png',
    'pages/3-4.png',
    'task.json'
  ]);
  assert.equal(inspected.task.files.find(file => file.path === 'pages/1-2.png').bytes, 3);
});
