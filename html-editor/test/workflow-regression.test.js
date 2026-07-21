const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'workflow-multipage.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'assets', 'annotator-inject.js'), 'utf8');

function snapshot(document) {
  return Object.fromEntries(
    [...document.querySelectorAll('[data-prd-page]')].map(page => [
      page.getAttribute('data-prd-page'),
      page.outerHTML
    ])
  );
}

test('annotation activity never mutates any business page', () => {
  const dom = new JSDOM(fixture, {
    url: 'https://example.test/workflow',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;
  window.PointerEvent = window.MouseEvent;
  window.requestAnimationFrame = callback => callback();
  window.document.execCommand = () => true;
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.resolve() }
  });
  const before = snapshot(document);
  const target = document.querySelector('[data-prd-clause="cl-feed-tryon"]');
  document.elementFromPoint = () => target;
  window.eval(source);
  document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  document.querySelector('[data-action="mark"]').click();
  target.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 20, button: 0 }));
  target.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, clientX: 20, clientY: 20, button: 0 }));
  document.querySelector('#ann-inspector textarea').value = '按钮改成黑色';
  document.querySelector('#ann-inspector [data-action="save"]').click();
  document.querySelector('[data-action="finish"]').click();
  const after = snapshot(document);
  assert.deepEqual(after, before);
  const handoff = document.querySelector('#ann-modal textarea').value;
  assert.match(handoff, /"targetClauseId": "cl-feed-tryon"/);
  assert.match(handoff, /"targetPageId": "outfit-feed"/);
  assert.match(handoff, /"scope": "target-only"/);
});
