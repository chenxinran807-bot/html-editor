const { sha256Hex } = require('../shared/task-archive');

function jsonBytes(value) {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

async function uploadValidatedTask(validated, options) {
  const adapter = options.adapter;
  const user = await adapter.currentUser();
  if (!user?.openId) throw new Error('无法取得当前飞书用户 openId');
  const root = await adapter.ensureFolder('prd-demo-tasks', options.rootFolderToken || null);
  const taskFolder = await adapter.ensureFolder(validated.task.taskId, root);
  const directories = new Map([['', taskFolder]]);
  const requiredDirectories = [...validated.files.keys()]
    .filter(path => path.includes('/'))
    .map(path => path.slice(0, path.lastIndexOf('/')))
    .sort((a, b) => a.split('/').length - b.split('/').length);
  for (const directory of [...new Set(requiredDirectories)]) {
    let parentPath = '';
    for (const segment of directory.split('/')) {
      const path = parentPath ? `${parentPath}/${segment}` : segment;
      if (!directories.has(path)) {
        directories.set(path, await adapter.ensureFolder(segment, directories.get(parentPath)));
      }
      parentPath = path;
    }
  }

  const uploadedTask = { ...validated.task, ownerOpenId: user.openId };
  await adapter.uploadBytes('task.json', jsonBytes(uploadedTask), taskFolder);
  const payloadPaths = [...validated.files.keys()].filter(path => path !== 'task.json');
  payloadPaths.sort((a, b) => {
    if (a === 'figma-export.manifest.json') return -1;
    if (b === 'figma-export.manifest.json') return 1;
    return a.localeCompare(b);
  });
  for (const path of payloadPaths) {
    const slash = path.lastIndexOf('/');
    const directory = slash === -1 ? '' : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    await adapter.uploadBytes(name, validated.files.get(path), directories.get(directory));
  }
  const manifestBytes = validated.files.get('figma-export.manifest.json');
  const completion = {
    completionSchemaVersion: '1.0',
    taskId: validated.task.taskId,
    completedAt: (options.now || (() => new Date().toISOString()))(),
    manifestSha256: await sha256Hex(manifestBytes),
    fileCount: validated.task.files.length + 1
  };
  await adapter.uploadBytes('_COMPLETE.json', jsonBytes(completion), taskFolder);
  return { taskId: validated.task.taskId, folderToken: taskFolder, completion };
}

module.exports = { jsonBytes, uploadValidatedTask };
