const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'annotator-inject.js'),
  'utf8'
);

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
