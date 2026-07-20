const JSZip = require('jszip');
const { assertRelativeTaskPath } = require('../shared/task-protocol');
const { sha256Hex } = require('../shared/task-archive');

async function validateTaskArchive(input, options = {}) {
  const bytes = await input;
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);
  const actualPaths = new Set();
  for (const [path, entry] of entries) {
    const original = entry.unsafeOriginalName || path;
    assertRelativeTaskPath(original);
    const normalized = assertRelativeTaskPath(path);
    if (actualPaths.has(normalized)) throw new Error(`ZIP 包含重复路径: ${normalized}`);
    actualPaths.add(normalized);
  }
  if (!actualPaths.has('task.json') || !actualPaths.has('figma-export.manifest.json')) {
    throw new Error('任务 ZIP 缺少 task.json 或 figma-export.manifest.json');
  }
  const task = JSON.parse(await zip.file('task.json').async('string'));
  const manifest = JSON.parse(await zip.file('figma-export.manifest.json').async('string'));
  if (task.taskSchemaVersion !== '1.0') throw new Error(`不支持的 task schema: ${task.taskSchemaVersion}`);
  if (manifest.schemaVersion !== '1.0' || !manifest.exporter || !Array.isArray(manifest.pages)) {
    throw new Error('不支持的 unified manifest 结构');
  }
  const expectedFilename = `figma-task-${task.taskId}.zip`;
  if (options.filename && options.filename !== expectedFilename) {
    throw new Error(`文件名中的 taskId 与 task.json 不一致，应为 ${expectedFilename}`);
  }
  const expectedPaths = new Set(['task.json']);
  const files = new Map();
  files.set('task.json', await zip.file('task.json').async('uint8array'));
  for (const item of task.files || []) {
    const path = assertRelativeTaskPath(item.path);
    if (expectedPaths.has(path)) throw new Error(`任务清单包含重复路径: ${path}`);
    expectedPaths.add(path);
    const entry = zip.file(path);
    if (!entry) throw new Error(`任务 ZIP 缺少文件: ${path}`);
    const content = await entry.async('uint8array');
    if (content.byteLength !== item.bytes) throw new Error(`文件大小不匹配: ${path}`);
    if (await sha256Hex(content) !== item.sha256) throw new Error(`SHA-256 不匹配: ${path}`);
    files.set(path, content);
  }
  for (const path of actualPaths) {
    if (!expectedPaths.has(path)) throw new Error(`任务 ZIP 包含未登记文件: ${path}`);
  }
  for (const path of expectedPaths) {
    if (!actualPaths.has(path)) throw new Error(`任务 ZIP 缺少文件: ${path}`);
  }
  return { task, manifest, files };
}

module.exports = { validateTaskArchive };

