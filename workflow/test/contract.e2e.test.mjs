import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const fixture = path.join(root, 'workflow/fixtures/three-frame-task/11111111-2222-4333-8444-555555555555');
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const requireFromEditor = createRequire(path.join(root, 'html-editor/package.json'));
const { createTaskEnvelope, assertRelativeTaskPath } = requireFromRoot('./figma-capture-kit/shared/task-protocol.js');
const { JSDOM } = requireFromEditor('jsdom');

function python(script, args = []) {
  return execFileSync('python3', ['-c', script, ...args], { cwd: root, encoding: 'utf8' }).trim();
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function pageHashes(html) {
  const document = new JSDOM(html).window.document;
  return Object.fromEntries([...document.querySelectorAll('[data-prd-page]')].map(page => [
    page.dataset.prdPage,
    digest(page.outerHTML)
  ]));
}

function exportAnnotation(html, workflow, selector, note) {
  const dom = new JSDOM(html, { url: 'https://example.test/demo', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const { document } = window;
  window.PointerEvent = window.MouseEvent;
  window.requestAnimationFrame = callback => callback();
  window.document.execCommand = () => true;
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
  const meta = document.createElement('meta');
  meta.name = 'prd-demo-workflow';
  meta.dataset.taskId = workflow.taskId;
  meta.dataset.sessionId = workflow.sessionId;
  meta.dataset.prdFingerprint = workflow.prdFingerprint;
  document.head.appendChild(meta);
  const target = document.querySelector(selector);
  document.elementFromPoint = () => target;
  window.eval(fs.readFileSync(path.join(root, 'html-editor/assets/annotator-inject.js'), 'utf8'));
  document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  document.querySelector('[data-action="mark"]').click();
  for (const type of ['pointerdown', 'pointerup']) {
    target.dispatchEvent(new window.MouseEvent(type, { bubbles: true, clientX: 20, clientY: 20, button: 0 }));
  }
  document.querySelector('#ann-inspector textarea').value = note;
  document.querySelector('#ann-inspector [data-action="save"]').click();
  document.querySelector('[data-action="finish"]').click();
  const handoff = document.querySelector('#ann-modal textarea').value;
  const match = handoff.match(/```prd-demo-annotations\n([\s\S]*?)\n```/);
  assert.ok(match, '结构化标注不存在');
  return JSON.parse(match[1]);
}

test('helper fixture is validated by the real prd-demo runtime and helper protocol', () => {
  const output = execFileSync('python3', [
    path.join(root, 'prd-demo-skill/scripts/figma_task_runtime.py'),
    '--owner', 'ou_workflow_fixture', fixture
  ], { encoding: 'utf8' });
  const selected = JSON.parse(output);
  assert.equal(selected.taskId, '11111111-2222-4333-8444-555555555555');
  assert.deepEqual(selected.nodeIds, ['100:1', '100:2', '100:3']);
  const task = JSON.parse(fs.readFileSync(path.join(fixture, 'task.json'), 'utf8'));
  assert.doesNotThrow(() => createTaskEnvelope(task));
  assert.equal(assertRelativeTaskPath('pages/video-tab.png'), 'pages/video-tab.png');
});

test('workflow state blocks generation until the three ordered confirmations complete', () => {
  const script = String.raw`
import json, sys
sys.path.insert(0, sys.argv[1])
from workflow_state import WorkflowState
s = WorkflowState.create('session-fixture', '11111111-2222-4333-8444-555555555555', 'sha256:' + 'a' * 64)
blocked = False
try:
    s.mark_generated()
except ValueError:
    blocked = True
s.confirm('pageScope', ['video-tab', 'outfit-feed-empty-avatar', 'outfit-detail'])
s.confirm('primaryFlow', ['video-tab', 'outfit-feed-empty-avatar', 'outfit-detail'])
s.confirm('frameBindings', {'100:1':'video-tab','100:2':'outfit-feed-empty-avatar','100:3':'outfit-detail'})
print(json.dumps({'blocked': blocked, 'phase': s.phase, 'next': s.next_question()}))
`;
  const result = JSON.parse(python(script, [path.join(root, 'prd-demo-skill/scripts')]));
  assert.deepEqual(result, { blocked: true, phase: 'ready-to-generate', next: null });
});

test('html-editor wrapper and annotation preserve workflow identity and target clause', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-contract-'));
  const input = path.join(root, 'workflow/fixtures/generated-demo.html');
  const output = path.join(temporary, 'annotated.html');
  const workflow = {
    taskId: '11111111-2222-4333-8444-555555555555',
    sessionId: 'session-fixture',
    prdFingerprint: `sha256:${'a'.repeat(64)}`
  };
  try {
    execFileSync('python3', [
      path.join(root, 'html-editor/scripts/wrap_annotator.py'), input, '-o', output,
      '--task-id', workflow.taskId, '--session-id', workflow.sessionId,
      '--prd-fingerprint', workflow.prdFingerprint
    ]);
    const wrapped = fs.readFileSync(output, 'utf8');
    assert.match(wrapped, new RegExp(`data-task-id="${workflow.taskId}"`));
    assert.match(wrapped, new RegExp(`data-session-id="${workflow.sessionId}"`));
    assert.match(wrapped, new RegExp(workflow.prdFingerprint));
    const payload = exportAnnotation(
      fs.readFileSync(input, 'utf8'), workflow,
      '[data-prd-clause="cl-detail-collect"]', '收藏按钮改成黑色并显示已收藏'
    );
    assert.equal(payload.taskId, workflow.taskId);
    assert.equal(payload.sessionId, workflow.sessionId);
    assert.equal(payload.annotations[0].targetClauseId, 'cl-detail-collect');
    assert.equal(payload.annotations[0].targetPageId, 'outfit-detail');
    assert.equal(payload.annotations[0].scope, 'target-only');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('target-only fixture patch leaves protected pages byte-equivalent after normalization', () => {
  const before = pageHashes(fs.readFileSync(path.join(root, 'workflow/fixtures/generated-demo.html'), 'utf8'));
  const after = pageHashes(fs.readFileSync(path.join(root, 'workflow/fixtures/patched-demo.html'), 'utf8'));
  assert.equal(after['video-tab'], before['video-tab']);
  assert.equal(after['outfit-feed-empty-avatar'], before['outfit-feed-empty-avatar']);
  assert.notEqual(after['outfit-detail'], before['outfit-detail']);
});
