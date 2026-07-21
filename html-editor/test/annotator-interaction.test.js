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
  if (options.eyeDropper !== false) {
    window.EyeDropper = class {
      open() { return Promise.resolve({ sRGBHex: '#12ab34' }); }
    };
  }
  if (options.savedAnnotations) {
    window.localStorage.setItem('ann::/demo', JSON.stringify(options.savedAnnotations));
  }
  if (options.workflowMeta) {
    const meta = window.document.createElement('meta');
    meta.name = 'prd-demo-workflow';
    meta.dataset.taskId = options.workflowMeta.taskId;
    meta.dataset.sessionId = options.workflowMeta.sessionId;
    meta.dataset.prdFingerprint = options.workflowMeta.prdFingerprint;
    window.document.head.appendChild(meta);
  }
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

function structuredPayload(document) {
  const text = document.querySelector('#ann-modal textarea').value;
  const match = text.match(/```prd-demo-annotations\n([\s\S]*?)\n```/);
  assert.ok(match, 'missing prd-demo-annotations payload');
  return JSON.parse(match[1]);
}

test('saves exact visual changes beside the plain-language intent', () => {
  const { document } = bootFixture({
    workflowMeta: {
      taskId: 'task-precise',
      sessionId: 'session-precise',
      prdFingerprint: `sha256:${'b'.repeat(64)}`
    }
  });
  const target = document.querySelector('#target-title');
  target.style.fontSize = '16px';
  selectTarget(document);
  click(document, '[data-control="font-size-increase"]');
  document.querySelector('#ann-inspector textarea').value = '标题大小按当前效果';
  click(document, '#ann-inspector [data-action="save"]');
  click(document, '[data-action="finish"]');
  const item = structuredPayload(document).annotations[0];
  assert.equal(item.intent, '标题大小按当前效果');
  assert.deepEqual(item.changes, [{
    category: 'text',
    property: 'font-size',
    before: '16px',
    after: '17px',
    unit: 'px',
    direction: null
  }]);
});

test('cancel restores every previewed inline style', () => {
  const { document } = bootFixture();
  const target = document.querySelector('#target-title');
  target.style.fontSize = '16px';
  selectTarget(document);
  click(document, '[data-control="font-size-increase"]');
  assert.equal(target.style.fontSize, '17px');
  click(document, '#ann-inspector [data-action="cancel"]');
  assert.equal(target.style.fontSize, '16px');
});

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

test('shows only text controls for a text selection', () => {
  const { document } = bootFixture();
  selectTarget(document);
  const inspector = document.querySelector('#ann-inspector');
  assert.ok(inspector);
  assert.equal(inspector.querySelector('h2').textContent, '添加修改');
  assert.match(inspector.querySelector('[data-role="context"]').textContent, /已选中.*AI 试穿/);
  assert.deepEqual(
    [...inspector.querySelectorAll('[data-section]')].map(element => element.dataset.section),
    ['text-content', 'typography', 'text-color', 'note', 'advanced']
  );
  assert.equal(inspector.querySelector('[data-section="image"]'), null);
  assert.doesNotMatch(inspector.textContent, /字大一点|文字更醒目|增加间距/);
  assert.equal(inspector.querySelector('[data-action="save"]').textContent, '保存修改');
});

test('shows appearance and spacing controls for a container selection', () => {
  const { document, window } = bootFixture();
  window.document.elementFromPoint = () => document.querySelector('main');
  selectTarget(document);
  const names = [...document.querySelectorAll('#ann-inspector [data-section]')].map(element => element.dataset.section);
  assert.deepEqual(names, ['spacing', 'appearance', 'note', 'advanced']);
  assert.equal(names.includes('text-content'), false);
});

test('offers page colors, native custom color, and screen picking', async () => {
  const { document, window } = bootFixture();
  const target = document.querySelector('#target-title');
  selectTarget(document);
  assert.ok(document.querySelectorAll('[data-page-color]').length > 0);
  assert.equal(document.querySelector('[data-control="custom-color"]').type, 'color');
  click(document, '[data-control="eyedropper"]');
  await new Promise(resolve => window.setTimeout(resolve, 0));
  assert.equal(target.style.color, 'rgb(18, 171, 52)');
});

