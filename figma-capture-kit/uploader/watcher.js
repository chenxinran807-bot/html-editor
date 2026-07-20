const { readdir, stat, readFile, mkdir, writeFile, rename } = require('node:fs/promises');
const { join } = require('node:path');
const { validateTaskArchive } = require('./archive-validator');
const { uploadValidatedTask } = require('./upload-task');

const TASK_ZIP = /^figma-task-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.zip$/i;

async function findCandidateArchives(directory, options = {}) {
  const processed = new Set(options.processed || []);
  const now = options.now || Date.now();
  const stableForMs = options.stableForMs ?? 3000;
  const entries = await readdir(directory, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !TASK_ZIP.test(entry.name) || processed.has(entry.name)) continue;
    const info = await stat(join(directory, entry.name));
    if (now - info.mtimeMs < stableForMs) continue;
    candidates.push({ name: entry.name, path: join(directory, entry.name), size: info.size, mtimeMs: info.mtimeMs });
  }
  return candidates.sort((a, b) => a.mtimeMs - b.mtimeMs);
}

async function loadState(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: '1.0', processed: [] };
    throw error;
  }
}

async function saveState(path, state) {
  await mkdir(require('node:path').dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporary, path);
}

async function processArchive(candidate, options) {
  const bytes = await readFile(candidate.path);
  const validated = await validateTaskArchive(bytes, { filename: candidate.name });
  return uploadValidatedTask(validated, options);
}

module.exports = { TASK_ZIP, findCandidateArchives, loadState, saveState, processArchive };

