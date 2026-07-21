const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');

test('skill frontmatter contains only name and description', () => {
  const match = skill.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match);
  const keys = [...match[1].matchAll(/^([A-Za-z][A-Za-z0-9_-]*):/gm)].map(item => item[1]);
  assert.deepEqual(keys, ['name', 'description']);
});

test('skill documents workflow-bound injection and target-only handoff', () => {
  for (const token of [
    '--task-id',
    '--session-id',
    '--prd-fingerprint',
    'targetClauseId',
    'target-only',
    'taskId',
    'sessionId'
  ]) {
    assert.ok(skill.includes(token), `missing skill token: ${token}`);
  }
});

test('agent metadata points to html-editor', () => {
  const metadata = fs.readFileSync(path.join(root, 'agents', 'openai.yaml'), 'utf8');
  assert.match(metadata, /display_name: "HTML 可视化标注"/);
  assert.match(metadata, /\$html-editor/);
});
