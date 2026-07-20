const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'assets', 'annotator-inject.js'), 'utf8');

function bootFixture(options = {}) {
  const dom = new JSDOM(fixture, {
    url: 'https://example.test/demo',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.PointerEvent = window.MouseEvent;
  window.requestAnimationFrame = callback => callback();
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,AA==';
  window.document.execCommand = () => options.copySucceeds !== false;
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: text => options.copyRejects ? Promise.reject(new Error('denied')) : Promise.resolve(text) }
  });
  window.document.elementFromPoint = () => window.document.querySelector('#target-title');
  window.eval(source);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { dom, window, document: window.document };
}

function click(document, selector) {
  const element = document.querySelector(selector);
  assert.ok(element, `missing element: ${selector}`);
  element.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
}

function selectTarget(document) {
  click(document, '[data-action="mark"]');
  const target = document.querySelector('#target-title');
  target.dispatchEvent(new document.defaultView.MouseEvent('pointerdown', {
    bubbles: true,
    clientX: 120,
    clientY: 100,
    button: 0
  }));
  target.dispatchEvent(new document.defaultView.MouseEvent('pointerup', {
    bubbles: true,
    clientX: 120,
    clientY: 100,
    button: 0
  }));
}

function annotateTarget(document, note = '标题更醒目') {
  selectTarget(document);
  const textarea = document.querySelector('#ann-inspector textarea');
  textarea.value = note;
  click(document, '#ann-inspector [data-action="save"]');
}

test('boots a compact three-action annotation toolbar', () => {
  const { document } = bootFixture();
  const toolbar = document.querySelector('#ann-toolbar');
  assert.ok(toolbar);
  assert.equal(toolbar.querySelectorAll('button').length, 3);
  assert.equal(toolbar.querySelector('[data-action="mark"]').textContent.trim(), '标记修改');
  assert.match(toolbar.querySelector('[data-action="list"]').textContent, /我的修改/);
  assert.equal(toolbar.querySelector('[data-action="finish"]').textContent.trim(), '完成标注');
  assert.equal(toolbar.querySelectorAll('svg').length, 3);
});

test('opens a macOS Inspector with plain-language actions', () => {
  const { document } = bootFixture();
  selectTarget(document);
  const inspector = document.querySelector('#ann-inspector');
  assert.ok(inspector);
  assert.equal(inspector.querySelector('h2').textContent, '添加修改');
  assert.match(inspector.querySelector('[data-role="context"]').textContent, /已选中.*AI 试穿/);
  assert.equal(inspector.querySelector('[data-role="question"]').textContent, '你希望这里怎么调整？');
  assert.deepEqual(
    [...inspector.querySelectorAll('[data-quick-action]')].map(element => element.textContent.trim()),
    ['修改文字', '更换图片', '调整位置或大小', '参考其他样式']
  );
  assert.equal(inspector.querySelector('[data-action="save"]').textContent, '保存修改');
  assert.equal(inspector.querySelector('[data-role="secondary"]'), null);
});

test('reviews changes in plain language and prepares Agent handoff', () => {
  const { document } = bootFixture();
  annotateTarget(document);
  click(document, '[data-action="list"]');
  const list = document.querySelector('#ann-list');
  assert.equal(list.querySelector('header h2').textContent, '我的修改');
  assert.match(list.textContent, /1 条/);
  assert.match(list.textContent, /标题更醒目/);
  assert.doesNotMatch(list.textContent, /选择器|HTML|片段|base64/);

  click(document, '[data-action="finish"]');
  const modal = document.querySelector('#ann-modal');
  assert.equal(modal.querySelector('h2').textContent, '修改要求已经准备好');
  assert.match(modal.textContent, /回到 Agent 对话，粘贴并发送/);
  assert.equal(modal.querySelector('[data-action="copy"]').textContent, '复制修改要求');
  const machineText = modal.querySelector('textarea').value;
  for (const token of ['页面:', '选择器:', '片段:', '批注:']) assert.ok(machineText.includes(token));
});

test('visible annotation chrome contains no emoji or technical labels', () => {
  const { document } = bootFixture();
  annotateTarget(document);
  click(document, '[data-action="list"]');
  click(document, '[data-action="finish"]');
  const chromeText = [
    document.querySelector('#ann-toolbar'),
    document.querySelector('#ann-list'),
    document.querySelector('#ann-modal')
  ].filter(Boolean).map(element => element.textContent).join(' ');
  assert.doesNotMatch(chromeText, /🎨|📎|✎|✅|✓|✕/u);
  assert.doesNotMatch(chromeText, /CSS 选择器|HTML 片段|base64|导出标注/);
});

module.exports = { bootFixture, click, selectTarget, annotateTarget };
