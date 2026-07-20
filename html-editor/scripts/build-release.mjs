import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const VERSION = '1.1.0';
const ALLOWED = [
  'SKILL.md',
  'CHANGELOG.md',
  'assets/annotator-inject.js',
  'scripts/wrap_annotator.py'
];

function checksum(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function buildRelease(options = {}) {
  const outputDirectory = path.resolve(options.outputDirectory || path.join(ROOT, 'dist'));
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'html-editor-build-'));
  const packageRoot = path.join(temporaryRoot, 'html-editor');
  fs.mkdirSync(packageRoot, { recursive: true });

  for (const relativePath of ALLOWED) {
    const sourcePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing release file: ${relativePath}`);
    const destinationPath = path.join(packageRoot, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }

  fs.mkdirSync(outputDirectory, { recursive: true });
  const zipName = `html-editor-${VERSION}.zip`;
  const zipPath = path.join(outputDirectory, zipName);
  const checksumPath = `${zipPath}.sha256`;
  fs.rmSync(zipPath, { force: true });
  execFileSync('/usr/bin/ditto', ['-c', '-k', '--norsrc', '--noextattr', '--keepParent', packageRoot, zipPath], {
    env: { ...process.env, COPYFILE_DISABLE: '1' }
  });
  fs.writeFileSync(checksumPath, `${checksum(zipPath)}  ${zipName}\n`, 'utf8');
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
  return { zipPath, checksumPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = buildRelease();
  console.log(result.zipPath);
  console.log(result.checksumPath);
}
