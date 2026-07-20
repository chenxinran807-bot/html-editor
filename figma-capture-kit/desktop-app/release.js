const { cp, mkdir, rm, readdir, readFile, writeFile, stat } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { join, relative, resolve } = require('node:path');

const execFileAsync = promisify(execFile);
const VERSION = require('../package.json').version;

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, full));
    else files.push(relative(root, full));
  }
  return files.sort();
}

function assertReleaseContents(files) {
  const required = [
    'Figma采集助手.app/Contents/Info.plist',
    'Figma采集助手.app/Contents/Resources/app/desktop-app/main.js',
    'Figma采集助手.app/Contents/Resources/lark-cli/scripts/run.js',
    'Figma插件/manifest.json',
    'Figma插件/code.js',
    'Figma插件/ui.html',
    '安装说明.md', '使用说明.md', '常见问题.md', 'MVP验收报告.md', '版本说明.md', '后续迭代方向.md'
  ];
  for (const path of required) {
    if (!files.includes(path)) throw new Error(`发布包缺少文件：${path}`);
  }
  const forbidden = files.filter(path => /(^|\/)(\.DS_Store|test|tests)(\/|$)|auth-qr|\.env($|\.)|\.map$|access[_-]?token|app[_-]?secret/i.test(path));
  if (forbidden.length) throw new Error(`发布包含禁止文件：${forbidden.join(', ')}`);
  return true;
}

async function removeJunk(root) {
  for (const file of await listFiles(root)) {
    if (file.endsWith('.DS_Store') || file.endsWith('.map')) await rm(join(root, file), { force: true });
  }
}

async function assembleRelease(projectRoot) {
  const dist = join(projectRoot, 'dist');
  const staging = join(dist, `Figma采集助手-MVP-v${VERSION}`);
  const packagedApp = join(dist, 'desktop', 'Figma采集助手-darwin-arm64', 'Figma采集助手.app');
  await stat(packagedApp);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  await cp(packagedApp, join(staging, 'Figma采集助手.app'), { recursive: true, dereference: true });

  const pluginTarget = join(staging, 'Figma插件');
  await mkdir(pluginTarget, { recursive: true });
  for (const name of ['manifest.json', 'code.js', 'ui.html', 'ui.bundle.js']) {
    await cp(join(projectRoot, 'figma-plugin', name), join(pluginTarget, name));
  }
  await cp(join(projectRoot, 'chrome-extension'), join(staging, '高级兜底工具', 'Chrome扩展'), { recursive: true });
  for (const name of ['安装说明.md','使用说明.md','常见问题.md','MVP验收报告.md','版本说明.md','后续迭代方向.md']) {
    await cp(join(projectRoot, 'release-docs', name), join(staging, name));
  }
  await removeJunk(staging);
  const files = await listFiles(staging);
  assertReleaseContents(files);

  const zipPath = join(dist, `Figma采集助手-MVP-v${VERSION}-arm64.zip`);
  await rm(zipPath, { force: true });
  await execFileAsync('/usr/bin/ditto', ['-c', '-k', '--keepParent', staging, zipPath]);
  const hash = createHash('sha256').update(await readFile(zipPath)).digest('hex');
  const checksumPath = `${zipPath}.sha256`;
  await writeFile(checksumPath, `${hash}  ${zipPath.split('/').pop()}\n`);
  return { staging, zipPath, checksumPath, hash, files };
}

if (require.main === module) {
  assembleRelease(resolve(__dirname, '..')).then(result => {
    process.stdout.write(`${JSON.stringify({ zipPath: result.zipPath, checksumPath: result.checksumPath, sha256: result.hash, fileCount: result.files.length }, null, 2)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { VERSION, listFiles, assertReleaseContents, assembleRelease };
