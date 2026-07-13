import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const runner = path.join(root, 'qa/native-experiment.mjs');
const fixtures = path.join(root, 'qa/fixtures');

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [runner, ...args], { cwd: root, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function serveFixtures() {
  const server = createServer(async (request, response) => {
    const name = path.basename(new URL(request.url, 'http://127.0.0.1').pathname);
    try {
      const body = await readFile(path.join(fixtures, name));
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('passing fixture produces qa.json and a checkpoint with zero errors', async (t) => {
  const { server, url } = await serveFixtures();
  t.after(() => server.close());
  const output = await mkdtemp(path.join(tmpdir(), 'native-qa-pass-'));
  const tasks = path.join(output, 'tasks.json');
  await writeFile(tasks, JSON.stringify({ tasks: [{ name: 'open-panel', steps: [
    { action: 'click', selector: '#open' },
    { action: 'expectVisible', selector: '#panel' },
    { action: 'expectText', selector: '#panel', text: 'Ready for review' },
  ] }] }));

  const result = await run(['--url', `${url}/passing-prototype.html`, '--tasks', tasks, '--output', output, '--viewport', '390x844']);
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(await readFile(path.join(output, 'qa.json'), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.viewport, { width: 390, height: 844 });
  assert.equal(report.tasks[0].status, 'PASS');
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.failedSteps, []);
  assert.ok(report.elapsedMs >= 0);
  assert.ok((await stat(path.join(output, report.tasks[0].checkpoint))).size > 0);
});

test('dead control fixture reports failed steps and page errors', async (t) => {
  const { server, url } = await serveFixtures();
  t.after(() => server.close());
  const output = await mkdtemp(path.join(tmpdir(), 'native-qa-dead-'));
  const tasks = path.join(output, 'tasks.json');
  await writeFile(tasks, JSON.stringify({ tasks: [{ name: 'dead-control', steps: [
    { action: 'click', selector: '#dead' },
    { action: 'wait', ms: 50 },
    { action: 'expectVisible', selector: '#missing' },
  ] }] }));

  const result = await run(['--url', `${url}/dead-control-prototype.html`, '--tasks', tasks, '--output', output, '--viewport', '800x600']);
  assert.equal(result.code, 1, result.stderr);
  const report = JSON.parse(await readFile(path.join(output, 'qa.json'), 'utf8'));
  assert.equal(report.status, 'FAIL');
  assert.equal(report.tasks[0].status, 'FAIL');
  assert.ok(report.failedSteps.length > 0);
  assert.ok(report.pageErrors.some((error) => error.message.includes('fixture page failure')));
  assert.ok((await stat(path.join(output, report.tasks[0].checkpoint))).size > 0);
});

test('help lists all required flags', async () => {
  const result = await run(['--help']);
  assert.equal(result.code, 0, result.stderr);
  for (const flag of ['--url', '--tasks', '--output', '--viewport']) assert.match(result.stdout, new RegExp(flag));
});
