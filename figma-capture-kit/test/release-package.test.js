const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
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
