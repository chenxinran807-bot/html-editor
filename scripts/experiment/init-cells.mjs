#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function detectedMime(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  return 'application/octet-stream';
}

async function requireRegular(file, label) {
  const info = await lstat(file);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${label} must be a regular file, not a symlink`);
  return info;
}

async function requireDirectory(directory, label) {
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`${label} must be a real directory, not a symlink`);
}

async function existingInfo(target) {
  try { return await lstat(target); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function requireRealContainment(parentReal, target, label) {
  const targetReal = await realpath(target);
  if (targetReal !== parentReal && !targetReal.startsWith(`${parentReal}${path.sep}`)) throw new Error(`${label} is outside its real parent`);
  return targetReal;
}

async function containedRegularFile(root, relative, label) {
  if (typeof relative !== 'string' || path.posix.normalize(relative) !== relative || !relative.startsWith('assets/') || relative.includes('\\')) throw new Error(`${label}: unsafe asset path ${relative}`);
  const rootReal = await realpath(root);
  const file = path.resolve(root, relative);
  await requireRegular(file, `${label}: ${relative}`);
  const fileReal = await realpath(file);
  if (!fileReal.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${label}: asset escapes fixture ${relative}`);
  return fileReal;
}

export async function validateFixtureDirectory(inputRoot, label = inputRoot) {
  await requireDirectory(inputRoot, label);
  await requireDirectory(path.join(inputRoot, 'assets'), `${label}/assets`);
  for (const name of ['source.md', 'metadata.json', 'assets-manifest.json']) await requireRegular(path.join(inputRoot, name), `${label}/${name}`);
  const [source, metadata, manifest] = await Promise.all([
    readFile(path.join(inputRoot, 'source.md')),
    readFile(path.join(inputRoot, 'metadata.json'), 'utf8').then(JSON.parse),
    readFile(path.join(inputRoot, 'assets-manifest.json'), 'utf8').then(JSON.parse),
  ]);
  if (sha256(source) !== metadata.fixtureSha256) throw new Error(`${label}: fixture hash mismatch`);
  if (!Array.isArray(manifest.assets)) throw new Error(`${label}: assets manifest is invalid`);
  if (metadata.assetCount !== manifest.assets.length || manifest.assetCount !== manifest.assets.length) throw new Error(`${label}: asset count mismatch`);
  const expected = new Set();
  for (const asset of manifest.assets) {
    if (expected.has(asset.file)) throw new Error(`${label}: duplicate asset ${asset.file}`);
    expected.add(asset.file);
    const file = await containedRegularFile(inputRoot, asset.file, label);
    const bytes = await readFile(file);
    if (bytes.length !== asset.bytes) throw new Error(`${label}: byte count mismatch for ${asset.file}`);
    if (sha256(bytes) !== asset.sha256) throw new Error(`${label}: hash mismatch for ${asset.file}`);
    if (detectedMime(bytes) !== asset.mime) throw new Error(`${label}: MIME mismatch for ${asset.file}`);
  }
  const actual = new Set();
  async function collect(directory, prefix = 'assets') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = `${prefix}/${entry.name}`;
      const full = path.join(directory, entry.name);
      const info = await lstat(full);
      if (info.isSymbolicLink()) throw new Error(`${label}: symlink asset is forbidden: ${relative}`);
      if (info.isDirectory()) await collect(full, relative);
      else if (info.isFile()) actual.add(relative);
      else throw new Error(`${label}: asset is not a regular file: ${relative}`);
    }
  }
  await collect(path.join(inputRoot, 'assets'));
  if (actual.size !== expected.size || [...actual].some((file) => !expected.has(file))) throw new Error(`${label}: assets directory has extra or missing files compared with manifest`);
  return { inputRoot, assets: manifest.assets.map(({ file }) => file) };
}

function validateManifest(manifest) {
  if (!Array.isArray(manifest.inputs) || manifest.inputs.length !== 2 || !Array.isArray(manifest.skills) || manifest.skills.length !== 6) throw new Error('Manifest must define exactly 2 inputs and 6 skill objects (12 cells)');
  const inputIds = manifest.inputs;
  const skillIds = manifest.skills.map((skill) => skill?.id);
  for (const [kind, ids] of [['input', inputIds], ['skill', skillIds]]) {
    if (ids.some((id) => typeof id !== 'string' || !SLUG.test(id))) throw new Error(`Manifest contains unsafe ${kind} id`);
    if (new Set(ids).size !== ids.length) throw new Error(`Manifest contains duplicate ${kind} id`);
  }
}

