#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function detectedMime(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  return 'application/octet-stream';
}

async function directoryHasEntries(directory) {
  try { return (await readdir(directory)).length > 0; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function findArtifactContent(cellsRoot) {
  async function walk(directory) {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (path.basename(directory) === 'artifact' && entries.length) return directory;
    for (const entry of entries) if (entry.isDirectory()) {
      const found = await walk(path.join(directory, entry.name));
      if (found) return found;
    }
    return null;
  }
  return walk(cellsRoot);
}

function safeAssetPath(inputRoot, relative) {
  if (typeof relative !== 'string' || !relative.startsWith('assets/')) throw new Error(`Unsafe asset path: ${relative}`);
  const resolved = path.resolve(inputRoot, relative);
  if (!resolved.startsWith(`${path.resolve(inputRoot)}${path.sep}`)) throw new Error(`Asset escapes input: ${relative}`);
  return resolved;
}

export async function validateFixtureDirectory(inputRoot, label = inputRoot) {
  const [source, metadata, manifest] = await Promise.all([
    readFile(path.join(inputRoot, 'source.md')),
    readFile(path.join(inputRoot, 'metadata.json'), 'utf8').then(JSON.parse),
    readFile(path.join(inputRoot, 'assets-manifest.json'), 'utf8').then(JSON.parse),
  ]);
  if (sha256(source) !== metadata.fixtureSha256) throw new Error(`${label}: fixture hash mismatch`);
  if (!Array.isArray(manifest.assets)) throw new Error(`${label}: assets manifest is invalid`);
  if (metadata.assetCount !== manifest.assets.length || manifest.assetCount !== manifest.assets.length) throw new Error(`${label}: asset count mismatch`);
  const seen = new Set();
  for (const asset of manifest.assets) {
    if (seen.has(asset.file)) throw new Error(`${label}: duplicate asset ${asset.file}`);
    seen.add(asset.file);
    const file = safeAssetPath(inputRoot, asset.file);
    const bytes = await readFile(file);
    if (bytes.length !== asset.bytes) throw new Error(`${label}: byte count mismatch for ${asset.file}`);
    if (sha256(bytes) !== asset.sha256) throw new Error(`${label}: hash mismatch for ${asset.file}`);
    if (detectedMime(bytes) !== asset.mime) throw new Error(`${label}: MIME mismatch for ${asset.file}`);
  }
  return inputRoot;
}

export async function initializeCells(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')) {
  const cellsRoot = path.join(root, 'experiments', 'cells');
  const existingArtifact = await findArtifactContent(cellsRoot);
  if (existingArtifact) throw new Error(`Refusing to overwrite existing artifact: ${existingArtifact}`);

  const manifest = JSON.parse(await readFile(path.join(root, 'experiments', 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.inputs) || !Array.isArray(manifest.skills) || manifest.skills.some((skill) => !skill || typeof skill.id !== 'string')) throw new Error('experiments/manifest.json must define inputs and skill objects');
  if (manifest.inputs.length * manifest.skills.length !== 12) throw new Error('Manifest must define exactly 12 experiment cells');

  const validated = new Map();
  for (const inputId of manifest.inputs) {
    const inputRoot = path.join(root, 'experiments', 'inputs', inputId);
    validated.set(inputId, await validateFixtureDirectory(inputRoot, inputId));
  }

  for (const inputId of manifest.inputs) for (const { id: skillId } of manifest.skills) {
    const cell = path.join(cellsRoot, inputId, skillId);
    const artifact = path.join(cell, 'artifact');
    if (await directoryHasEntries(artifact)) throw new Error(`Refusing to overwrite existing artifact: ${artifact}`);
    await Promise.all(['input', 'run', 'artifact', 'qa'].map((name) => mkdir(path.join(cell, name), { recursive: true })));
    const source = validated.get(inputId);
    const target = path.join(cell, 'input');
    await Promise.all([
      cp(path.join(source, 'source.md'), path.join(target, 'source.md')),
      cp(path.join(source, 'metadata.json'), path.join(target, 'metadata.json')),
      cp(path.join(source, 'assets-manifest.json'), path.join(target, 'assets-manifest.json')),
      cp(path.join(source, 'assets'), path.join(target, 'assets'), { recursive: true }),
    ]);
    await validateFixtureDirectory(target, `${inputId}/${skillId} copied fixture`);
  }
  return { cells: 12 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await initializeCells();
  console.log(`Initialized ${result.cells} isolated experiment cells.`);
}
