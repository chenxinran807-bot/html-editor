const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { buildTaskArchive } = require('../shared/task-archive');
const { validateTaskArchive } = require('../uploader/archive-validator');

async function validArchive() {
  const taskId = '123e4567-e89b-42d3-a456-426614174000';
  const manifest = {
    schemaVersion: '1.0',
    exporter: { type: 'figma-plugin', version: '2.0.0', capabilities: ['frame-png'] },
    source: { fileKey: 'abc' },
    pages: [{ nodeId: '1:2', png: 'pages/1-2.png' }],
    assets: [], tokens: {}, constraints: {}
  };
  return buildTaskArchive({
    taskId,
    createdAt: '2026-07-20T00:00:00.000Z',
    figma: { fileKey: 'abc', fileName: 'Draft', pageName: 'Page' },
    manifest,
    files: [{ path: 'pages/1-2.png', kind: 'page-png', nodeId: '1:2', bytes: Uint8Array.from([1, 2, 3]) }]
  });
}

test('validateTaskArchive accepts a complete archive', async () => {
  const archive = await validArchive();
  const result = await validateTaskArchive(archive.bytes, { filename: archive.filename });
  assert.equal(result.task.taskId, '123e4567-e89b-42d3-a456-426614174000');
  assert.equal(result.files.size, 3);
});

test('validateTaskArchive rejects unexpected files', async () => {
  const archive = await validArchive();
  const zip = await JSZip.loadAsync(archive.bytes);
  zip.file('extra.txt', 'surprise');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  await assert.rejects(() => validateTaskArchive(bytes, { filename: archive.filename }), /未登记文件/);
});

test('validateTaskArchive rejects missing and hash-mismatched files', async () => {
  const archive = await validArchive();
  const missingZip = await JSZip.loadAsync(archive.bytes);
  missingZip.remove('pages/1-2.png');
  await assert.rejects(
    () => validateTaskArchive(missingZip.generateAsync({ type: 'uint8array' }), { filename: archive.filename }),
    /缺少文件/
  );

  const dirtyZip = await JSZip.loadAsync(archive.bytes);
  dirtyZip.file('pages/1-2.png', Uint8Array.from([9, 9, 9]));
  await assert.rejects(
    () => validateTaskArchive(dirtyZip.generateAsync({ type: 'uint8array' }), { filename: archive.filename }),
    /SHA-256/ 
  );
});

test('validateTaskArchive rejects mismatched filename task id', async () => {
  const archive = await validArchive();
  await assert.rejects(
    () => validateTaskArchive(archive.bytes, { filename: 'figma-task-223e4567-e89b-42d3-a456-426614174000.zip' }),
    /文件名中的 taskId/
  );
});

