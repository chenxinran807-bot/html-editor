#!/usr/bin/env node
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HELP = `Usage: node qa/native-experiment.mjs --url <url> --tasks <tasks.json> --output <dir> --viewport <width>x<height>

Required flags:
  --url       Prototype URL to inspect
  --tasks     JSON task file
  --output    Directory for qa.json and checkpoint screenshots
  --viewport  Browser viewport, for example 390x844
`;

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!flag?.startsWith('--') || argv[index + 1] === undefined) throw new Error(`Invalid argument: ${flag ?? ''}`);
    args[flag.slice(2)] = argv[index + 1];
  }
  for (const name of ['url', 'tasks', 'output', 'viewport']) {
    if (!args[name]) throw new Error(`Missing required flag: --${name}`);
  }
  const match = /^(\d+)x(\d+)$/.exec(args.viewport);
  if (!match) throw new Error('--viewport must use <width>x<height>');
  args.viewport = { width: Number(match[1]), height: Number(match[2]) };
  if (args.viewport.width < 1 || args.viewport.height < 1) throw new Error('Viewport dimensions must be positive');
  return args;
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function findPlaywrightCore(root) {
  if (process.env.NATIVE_QA_PLAYWRIGHT_CORE) return process.env.NATIVE_QA_PLAYWRIGHT_CORE;
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    const direct = path.join(dir, 'node_modules', 'playwright-core', 'index.mjs');
    if (await exists(direct)) return direct;
    if (depth >= 6) continue;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory() || ['.git', 'dist', 'node_modules', '.pnpm-store'].includes(entry.name)) continue;
      queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
    }
  }
  throw new Error('playwright-core was not found in the project; install an existing project browser dependency first');
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'task';
}

async function runStep(page, step) {
  if (step.action === 'click') {
    await page.locator(step.selector).click({ timeout: 2_000 });
    return;
  }
  if (step.action === 'expectVisible') {
    await page.locator(step.selector).waitFor({ state: 'visible', timeout: 2_000 });
    return;
  }
  if (step.action === 'expectText') {
    const locator = page.locator(step.selector);
    await locator.waitFor({ state: 'visible', timeout: 2_000 });
    const text = await locator.textContent();
    if (!text?.includes(step.text)) throw new Error(`Expected ${step.selector} to contain ${JSON.stringify(step.text)}`);
    return;
  }
  if (step.action === 'wait') {
    await page.waitForTimeout(Number(step.ms) || 0);
    return;
  }
  throw new Error(`Unsupported action: ${step.action}`);
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n${HELP}`); process.exitCode = 2; return; }
  if (args.help) { process.stdout.write(HELP); return; }

  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  await mkdir(args.output, { recursive: true });
  const taskDocument = JSON.parse(await readFile(args.tasks, 'utf8'));
  const taskDefinitions = Array.isArray(taskDocument) ? taskDocument : taskDocument.tasks;
  if (!Array.isArray(taskDefinitions)) throw new Error('Task file must be an array or an object with a tasks array');

  const projectRoot = path.resolve(import.meta.dirname, '..');
  const playwrightEntry = await findPlaywrightCore(projectRoot);
  const { chromium } = await import(pathToFileURL(playwrightEntry).href);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: args.viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedSteps = [];
  const tasks = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push({ type: 'error', text: message.text() });
  });
  page.on('pageerror', (error) => pageErrors.push({ name: error.name, message: error.message }));

  try {
    await page.goto(args.url, { waitUntil: 'domcontentloaded' });
    for (let taskIndex = 0; taskIndex < taskDefinitions.length; taskIndex += 1) {
      const definition = taskDefinitions[taskIndex];
      const taskStarted = Date.now();
      let status = 'PASS';
      let errorMessage;
      for (let stepIndex = 0; stepIndex < (definition.steps ?? []).length; stepIndex += 1) {
        const step = definition.steps[stepIndex];
        try { await runStep(page, step); }
        catch (error) {
          status = 'FAIL';
          errorMessage = error.message;
          failedSteps.push({ task: definition.name, stepIndex, action: step.action, selector: step.selector, message: error.message });
          break;
        }
      }
      const checkpoint = `${String(taskIndex + 1).padStart(2, '0')}-${slug(definition.name)}.png`;
      await page.screenshot({ path: path.join(args.output, checkpoint), fullPage: true });
      tasks.push({ name: definition.name, status, checkpoint, elapsedMs: Date.now() - taskStarted, ...(errorMessage ? { error: errorMessage } : {}) });
    }
  } finally {
    await browser.close();
  }

  const finished = Date.now();
  const status = failedSteps.length || consoleErrors.length || pageErrors.length ? 'FAIL' : 'PASS';
  const report = {
    url: args.url,
    viewport: args.viewport,
    status,
    startedAt,
    finishedAt: new Date(finished).toISOString(),
    elapsedMs: finished - started,
    tasks,
    consoleErrors,
    pageErrors,
    failedSteps,
  };
  await writeFile(path.join(args.output, 'qa.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${path.join(args.output, 'qa.json')}\n`);
  if (status === 'FAIL') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 2;
});
