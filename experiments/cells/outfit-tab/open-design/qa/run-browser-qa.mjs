#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const url = process.argv[2] || 'http://localhost:8289/opendesign/mockups/outfit-tab/index.html';
const outDir = new URL('./', import.meta.url).pathname;
const shotDir = `${outDir}screenshots`;
const port = 9333;
await mkdir(shotDir, { recursive: true });

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, '--window-size=430,932',
  `--user-data-dir=/tmp/open-design-outfit-qa-${process.pid}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const events = [];
let ws;
let seq = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.text || 'browser evaluation failed'} ${JSON.stringify(result.exceptionDetails.exception?.description || result.exceptionDetails)}`);
  return result.result.value;
}
async function clickByText(text) {
  return evaluate(`(()=>{const el=[...document.querySelectorAll('button,[role="button"]')].find(x=>x.textContent.trim().includes(${JSON.stringify(text)}));if(!el)throw new Error('missing control: '+${JSON.stringify(text)});el.click();return el.textContent.trim()})()`);
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${shotDir}/${name}`, Buffer.from(shot.data, 'base64'));
}
async function assertText(text) {
  const present = await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  if (!present) throw new Error(`missing visible text: ${text}`);
  events.push({ type: 'assert', text, present });
}

try {
  let version;
  for (let i = 0; i < 40; i++) {
    try { version = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()); break; } catch { await delay(100); }
  }
  if (!version) throw new Error('Chrome DevTools endpoint did not start');
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
    if (msg.method === 'Runtime.consoleAPICalled' || msg.method === 'Runtime.exceptionThrown') events.push({ type: msg.method, params: msg.params });
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url }); await delay(800);
  await evaluate(`localStorage.clear()`); await send('Page.reload'); await delay(600);
  events.push({ task: 'entry', url: await evaluate('location.href') });
  await screenshot('04-react-entry.png');
  await clickByText('场景适配'); await assertText('通勤不刻板');
  events.push({ task: 'switch-category', status: 'PASS' });
  await clickByText('看为什么适合我'); await assertText('为什么适合你');
  events.push({ task: 'open-reason-card', status: 'PASS' });
  for (const text of ['为什么适合你', '配色公式', '避雷与尺码']) await assertText(text);
  events.push({ task: 'read-guidance', status: 'PASS' });
  await screenshot('05-react-detail.png');
  await clickByText('看平替'); await assertText('比同款省 ¥159');
  events.push({ task: 'open-product-or-alternative', status: 'PASS' });
  await clickByText('继续逛'); await clickByText('进入 AI 试穿'); await assertText('正在准备试穿间');
  await delay(850); await assertText('上传正面全身照');
  events.push({ task: 'enter-ai-styling-or-try-on', status: 'PASS' });
  await screenshot('06-react-ai-result.png');
  await clickByText('返回详情'); await clickByText('生成同款延展'); await assertText('正在生成同款延展');
  await delay(850); await assertText('这次生成没有完成'); await clickByText('重试生成'); await assertText('正在生成同款延展');
  events.push({ task: 'ai-failure-retry', status: 'PASS' });
  await send('Page.reload'); await delay(600); await assertText('为什么适合你');
  const persisted = await evaluate(`({category:localStorage.getItem('outfit.category'),screen:localStorage.getItem('outfit.screen')})`);
  events.push({ task: 'refresh-localStorage', status: 'PASS', persisted });
  const failures = events.filter(e => e.type === 'Runtime.exceptionThrown' || (e.type === 'Runtime.consoleAPICalled' && e.params?.type === 'error'));
  const result = { url, executedAt: new Date().toISOString(), tasksPassed: 5, tasksTotal: 5, persisted, consoleOrPageErrors: failures, events };
  await writeFile(`${outDir}browser-qa-raw.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { url, executedAt: new Date().toISOString(), error: String(error?.stack || error), events };
  await writeFile(`${outDir}browser-qa-raw.json`, JSON.stringify(result, null, 2));
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  if (ws) ws.close();
  chrome.kill('SIGTERM');
}
