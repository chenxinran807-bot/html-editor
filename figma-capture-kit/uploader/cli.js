#!/usr/bin/env node
const { homedir } = require('node:os');
const { join, resolve } = require('node:path');
const { mkdir } = require('node:fs/promises');
const { createLarkCliAdapter } = require('./lark-cli');
const { findCandidateArchives, loadState, saveState, processArchive } = require('./watcher');

function parseArgs(argv) {
  const options = { mode: 'once', intervalMs: 3000 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--watch') options.mode = 'watch';
    else if (arg === '--once') options.mode = 'once';
    else if (arg === '--downloads') options.downloads = resolve(argv[++index]);
    else if (arg === '--staging') options.staging = resolve(argv[++index]);
    else if (arg === '--folder-token') options.folderToken = argv[++index];
    else if (arg === '--interval-ms') options.intervalMs = Number(argv[++index]);
    else throw new Error(`未知参数: ${arg}`);
  }
  options.downloads ||= join(homedir(), 'Downloads');
  options.staging ||= join(homedir(), 'Library', 'Application Support', 'Figma Capture Uploader');
  return options;
}

async function runOnce(options, adapter) {
  await mkdir(options.staging, { recursive: true });
  const statePath = join(options.staging, 'state.json');
  const state = await loadState(statePath);
  const candidates = await findCandidateArchives(options.downloads, { processed: state.processed });
  for (const candidate of candidates) {
    process.stdout.write(`正在上传 ${candidate.name}…\n`);
    const result = await processArchive(candidate, { adapter, rootFolderToken: options.folderToken || null });
    state.processed.push(candidate.name);
    state.lastTaskId = result.taskId;
    state.updatedAt = new Date().toISOString();
    await saveState(statePath, state);
    process.stdout.write(`已完成任务 ${result.taskId}\n`);
  }
  return candidates.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const adapter = createLarkCliAdapter();
  if (options.mode === 'once') return runOnce(options, adapter);
  process.stdout.write(`正在监听 ${options.downloads}\n`);
  for (;;) {
    try { await runOnce(options, adapter); }
    catch (error) { process.stderr.write(`${new Date().toISOString()} ${String(error?.message || error)}\n`); }
    await new Promise(resolveWait => setTimeout(resolveWait, options.intervalMs));
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${String(error?.stack || error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, runOnce };