test('hides screen picking when EyeDropper is unavailable', () => {
  const { document } = bootFixture({ eyeDropper: false });
  selectTarget(document);
  assert.equal(document.querySelector('[data-control="eyedropper"]'), null);
  assert.ok(document.querySelector('[data-control="custom-color"]'));
  assert.ok(document.querySelectorAll('[data-page-color]').length > 0);
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

test('Escape closes the Inspector and returns focus to mark action', () => {
  const { document } = bootFixture();
  selectTarget(document);
  assert.ok(document.querySelector('#ann-inspector'));
  document.dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.querySelector('#ann-inspector'), null);
  assert.equal(document.activeElement, document.querySelector('[data-action="mark"]'));
});

test('old annotations with stale selectors show a human recovery message', () => {
  const { document } = bootFixture({
    savedAnnotations: {
      seq: 1,
      items: [{ id: 1, selector: '#removed-element', tag: 'div', text: '旧内容', note: '保留修改', page: '', snippet: '<div>旧内容</div>' }]
    }
  });
  click(document, '[data-action="list"]');
  assert.match(document.querySelector('#ann-list').textContent, /原来的位置已经变化，请重新选择/);
});

test('clipboard rejection reveals manual copy without losing machine text', async () => {
  const { document, window } = bootFixture({ copyRejects: true, copySucceeds: false });
  annotateTarget(document);
  click(document, '[data-action="finish"]');
  await new Promise(resolve => window.setTimeout(resolve, 0));
  const textarea = document.querySelector('#ann-modal textarea');
  assert.notEqual(textarea.style.display, 'none');
  assert.match(textarea.value, /页面:|批注:/);
});

test('exports workflow identity with the modification request', () => {
  const { document } = bootFixture({
    workflowMeta: {
      taskId: 'task-123',
      sessionId: 'session-456',
      prdFingerprint: `sha256:${'a'.repeat(64)}`
    }
  });
  annotateTarget(document);
  click(document, '[data-action="finish"]');
  const machineText = document.querySelector('#ann-modal textarea').value;
  assert.match(machineText, /"taskId": "task-123"/);
  assert.match(machineText, /"sessionId": "session-456"/);
  assert.match(machineText, new RegExp(`"prdFingerprint": "sha256:${'a'.repeat(64)}"`));
});

test('exports a clause-aware target-only modification', () => {
  const { document } = bootFixture({
    workflowMeta: {
      taskId: 'task-123',
      sessionId: 'session-456',
      prdFingerprint: `sha256:${'a'.repeat(64)}`
    }
  });
  const target = document.querySelector('#target-title');
  target.setAttribute('data-prd-clause', 'cl-014');
  target.setAttribute('data-prd-page', 'detail');
  annotateTarget(document, '按钮改成黑色');
  click(document, '[data-action="finish"]');
  const payload = structuredPayload(document);
  assert.equal(payload.annotations.length, 1);
  assert.deepEqual(payload.annotations[0], {
    annId: 'ann-1',
    targetClauseId: 'cl-014',
    targetPageId: 'detail',
    targetNodeSelector: '[data-prd-clause="cl-014"]',
    action: 'modify',
    intent: '按钮改成黑色',
    scope: 'target-only',
    changes: []
  });
});

test('does not invent a clause id for legacy HTML', () => {
  const { document } = bootFixture({
    workflowMeta: {
      taskId: 'task-123',
      sessionId: 'session-456',
      prdFingerprint: `sha256:${'a'.repeat(64)}`
    }
  });
  annotateTarget(document, '标题更醒目');
  click(document, '[data-action="finish"]');
  const item = structuredPayload(document).annotations[0];
  assert.equal(item.targetClauseId, null);
  assert.equal(item.targetPageId, null);
  assert.equal(item.targetNodeSelector, '#target-title');
  assert.equal(item.scope, 'target-only');
});

module.exports = { bootFixture, click, selectTarget, annotateTarget, structuredPayload };
