const test = require('node:test');
const assert = require('node:assert/strict');
const { uploadValidatedTask } = require('../uploader/upload-task');

function fixture() {
  const taskId = '123e4567-e89b-42d3-a456-426614174000';
  const task = {
    taskSchemaVersion: '1.0', taskId, createdAt: '2026-07-20T00:00:00.000Z',
    figma: { fileKey: 'abc' }, files: [
      { path: 'figma-export.manifest.json', kind: 'manifest', sha256: 'a'.repeat(64), bytes: 2 },
      { path: 'pages/1-2.png', kind: 'page-png', nodeId: '1:2', sha256: 'b'.repeat(64), bytes: 3 }
    ]
  };
  return {
    task,
    manifest: { schemaVersion: '1.0' },
    files: new Map([
      ['task.json', new TextEncoder().encode('{}')],
      ['figma-export.manifest.json', Uint8Array.from([1, 2])],
      ['pages/1-2.png', Uint8Array.from([1, 2, 3])]
    ])
  };
}

test('uploadValidatedTask creates folders and uploads completion marker last', async () => {
  const calls = [];
  const adapter = {
    async currentUser() { return { openId: 'ou_me' }; },
    async ensureFolder(name, parent) { calls.push(['folder', name, parent]); return `${parent || 'root'}/${name}`; },
    async uploadBytes(name, bytes, folder) { calls.push(['upload', name, folder, bytes.length]); return { token: name }; }
  };
  await uploadValidatedTask(fixture(), { adapter, rootFolderToken: 'root-token', now: () => '2026-07-20T01:00:00.000Z' });

  assert.deepEqual(calls.slice(0, 3), [
    ['folder', 'prd-demo-tasks', 'root-token'],
    ['folder', '123e4567-e89b-42d3-a456-426614174000', 'root-token/prd-demo-tasks'],
    ['folder', 'pages', 'root-token/prd-demo-tasks/123e4567-e89b-42d3-a456-426614174000']
  ]);
  assert.equal(calls.at(-1)[1], '_COMPLETE.json');
  const taskUpload = calls.find(call => call[0] === 'upload' && call[1] === 'task.json');
  assert.ok(taskUpload);
});

test('uploadValidatedTask never uploads completion after a payload failure', async () => {
  const names = [];
  const adapter = {
    async currentUser() { return { openId: 'ou_me' }; },
    async ensureFolder(name) { return name; },
    async uploadBytes(name) {
      names.push(name);
      if (name === '1-2.png') throw new Error('network failed');
    }
  };
  await assert.rejects(() => uploadValidatedTask(fixture(), { adapter }), /network failed/);
  assert.equal(names.includes('_COMPLETE.json'), false);
});
