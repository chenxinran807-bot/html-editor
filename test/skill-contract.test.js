const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
const readmePath = path.join(root, 'README.md');
const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';

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

test('skill triggers for Streamlit and explicit HTML Editor enablement', () => {
  assert.match(skill, /Streamlit/);
  assert.match(skill, /启用 HTML Editor/);
});

test('skill documents the Streamlit adapter commands and runtime contract', () => {
  for (const token of [
    'scripts/streamlit_adapter.py inspect',
    'scripts/streamlit_adapter.py launch',
    '__HTML_EDITOR_STREAMLIT_CONFIG__',
    '__HTML_EDITOR_STREAMLIT__'
  ]) {
    assert.ok(skill.includes(token), `missing Streamlit contract token: ${token}`);
  }
});

test('skill preserves user source and the existing static HTML flow', () => {
  assert.match(skill, /不得修改用户源文件/);
  assert.match(skill, /静态 HTML.*保持不变/);
  assert.match(readme, /静态 HTML.*主要流程/);
  assert.match(readme, /Streamlit.*增量/);
});

test('documented Streamlit adapter assets exist and initialize the runtime marker', () => {
  const documentedPaths = [...new Set(
    [...`${skill}\n${readme}`.matchAll(/`(assets\/streamlit-[^`]+\.js)`/g)]
      .map(match => match[1])
  )];
  assert.ok(documentedPaths.length > 0, 'no documented Streamlit adapter asset');
  for (const documentedPath of documentedPaths) {
    const absolutePath = path.resolve(root, documentedPath);
    assert.equal(path.dirname(absolutePath), path.join(root, 'assets'));
    assert.ok(fs.existsSync(absolutePath), `missing documented asset: ${documentedPath}`);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const dom = new JSDOM('<!doctype html><main data-testid="stMain"></main>', {
      runScripts: 'outside-only',
      url: 'http://127.0.0.1:8501/'
    });
    dom.window.eval(source);
    assert.ok(dom.window.__HTML_EDITOR_STREAMLIT__, `${documentedPath} did not initialize marker`);
    dom.window.__HTML_EDITOR_STREAMLIT__.destroy();
  }
});

test('skill follows the current Browser workflow for one-time visible injection', () => {
  for (const pattern of [
    /读取.*assets\/streamlit-annotator\.js/,
    /当前.*Browser.*skill.*source of truth/i,
    /活动的 Streamlit 标签页/,
    /显示.*标签页/,
    /__HTML_EDITOR_STREAMLIT__.*存在.*不.*注入/
  ]) {
    assert.match(skill, pattern);
  }
  assert.doesNotMatch(skill, /\.codex\/plugins\/cache\/openai-bundled\/browser\/\d/);
});

test('skill documents existing-app and uploaded-project workflows', () => {
  for (const token of [
    '现有本地应用',
    '确认目标标签页是 Streamlit',
    '项目指纹',
    'session fingerprint',
    '源位置保证较低',
    '上传的完整项目',
    'launch metadata',
    '保持进程运行'
  ]) {
    assert.ok(skill.includes(token), `missing workflow token: ${token}`);
  }
});

test('launch metadata is probed before ready and fresh inspect gates injection', () => {
  assert.doesNotMatch(`${skill}\n${readme}`, /readiness JSON|就绪 JSON/i);
  assert.match(skill, /launch metadata[\s\S]*HTTP probe[\s\S]*确认.*ready[\s\S]*注入/i);
  assert.match(
    skill,
    /launch metadata[\s\S]*重新运行.*inspect[\s\S]*projectFingerprint[\s\S]*一致[\s\S]*注入/
  );
  assert.match(skill, /metadata.*之后.*启动失败.*失败/);
});

test('session-only identity is fresh, valid, non-reused, and isolated', () => {
  for (const pattern of [
    /加密安全.*随机/,
    /sha256:<64hex>/,
    /唯一.*session projectName/,
    /不得复用/,
    /新会话.*不能恢复.*旧标注/,
    /localStorage.*不可访问/,
    /destroy.*清理/
  ]) {
    assert.match(skill, pattern);
  }
});

test('skill documents Streamlit failure behavior', () => {
  for (const token of [
    '缺少依赖',
    '需要用户批准',
    '依赖声明保持不变',
    '启动错误',
    '浏览器注入错误',
    '匹配不明确',
    '项目指纹不匹配'
  ]) {
    assert.ok(skill.includes(token), `missing failure token: ${token}`);
  }
});

test('README documents Streamlit usage and verification', () => {
  assert.match(readme, /streamlit_adapter\.py inspect/);
  assert.match(readme, /streamlit_adapter\.py launch/);
  assert.match(readme, /__HTML_EDITOR_STREAMLIT__/);
  assert.match(readme, /npm test/);
});

test('documented inspect workflow matches real directory and ZIP CLI metadata', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'html-editor-skill-contract-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const project = path.join(fixture, 'project');
  const archive = path.join(fixture, 'project.zip');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'app.py'), 'import streamlit as st\nst.write("ok")\n');
  const zipResult = spawnSync(
    'python3',
    ['-c', 'import pathlib,sys,zipfile\np=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w"); z.write(p/"app.py","project/app.py"); z.close()', project, archive],
    { encoding: 'utf8' }
  );
  assert.equal(zipResult.status, 0, zipResult.stderr);

  const inspect = input => {
    const result = spawnSync(
      'python3',
      [path.join(root, 'scripts', 'streamlit_adapter.py'), 'inspect', input],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const directoryInfo = inspect(project);
  const archiveInfo = inspect(archive);
  for (const info of [directoryInfo, archiveInfo]) {
    for (const key of [
      'projectFingerprint',
      'pythonExecutable',
      'pythonSource',
      'runtimeDigest',
      'runtimeScope'
    ]) {
      assert.ok(info[key], `inspect output missing ${key}`);
    }
  }
  assert.equal(fs.realpathSync(archiveInfo.sourceArchive), fs.realpathSync(archive));
  assert.equal(archiveInfo.temporaryProject, true);
  assert.match(skill, /目录.*或.*\.zip/);
  assert.match(skill, /相同.*inspect.*launch|inspect.*launch.*相同/);
});

test('skill documents safe ZIP lifecycle and rejects bypassing safeguards', () => {
  for (const pattern of [
    /私有临时目录/,
    /源归档.*不变/,
    /inspect.*结束.*清理/,
    /进程退出.*清理/,
    /错误.*清理/,
    /不安全.*过大.*明确错误/,
    /不得手动解压.*安全检查/
  ]) {
    assert.match(skill, pattern);
  }
});

test('skill binds launch metadata to project and runtime identity before injection', () => {
  for (const token of [
    'pythonExecutable',
    'pythonSource',
    'runtimeDigest',
    'runtimeScope',
    'project-venv',
    'current-interpreter',
    'interpreter-only'
  ]) {
    assert.ok(skill.includes(token), `missing environment contract token: ${token}`);
  }
  assert.match(skill, /项目虚拟环境.*自动优先/);
  assert.match(skill, /不.*激活脚本.*shell/);
  assert.match(
    skill,
    /fresh inspect[\s\S]*projectFingerprint[\s\S]*runtimeDigest[\s\S]*runtimeScope[\s\S]*launch metadata[\s\S]*一致[\s\S]*注入/
  );
  assert.match(skill, /interpreter-only.*运行时保证较低/);
});
