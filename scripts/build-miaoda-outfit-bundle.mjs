import fs from 'node:fs';
import path from 'node:path';

const sourceDir = path.resolve('work/douyin-outfit-content-feed');
const outputDir = path.resolve('work/douyin-outfit-content-feed-publish');

const stripModuleSyntax = (source) => source
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+/gm, '');

const sourceHtml = fs.readFileSync(path.join(sourceDir, 'index.html'), 'utf8');
const catalog = stripModuleSyntax(fs.readFileSync(path.join(sourceDir, 'catalog.js'), 'utf8'));
const state = stripModuleSyntax(fs.readFileSync(path.join(sourceDir, 'state.js'), 'utf8'));

const moduleStart = /<script\s+type="module">\s*import\s+\{[^;]+;\s*import\s+\{[^;]+;\s*/;
if (!moduleStart.test(sourceHtml)) {
  throw new Error('Expected the prototype entry to contain two ES module imports');
}

const bundledHtml = sourceHtml.replace(
  moduleStart,
  `<script>\n${catalog}\n${state}\n`,
);

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outputDir, 'assets'), { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), bundledHtml);

for (const name of fs.readdirSync(path.join(sourceDir, 'assets'))) {
  if (!name.endsWith('.svg')) continue;
  fs.copyFileSync(
    path.join(sourceDir, 'assets', name),
    path.join(outputDir, 'assets', name),
  );
}

console.log(`Built Miaoda bundle at ${outputDir}`);