async function ensureExactExistingCell(cell, fixture, cellsReal) {
  await requireDirectory(cell, `existing cell ${cell}`);
  await requireRealContainment(cellsReal, cell, `existing cell ${cell}`);
  const entries = (await readdir(cell)).sort();
  if (entries.join('\0') !== ['artifact', 'input', 'qa', 'run'].sort().join('\0')) throw new Error(`Existing cell differs from isolated layout: ${cell}`);
  for (const empty of ['run', 'artifact', 'qa']) {
    const directory = path.join(cell, empty);
    await requireDirectory(directory, directory);
    if ((await readdir(directory)).length) throw new Error(`Refusing to overwrite non-empty existing cell: ${cell}`);
  }
  const input = path.join(cell, 'input');
  const copied = await validateFixtureDirectory(input, `existing cell ${cell}`);
  if (copied.assets.join('\0') !== fixture.assets.join('\0')) throw new Error(`Existing cell differs from source fixture: ${cell}`);
  for (const relative of ['source.md', 'metadata.json', 'assets-manifest.json', ...fixture.assets]) {
    const [source, target] = await Promise.all([readFile(path.join(fixture.inputRoot, relative)), readFile(path.join(input, relative))]);
    if (!source.equals(target)) throw new Error(`Existing cell differs from source fixture: ${cell}/${relative}`);
  }
}

async function createCellAtomically(cell, fixture, cellsRoot, cellsReal) {
  const parent = path.dirname(cell);
  const parentInfo = await existingInfo(parent);
  if (parentInfo) await requireDirectory(parent, `cell parent ${parent}`);
  else await mkdir(parent, { recursive: true });
  await requireRealContainment(cellsReal, parent, `cell parent ${parent}`);
  if (await existingInfo(cell)) throw new Error(`Cell appeared after preflight; refusing overwrite: ${cell}`);
  const temporary = path.join(parent, `.${path.basename(cell)}.tmp-${randomUUID()}`);
  try {
    for (const name of ['input/assets', 'run', 'artifact', 'qa']) await mkdir(path.join(temporary, name), { recursive: true });
    for (const relative of ['source.md', 'metadata.json', 'assets-manifest.json', ...fixture.assets]) {
      const destination = path.join(temporary, 'input', relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(fixture.inputRoot, relative), destination);
    }
    await validateFixtureDirectory(path.join(temporary, 'input'), `temporary cell ${cell}`);
    await rename(temporary, cell);
    await requireDirectory(cell, `created cell ${cell}`);
    await requireRealContainment(cellsReal, cell, `created cell ${cell}`);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

export async function initializeCells(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')) {
  await requireDirectory(root, 'experiment repository root');
  const rootReal = await realpath(root);
  const experimentsRoot = path.join(root, 'experiments');
  await requireDirectory(experimentsRoot, 'experiments root');
  const experimentsReal = await requireRealContainment(rootReal, experimentsRoot, 'experiments root');
  const manifestFile = path.join(experimentsRoot, 'manifest.json');
  await requireRegular(manifestFile, 'experiments/manifest.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  validateManifest(manifest);
  const fixtures = new Map();
  for (const inputId of manifest.inputs) {
    const inputRoot = path.resolve(experimentsRoot, 'inputs', inputId);
    const expectedParent = path.resolve(experimentsRoot, 'inputs');
    if (!inputRoot.startsWith(`${expectedParent}${path.sep}`)) throw new Error(`Manifest input escapes inputs root: ${inputId}`);
    fixtures.set(inputId, await validateFixtureDirectory(inputRoot, inputId));
  }
  const cellsRoot = path.join(experimentsRoot, 'cells');
  const cellsInfo = await existingInfo(cellsRoot);
  let cellsReal = null;
  if (cellsInfo) {
    await requireDirectory(cellsRoot, 'cells root');
    cellsReal = await requireRealContainment(experimentsReal, cellsRoot, 'cells root');
  }
  const plan = [];
  for (const inputId of manifest.inputs) for (const { id: skillId } of manifest.skills) {
    const cell = path.resolve(cellsRoot, inputId, skillId);
    if (!cell.startsWith(`${cellsRoot}${path.sep}`)) throw new Error('Cell path escapes cells root');
    const info = await existingInfo(cell);
    if (info) {
      if (!cellsReal) throw new Error('Existing cell found without a safe cells root');
      await ensureExactExistingCell(cell, fixtures.get(inputId), cellsReal);
    } else plan.push({ cell, fixture: fixtures.get(inputId) });
  }
  if (plan.length) {
    if (!cellsInfo) {
      await mkdir(cellsRoot);
      await requireDirectory(cellsRoot, 'created cells root');
      cellsReal = await requireRealContainment(experimentsReal, cellsRoot, 'created cells root');
    }
    for (const item of plan) await createCellAtomically(item.cell, item.fixture, cellsRoot, cellsReal);
  }
  return { cells: 12 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await initializeCells();
  console.log(`Initialized or verified ${result.cells} isolated experiment cells.`);
}
