const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'annotator-inject.js'),
  'utf8'
);
const packageVersion = require('../package.json').version;

test('runtime banner matches the published package version', () => {
  assert.ok(source.includes(`* v${packageVersion}：`));
});

test('keeps the established machine-readable export protocol', () => {
  for (const token of ['页面:', '选择器:', '片段:', '批注:', '[[[IMG:', '[[[/IMG]]]']) {
    assert.ok(source.includes(token), `missing protocol token: ${token}`);
  }
});

test('uses one inline SVG icon factory and macOS visual tokens', () => {
  assert.match(source, /function iconSvg\(name\)/);
  assert.match(source, /viewBox="0 0 24 24"/);
  assert.match(source, /--ann-accent:\s*#0A84FF/i);
  assert.match(source, /--ann-danger:\s*#FF453A/i);
  assert.match(source, /-apple-system/);
});

test('keeps action labels visible on narrow screens', () => {
  assert.doesNotMatch(source, /#ann-toolbar button span:not\([^)]*\)\{display:none/);
  assert.match(source, /@media\(max-width:640px\).*#ann-toolbar button\{[^}]*font-size:11px/s);
});

test('places the toolbar away from page controls instead of pinning it over the primary action', () => {
  assert.match(source, /function placeToolbarAwayFromInteractiveElements\(\)/);
  assert.match(source, /button,\s*a\[href\],\s*input,\s*select,\s*textarea,\s*\[role="button"\],\s*\[role="radio"\]/);
  assert.doesNotMatch(
    source,
    /#ann-toolbar\{position:fixed;left:50%;bottom:18px[^}]*translateX\(-50%\)/
  );
});

test('reads workflow metadata for structured handoff', () => {
  assert.match(source, /function workflowContext\(\)/);
  for (const token of ['prd-demo-workflow', 'taskId', 'sessionId', 'prdFingerprint']) {
    assert.ok(source.includes(token), `missing workflow token: ${token}`);
  }
});

test('ships no emoji or external UI dependencies and keeps plain-language spacing labels', () => {
  assert.doesNotMatch(source, /🎨|📎|✎|✅|✓|✕/u);
  assert.doesNotMatch(source, /(?:src|href)\s*=\s*["']https?:\/\//i);
  assert.match(source, /高级信息/);
  assert.match(source, /和旁边元素的距离/);
  assert.match(source, /内部留白/);
});
