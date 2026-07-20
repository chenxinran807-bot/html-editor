import { packager } from '@electron/packager';
import { cp, mkdir, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = join(projectRoot, 'dist', 'desktop');
const larkCliSource = process.env.LARK_CLI_SOURCE || '/opt/homebrew/lib/node_modules/@larksuite/cli';

await access(join(larkCliSource, 'scripts', 'run.js')).catch(() => {
  throw new Error(`找不到可打包的 lark-cli：${larkCliSource}。请先在构建机安装 @larksuite/cli。`);
});

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const [bundleDirectory] = await packager({
  dir: projectRoot,
  out: outDir,
  name: 'Figma采集助手',
  executableName: 'Figma采集助手',
  appBundleId: 'com.bytedance.internal.figma-capture-helper',
  appVersion: '2.0.0',
  buildVersion: '2.0.0',
  platform: 'darwin',
  arch: 'arm64',
  overwrite: true,
  prune: true,
  asar: false,
  ignore: [
    /^\/dist($|\/)/,
    /^\/test($|\/)/,
    /^\/docs($|\/)/,
    /^\/release-docs($|\/)/,
    /^\/chrome-extension($|\/)/,
    /^\/figma-plugin($|\/)/,
    /^\/samples($|\/)/,
    /^\/skill($|\/)/,
    /^\/scripts($|\/)/,
    /^\/HANDOFF/,
    /^\/M3-HANDOFF/,
    /^\/\.DS_Store$/
  ]
});

const resources = join(bundleDirectory, 'Figma采集助手.app', 'Contents', 'Resources');
await cp(larkCliSource, join(resources, 'lark-cli'), { recursive: true, dereference: true });
await cp(join(projectRoot, 'figma-plugin'), join(resources, 'figma-plugin'), {
  recursive: true,
  filter: source => !source.includes(`${join('figma-plugin', 'src')}`)
});

process.stdout.write(`${join(bundleDirectory, 'Figma采集助手.app')}\n`);
