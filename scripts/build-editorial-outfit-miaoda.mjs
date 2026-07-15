import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'work/editorial-outfit-tab');
const outputDir = path.join(root, 'work/editorial-outfit-tab-miaoda');

const read = (name) => fs.readFileSync(path.join(sourceDir, name), 'utf8');
const withoutExports = (source) => source.replace(/^export\s+/gm, '');
const withoutImports = (source) => source.replace(/^import\s+[\s\S]*?;\s*/gm, '');

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(path.join(sourceDir, 'tokens.css'), path.join(outputDir, 'tokens.css'));
fs.copyFileSync(path.join(sourceDir, 'styles.css'), path.join(outputDir, 'styles.css'));
fs.cpSync(path.join(sourceDir, 'assets'), path.join(outputDir, 'assets'), { recursive: true });
fs.writeFileSync(
  path.join(outputDir, 'index.html'),
  read('index.html').replace('<script type="module" src="./app.mjs"></script>', '<script defer src="./app.bundle.js"></script>'),
);

const bundle = [
  '(() => {',
  "'use strict';",
  withoutExports(read('catalog.mjs')),
  'const catalogChannels = channels;',
  withoutExports(withoutImports(read('state.mjs'))),
  withoutExports(read('render.mjs')),
  withoutImports(read('app.mjs')),
  '})();',
].join('\n\n');

fs.writeFileSync(path.join(outputDir, 'app.bundle.js'), bundle);
