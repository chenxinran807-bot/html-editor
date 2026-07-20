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

module.exports = { bootFixture, click, selectTarget };
