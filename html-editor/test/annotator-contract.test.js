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
