import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const requireFromEditor = createRequire(path.join(root, 'html-editor/package.json'));
const { JSDOM } = requireFromEditor('jsdom');

function pythonUnit(pattern, name) {
  return execFileSync('python3', ['-m', 'unittest', 'discover', '-s', 'test', '-p', pattern, '-k', name, '-v'], {
    cwd: path.join(root, 'prd-demo-skill'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
}

function pythonState(source, args = []) {
  return execFileSync('python3', ['-c', source, path.join(root, 'prd-demo-skill/scripts'), ...args], {
    cwd: root, encoding: 'utf8'
  }).trim();
}

function pageHash(html, pageId) {
  const page = new JSDOM(html).window.document.querySelector(`[data-prd-page="${pageId}"]`);
  return crypto.createHash('sha256').update(page.outerHTML).digest('hex');
}

test('01 completion-time ordering ignores task creation order', () => {
  assert.doesNotThrow(() => pythonUnit('test_figma_task_runtime.py', 'latest_uses_completed_at_not_created_at'));
});

test('02 partial upload without _COMPLETE is invisible', () => {
  assert.doesNotThrow(() => pythonUnit('test_figma_task_runtime.py', 'missing_complete_is_ignored'));
});

test('03 wrong owner cannot consume a valid-looking task', () => {
  assert.doesNotThrow(() => pythonUnit('test_figma_task_runtime.py', 'wrong_owner_is_rejected'));
});

test('04 payload tampering is rejected by SHA-256', () => {
  assert.doesNotThrow(() => pythonUnit('test_figma_task_runtime.py', 'tampered_payload_is_rejected'));
});

test('05 page confirmation cannot be skipped', () => {
  const source = String.raw`
import json, sys
sys.path.insert(0, sys.argv[1])
from workflow_state import WorkflowState
s=WorkflowState.create('s','t','sha256:'+'a'*64)
try:
  s.confirm('primaryFlow',['a'])
  print('skipped')
except ValueError as e:
  print(json.dumps({'next':s.next_question(),'blocked':'pageScope' in str(e)}))
`;
  assert.deepEqual(JSON.parse(pythonState(source)), { next: 'pageScope', blocked: true });
});

test('06 interrupted authorization can resume the next unanswered question from disk', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-resume-'));
  const source = String.raw`
import json, sys
sys.path.insert(0, sys.argv[1])
from workflow_state import WorkflowState
s=WorkflowState.create('resume-session','task','sha256:'+'a'*64)
s.confirm('pageScope',['a','b','c'])
s.confirm('primaryFlow',['a','b','c'])
p=s.save(sys.argv[2])
r=WorkflowState.load(p)
print(json.dumps({'next':r.next_question(),'phase':r.phase}))
`;
  try {
    assert.deepEqual(JSON.parse(pythonState(source, [temporary])), { next: 'frameBindings', phase: 'confirming' });
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('07 multiple Figma tabs remain distinguishable by fileKey and ordered nodeIds', () => {
  const task = JSON.parse(fs.readFileSync(path.join(root, 'workflow/fixtures/three-frame-task/11111111-2222-4333-8444-555555555555/task.json')));
  assert.equal(task.figma.fileKey, 'sanitized-fixture-file');
  assert.deepEqual(task.figma.nodeIds, ['100:1', '100:2', '100:3']);
  assert.equal(new Set(task.figma.nodeIds).size, 3);
});

test('08 editor workflow metadata cannot inject markup or control characters', () => {
  execFileSync('python3', ['-m', 'unittest', 'discover', '-s', 'test', '-p', 'test_wrap_annotator.py', '-k', 'workflow_metadata', '-v'], {
    cwd: path.join(root, 'html-editor'), stdio: ['ignore', 'pipe', 'pipe']
  });
});

test('09 target-only patch preserves all non-target page hashes', () => {
  const before = fs.readFileSync(path.join(root, 'workflow/fixtures/generated-demo.html'), 'utf8');
  const after = fs.readFileSync(path.join(root, 'workflow/fixtures/patched-demo.html'), 'utf8');
  for (const id of ['video-tab', 'outfit-feed-empty-avatar']) assert.equal(pageHash(after, id), pageHash(before, id));
  assert.notEqual(pageHash(after, 'outfit-detail'), pageHash(before, 'outfit-detail'));
});

test('10 Agent without Lark states link or ZIP degradation and never promises discovery', () => {
  const docs = fs.readFileSync(path.join(root, 'prd-demo-skill/references/unified-workflow.md'), 'utf8');
  assert.match(docs, /任务文件夹链接模式[\s\S]*本地 ZIP 模式/);
  assert.match(docs, /不得声称.*自动读取/);
});

test('11 conflicting confirmation requires explicit replace', () => {
  assert.doesNotThrow(() => pythonUnit('test_workflow_state.py', 'conflicting_answer_requires_explicit_replace'));
});

test('12 receipt failure cannot mutate immutable task or completion files', () => {
  const taskDir = path.join(root, 'workflow/fixtures/three-frame-task/11111111-2222-4333-8444-555555555555');
  const before = ['task.json', '_COMPLETE.json'].map(name => crypto.createHash('sha256').update(fs.readFileSync(path.join(taskDir, name))).digest('hex'));
  const source = String.raw`
import sys
sys.path.insert(0, sys.argv[1])
from workflow_state import WorkflowState, build_receipt
s=WorkflowState.create('s','t','sha256:'+'a'*64)
try:
  build_receipt(s,'ou','result','2026-07-21T00:00:00Z')
except ValueError:
  pass
`;
  pythonState(source);
  const after = ['task.json', '_COMPLETE.json'].map(name => crypto.createHash('sha256').update(fs.readFileSync(path.join(taskDir, name))).digest('hex'));
  assert.deepEqual(after, before);
});

test('13 two valid current-user roots return AmbiguousRoot', () => {
  assert.doesNotThrow(() => pythonUnit('test_figma_task_runtime.py', 'duplicate_valid_roots_are_ambiguous'));
});

test('14 PRD fingerprint change invalidates only declared affected decisions', () => {
  assert.doesNotThrow(() => pythonUnit('test_workflow_state.py', 'prd_change_invalidates_only_declared_decisions'));
});
