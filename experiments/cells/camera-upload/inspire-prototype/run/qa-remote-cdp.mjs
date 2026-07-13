import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const preview = 'https://6a54dba21afe4f0267392504-prototype.inspire.bytedance.net';
const cell = path.resolve('experiments/cells/camera-upload/inspire-prototype');
const rawDir = path.join(cell, 'qa/raw');
const shotDir = path.join(cell, 'qa/screenshots');
await fs.mkdir(rawDir, { recursive: true });
await fs.mkdir(shotDir, { recursive: true });

const port = 9341;
const profile = path.join(os.tmpdir(), `inspire-camera-qa-${Date.now()}`);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
chrome.stderr.on('data', chunk => { stderr += chunk.toString(); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function json(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}
for (let i = 0; i < 30; i++) {
  try { await json(`http://127.0.0.1:${port}/json/version`); break; }
  catch { if (i === 29) throw new Error('Chrome CDP did not start'); await sleep(200); }
}
const page = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(preview)}`, { method: 'PUT' });
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map();
const consoleErrors = [];
const exceptions = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' ').slice(0, 500));
  }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text.slice(0, 500));
});
function call(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(predicate, label, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return;
    await sleep(100);
  }
  throw new Error(`Timed out: ${label}`);
}
const state = () => evaluate(`({url:location.href,path:location.pathname,search:location.search,text:document.body?.innerText ?? ''})`);
async function clickText(text) {
  const clicked = await evaluate(`(() => { const all=[...document.querySelectorAll('#root *')]; const matches=all.filter(n=>n.textContent.includes(${JSON.stringify(text)})); const node=matches.sort((a,b)=>a.children.length-b.children.length)[0]; if(!node)return false; (node.closest('button,[role="button"]') ?? node).click(); return true; })()`);
  if (!clicked) throw new Error(`Missing clickable text: ${text}`);
  await sleep(120);
}
async function clickSelector(selector, index = 0) {
  const clicked = await evaluate(`(() => { const n=document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if(!n)return false; n.click(); return true; })()`);
  if (!clicked) throw new Error(`Missing selector: ${selector}[${index}]`);
  await sleep(120);
}
async function expectText(text) { await waitFor(async () => (await state()).text.includes(text), `text ${text}`); }
async function revealText(text) {
  const revealed = await evaluate(`(() => { const n=[...document.querySelectorAll('#root *')].filter(e=>e.textContent.includes(${JSON.stringify(text)})).sort((a,b)=>a.children.length-b.children.length)[0]; if(!n)return false; n.scrollIntoView({block:'center'}); return true; })()`);
  if (!revealed) throw new Error(`Missing text to reveal: ${text}`);
  await sleep(200);
}
async function expectPath(pathname, search = null) {
  await waitFor(async () => { const s = await state(); return s.path === pathname && (search === null || s.search.includes(search)); }, `${pathname} ${search ?? ''}`);
}
async function screenshot(name) {
  const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(shotDir, `${name}.png`), Buffer.from(result.data, 'base64'));
}

const tasks = [];
async function task(id, name, work, fatal = true) {
  const started = new Date().toISOString();
  try { await work(); tasks.push({ id, name, status: 'PASS', started, ended: new Date().toISOString(), state: await state() }); }
  catch (error) { tasks.push({ id, name, status: 'FAIL', started, ended: new Date().toISOString(), error: error.message, state: await state() }); if (fatal) throw error; }
}

try {
  await call('Page.enable'); await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
  await call('Page.navigate', { url: preview });
  await expectText('打开创建形象');
  await task(1, '打开创建形象并显示照片来源', async () => { await clickText('打开创建形象'); await expectText('创建我的试穿形象'); await clickText('上传1张照片'); await expectText('拍照'); await expectText('从相册选择'); await screenshot('01-source-sheet'); });
  await task(2, '进入相机', async () => { await clickText('拍照'); await expectPath('/camera', 'facing=back'); await screenshot('02-camera-back'); });
  await task(3, '翻转前后摄像头', async () => { await clickText('翻转'); await expectPath('/camera', 'facing=front'); await screenshot('03-camera-front'); });
  await task(4, '打开相册并返回相机', async () => { await clickText('相册'); await expectPath('/album'); await screenshot('04-album'); await clickSelector('#root button', 0); await expectPath('/camera', 'facing=front'); });
  await task(5, '关闭相机回到照片来源', async () => { await clickSelector('#root button', 0); await expectText('从相册选择'); await screenshot('05-camera-closed'); });
  await task(6, '快门进入照片确认', async () => { await clickText('拍照'); await expectPath('/camera', 'facing=back'); await clickText('翻转'); await expectPath('/camera', 'facing=front'); await clickSelector('#root button.w-20.h-20'); await expectPath('/camera/confirm', 'facing=front'); await expectText('使用照片'); await screenshot('06-confirm'); });
  await task(7, '重拍并保留摄像头方向', async () => { await clickText('重拍'); await expectPath('/camera', 'facing=front'); await screenshot('07-retake-front'); });
  await task(8, '使用照片进入明确审核加载态', async () => { await clickSelector('#root button.w-20.h-20'); await expectPath('/camera/confirm'); await clickText('使用照片'); await expectText('审核失败'); await clickText('审核失败'); await expectPath('/moderating', 'mock=fail'); await expectText('照片审核中'); await screenshot('08-moderating'); });
  await task(9, '审核失败显示具体合规指导', async () => { await expectText('照片内容不符合规范'); await revealText('照片内容不符合规范'); await screenshot('09-review-failed'); });
  await task(10, '重新上传回到照片来源', async () => { await clickText('重新上传'); await expectText('拍照'); await expectText('从相册选择'); await screenshot('10-reupload-source'); }, false);

  await call('Page.navigate', { url: `${preview}/?modal=create&sheet=source` });
  await expectText('拍照');

  async function selectOutcome(label, expected) {
    await clickText('拍照'); await expectPath('/camera'); await clickSelector('#root button.w-20.h-20'); await expectPath('/camera/confirm');
    await clickText('使用照片'); await clickText(label); await expectPath('/moderating'); await expectText('照片审核中'); await expectText(expected); await screenshot(`branch-${label.includes('成功') ? 'success' : 'error'}`);
  }
  await selectOutcome('审核成功', '上传成功');
  await clickText('完成'); await expectText('打开创建形象'); await clickText('打开创建形象'); await clickText('上传1张照片');
  await selectOutcome('服务异常', '服务异常，请重试');
  await clickText('重新上传'); await sleep(300);

  const report = { preview, viewport: { width: 390, height: 844, mobile: true }, status: tasks.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL', tasks, branchChecks: { success: 'PASS', serviceErrorDisplayed: 'PASS', serviceErrorReupload: 'FAIL' }, consoleErrors, exceptions };
  await fs.writeFile(path.join(rawDir, 'browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const report = { preview, status: 'FAIL', tasks, fatal: error.message, consoleErrors, exceptions };
  await fs.writeFile(path.join(rawDir, 'browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
  throw error;
} finally {
  ws.close(); chrome.kill('SIGTERM');
  await fs.writeFile(path.join(rawDir, 'chrome-runtime-summary.json'), `${JSON.stringify({ stderrLineCount: stderr.split('\n').filter(Boolean).length, consoleErrorCount: consoleErrors.length, exceptionCount: exceptions.length }, null, 2)}\n`);
}
