import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

await build({
  entryPoints: ['figma-plugin/src/main.js'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'figma-plugin/code.js',
  target: ['es2017']
});

await build({
  entryPoints: ['figma-plugin/src/ui.js'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'figma-plugin/ui.bundle.js',
  target: ['es2020']
});

const template = await readFile('figma-plugin/ui-template.html', 'utf8');
const bundle = await readFile('figma-plugin/ui.bundle.js', 'utf8');
await writeFile('figma-plugin/ui.html', template.replace('/*__UI_BUNDLE__*/', bundle));

