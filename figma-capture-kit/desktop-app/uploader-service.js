const { EventEmitter } = require('node:events');
const { join } = require('node:path');
const { mkdir } = require('node:fs/promises');
const watcher = require('../uploader/watcher');

function createUploaderService(options) {
  const events = new EventEmitter();
  const findCandidateArchives = options.findCandidateArchives || watcher.findCandidateArchives;
  const loadState = options.loadState || watcher.loadState;
  const saveState = options.saveState || watcher.saveState;
  const processArchive = options.processArchive || watcher.processArchive;
  const ensureDirectory = options.ensureDirectory || (path => mkdir(path, { recursive: true }));
  const intervalMs = options.intervalMs || 3000;
  const statePath = join(options.staging, 'state.json');
  let timer = null;
  let scanning = false;

  function emit(state) {
    events.emit('state', state);
  }

  async function scanOnce() {
    if (scanning) return null;
    scanning = true;
    try {
      await ensureDirectory(options.staging);
      const state = await loadState(statePath);
      const candidates = await findCandidateArchives(options.downloads, { processed: state.processed });
      if (!candidates.length) {
        emit({ phase: 'idle' });
        return null;
      }
      let latest = null;
      for (const candidate of candidates) {
        emit({ phase: 'uploading', archive: candidate.name });
        try {
          latest = await processArchive(candidate, { adapter: options.adapter, rootFolderToken: options.folderToken || null });
        } catch (error) {
          const message = String(error?.message || error);
          emit({ phase: 'error', message, archive: candidate.name });
          throw error;
        }
        state.processed.push(candidate.name);
        state.lastTaskId = latest.taskId;
        state.updatedAt = new Date().toISOString();
        await saveState(statePath, state);
        emit({ phase: 'success', taskId: latest.taskId, archive: candidate.name });
      }
      return latest;
    } finally {
      scanning = false;
    }
  }

  function start() {
    if (timer) return;
    scanOnce().catch(() => {});
    timer = setInterval(() => scanOnce().catch(() => {}), intervalMs);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    on: (event, listener) => { events.on(event, listener); return service; },
    scanOnce,
    start,
    stop
  };

  function service() {}
}

module.exports = { createUploaderService };
