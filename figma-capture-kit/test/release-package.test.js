const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { listFiles, assertReleaseContents } = require('../desktop-app/release');

async function touch(root, path) {
  const full = join(root, path);
  await mkdir(require('node:path').dirname(full), { recursive: true });
  await writeFile(full, 'fixture');
}

test('release accepts the complete user-facing layout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'figma-release-test-'));
  try {
    const required = [
      'Figma采集助手.app/Contents/Info.plist',
      'Figma采集助手.app/Contents/Resources/app/desktop-app/main.js',
      'Figma采集助手.app/Contents/Resources/lark-cli/scripts/run.js',
      'Figma插件/manifest.json', 'Figma插件/code.js', 'Figma插件/ui.html',
      '安装说明.md', '使用说明.md', '常见问题.md', 'MVP验收报告.md', '版本说明.md', '后续迭代方向.md'
    ];
    for (const path of required) await touch(root, path);
    assert.equal(assertReleaseContents(await listFiles(root)), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('release rejects credentials and development debris', () => {
  const files = [
    'Figma采集助手.app/Contents/Info.plist',
    'Figma采集助手.app/Contents/Resources/app/desktop-app/main.js',
    'Figma采集助手.app/Contents/Resources/lark-cli/scripts/run.js',
    'Figma插件/manifest.json', 'Figma插件/code.js', 'Figma插件/ui.html',
    '安装说明.md', '使用说明.md', '常见问题.md', 'MVP验收报告.md', '版本说明.md', '后续迭代方向.md',
    'auth-qr.png'
  ];
  assert.throws(() => assertReleaseContents(files), /禁止文件/);
});

test('2.0.2 release documents immutable roots and daily two-step use', async () => {
  const project = join(__dirname, '..');
  const packageJson = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
  const uploader = await readFile(join(project, 'uploader', 'upload-task.js'), 'utf8');
  const usage = await readFile(join(project, 'release-docs', '使用说明.md'), 'utf8');
  assert.equal(packageJson.version, '2.0.2');
  assert.match(uploader, /_PRD_DEMO_ROOT\.json/);
  assert.match(usage, /一次安装/);
  assert.match(usage, /日常两步/);
  assert.match(usage, /兼容的 Agent/);
  assert.match(usage, /任务文件夹链接或 ZIP/);
});
