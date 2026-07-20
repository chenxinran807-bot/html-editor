const JSZip = require('jszip');
const { sha256 } = require('@noble/hashes/sha256');
const { createTaskEnvelope, assertRelativeTaskPath } = require('./task-protocol');

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value);
}

async function sha256Hex(value) {
  const bytes = toBytes(value);
  return [...sha256(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function buildTaskArchive(input) {
  const zip = new JSZip();
  const payload = [];
  const manifestText = `${JSON.stringify(input.manifest, null, 2)}\n`;
  payload.push({ path: 'figma-export.manifest.json', kind: 'manifest', bytes: toBytes(manifestText) });
  for (const file of input.files || []) {
    payload.push({ ...file, path: assertRelativeTaskPath(file.path), bytes: toBytes(file.bytes) });
  }
  const inventory = [];
  for (const file of payload) {
    inventory.push({
      path: file.path,
      kind: file.kind,
      ...(file.nodeId ? { nodeId: file.nodeId } : {}),
      sha256: await sha256Hex(file.bytes),
      bytes: file.bytes.byteLength
    });
    zip.file(file.path, file.bytes);
  }
  const task = createTaskEnvelope({
    taskId: input.taskId,
    createdAt: input.createdAt,
    figma: input.figma,
    files: inventory
  });
  zip.file('task.json', `${JSON.stringify(task, null, 2)}\n`);
  return {
    filename: `figma-task-${input.taskId}.zip`,
    bytes: await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } }),
    task
  };
}

async function inspectTaskArchive(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const paths = Object.keys(zip.files).filter(path => !zip.files[path].dir);
  const taskEntry = zip.file('task.json');
  const manifestEntry = zip.file('figma-export.manifest.json');
  if (!taskEntry || !manifestEntry) throw new Error('任务 ZIP 缺少 task.json 或 figma-export.manifest.json');
  const task = JSON.parse(await taskEntry.async('string'));
  const manifest = JSON.parse(await manifestEntry.async('string'));
  return { zip, paths, task, manifest };
}

module.exports = { toBytes, sha256Hex, buildTaskArchive, inspectTaskArchive };
