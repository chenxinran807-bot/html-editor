const test = require('node:test');
const assert = require('node:assert/strict');
const { createUploaderService } = require('../desktop-app/uploader-service');

function memoryDependencies(candidates, result) {
  const saved = [];
  return {
    saved,
    findCandidateArchives: async () => candidates,
    loadState: async () => ({ schemaVersion: '1.0', processed: [] }),
    saveState: async (path, state) => saved.push(structuredClone(state)),
    processArchive: async () => result,
    ensureDirectory: async () => {}
  };
}

test('service remains idle when no task archive exists', async () => {
  const deps = memoryDependencies([], null);
  const service = createUploaderService({ ...deps, downloads: '/Downloads', staging: '/State', adapter: {} });
  const states = [];
  service.on('state', state => states.push(state));
  assert.equal(await service.scanOnce(), null);
  assert.deepEqual(states.at(-1), { phase: 'idle' });
});

test('service emits completed task id and saves processed archive', async () => {
  const candidate = { name: 'figma-task-1.zip', path: '/Downloads/figma-task-1.zip' };
  const deps = memoryDependencies([candidate], { taskId: 'task-1' });
  const service = createUploaderService({ ...deps, downloads: '/Downloads', staging: '/State', adapter: {} });
  const states = [];
  service.on('state', state => states.push(state));
  const result = await service.scanOnce();
  assert.deepEqual(result, { taskId: 'task-1' });
  assert.deepEqual(states.at(-1), { phase: 'success', taskId: 'task-1', archive: 'figma-task-1.zip' });
  assert.deepEqual(deps.saved.at(-1).processed, ['figma-task-1.zip']);
});

test('service preserves failed archive for retry', async () => {
  const candidate = { name: 'figma-task-2.zip', path: '/Downloads/figma-task-2.zip' };
  const deps = memoryDependencies([candidate], null);
  deps.processArchive = async () => { throw new Error('网络中断'); };
  const service = createUploaderService({ ...deps, downloads: '/Downloads', staging: '/State', adapter: {} });
  const states = [];
  service.on('state', state => states.push(state));
  await assert.rejects(service.scanOnce(), /网络中断/);
  assert.deepEqual(states.at(-1), { phase: 'error', message: '网络中断', archive: 'figma-task-2.zip' });
  assert.equal(deps.saved.length, 0);
});

test('service skips concurrent scans', async () => {
  let release;
  const deps = memoryDependencies([{ name: 'figma-task-3.zip' }], { taskId: 'task-3' });
  deps.processArchive = () => new Promise(resolve => { release = () => resolve({ taskId: 'task-3' }); });
  const service = createUploaderService({ ...deps, downloads: '/Downloads', staging: '/State', adapter: {} });
  const first = service.scanOnce();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await service.scanOnce(), null);
  release();
  await first;
});
