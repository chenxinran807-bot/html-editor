import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { access, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dashboardDirectory = path.join(root, 'experiments/dashboard');

function resolveLocalArtifact(repositoryRoot, dashboardOutput, artifact) {
  assert.equal(artifact.external, false, 'resolveLocalArtifact only accepts local artifacts');
  assert.ok(artifact.href.startsWith('../../'), `${artifact.href} must start with ../../`);
  assert.equal(artifact.href.includes('\\'), false, `${artifact.href} must use URL separators`);
  assert.equal(path.isAbsolute(artifact.href), false, `${artifact.href} must not be absolute`);
  assert.doesNotMatch(artifact.href, /^(?:file:|\/\/|[a-z][a-z\d+.-]*:)/i, `${artifact.href} must not use a URL protocol`);

  const expectedRepoTarget = path.resolve(repositoryRoot, artifact.repoPath);
  const relativeRepoTarget = path.relative(repositoryRoot, expectedRepoTarget);
  assert.ok(relativeRepoTarget && !relativeRepoTarget.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeRepoTarget), `${artifact.repoPath} must stay inside the repository`);
  assert.equal(path.resolve(dashboardOutput, artifact.href), expectedRepoTarget, `${artifact.href} must resolve to repoPath from the dashboard output`);
  assert.equal(existsSync(expectedRepoTarget), artifact.exists, `${artifact.repoPath} exists metadata must match the repository`);
  return expectedRepoTarget;
}

async function findPlaywrightCore() {
  const queue = [{ directory: root, depth: 0 }];
  while (queue.length) {
    const { directory, depth } = queue.shift();
    const entry = path.join(directory, 'node_modules/playwright-core/index.mjs');
    try { await access(entry); return entry; } catch {}
    if (depth >= 6) continue;
    let children;
    try { children = await readdir(directory, { withFileTypes: true }); } catch { continue; }
    for (const child of children) {
      if (child.isDirectory() && !['.git', 'dist', 'node_modules', '.pnpm-store'].includes(child.name)) {
        queue.push({ directory: path.join(directory, child.name), depth: depth + 1 });
      }
    }
  }
  throw new Error('playwright-core was not found');
}

async function serveDashboard(output) {
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = pathname === '/experiments/dashboard/index.html'
      ? path.join(output, 'index.html')
      : pathname === '/experiments/dashboard/data.json'
        ? path.join(output, 'data.json')
        : path.join(root, pathname);
    let body;
    try { body = await readFile(file); }
    catch { response.writeHead(404).end('not found'); return; }
    response.writeHead(200).end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/experiments/dashboard/index.html` };
}

async function buildFixture() {
  const output = await mkdtemp(path.join(tmpdir(), 'native-dashboard-'));
  const run = spawnSync(process.execPath, ['scripts/experiment/build-dashboard.mjs', '--output', output], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, `dashboard build failed:\n${run.stdout}\n${run.stderr}`);
  const data = JSON.parse(await readFile(path.join(output, 'data.json'), 'utf8'));
  return { output, data, run };
}

test('validates and aggregates exactly twelve experiment results', async () => {
  const { data } = await buildFixture();
  assert.equal(Object.hasOwn(data, 'generatedAt'), false);
  assert.equal(data.results.length, 12);
  assert.equal(data.summary.resultCount, 12);
  assert.equal(data.summary.scoredCount, 11);
  assert.equal(data.summary.blockedCount, 1);
  assert.deepEqual(data.dimensions, ['fidelity', 'flowCoverage', 'interaction', 'visualHierarchy', 'edgeStates', 'stability', 'handoff']);
});

test('publishes the dashboard experiment settings', async () => {
  const { data } = await buildFixture();
  assert.deepEqual(data.experimentSettings, [
    {
      id: 'inputs',
      title: '输入',
      items: [
        '穿搭 Tab 迭代方案',
        'AI 试穿相机上传 PRD',
        '两份飞书文档均固化为独立本地输入，供各实验单元重复使用',
      ],
    },
    {
      id: 'skills',
      title: '参测 Skill 及来源',
      items: [
        'Open Design：本机安装的 Open Design 桌面应用内置能力',
        'huashu-design：下载到实验环境的本地 Skill 包',
        'prd-generator：安装在本机 Codex Skills 目录中的本地 Skill',
        'pm-kakaxi-skills：安装在本机 Codex Skills 目录中的本地 Skill，作者标记为 pengmingyu，版本 2.1.0',
        'vne-prototype：安装在本机 Codex Skills 目录中的本地 Skill，版本 1.0.3',
        'inspire-prototype：由全局安装的 @byted-inspire/prototype-cli 提供的内置 Skill',
      ],
    },
    {
      id: 'execution',
      title: '执行主体与方式',
      items: [
        'Codex 主 Agent 负责编排、实验约束、汇总与统一验收',
        '独立 Subagent 按“一个输入 × 一个 Skill”执行实验任务',
        '平台型 Skill 通过各自原生 CLI、MCP 或托管生成流程产出原型',
        '共设置 12 个隔离实验单元，即 2 份输入 × 6 个 Skill',
        '每个单元只读取自身输入和对应 Skill 允许使用的资源，不读取其他实验单元的产物',
        '按各 Skill 自身标准流程生成，不人为统一技术栈、页面数量或视觉风格',
        '对实际产物执行固定任务和浏览器验证；失败、阻断或偏离均保留记录',
      ],
    },
    {
      id: 'dimensions',
      title: '评分维度',
      items: [
        { label: '需求忠实度', points: 20 },
        { label: '流程覆盖', points: 15 },
        { label: '交互', points: 20 },
        { label: '视觉层级', points: 15 },
        { label: '边界状态', points: 10 },
        { label: '稳定性', points: 10 },
        { label: '交付质量', points: 10 },
      ],
    },
  ]);
});

test('production entry resolver rejects local paths that can escape the repository', async () => {
  const { resolveLocalEntry } = await import('../scripts/experiment/build-dashboard.mjs');
  for (const value of [
    '../../../outside.html',
    '/tmp/outside.html',
    'file:///tmp/outside.html',
    'experiments/cells/../../../../outside.html',
  ]) {
    assert.throws(
      () => resolveLocalEntry(value, 'camera-upload', 'open-design'),
      /unsafe local entry path/i,
      value,
    );
  }
});

test('ranks each input by prototype effect score with audited dimensions as tie-breakers', async () => {
  const { data } = await buildFixture();
  assert.deepEqual(data.rankings['camera-upload'].map((row) => row.skillId), [
    'inspire-prototype', 'pm-kakaxi', 'prd-generator', 'vne-prototype', 'open-design', 'huashu-design',
  ]);
  assert.deepEqual(data.rankings['camera-upload'].map((row) => row.effectScore), [92, 84, 80, 76, 68, 65]);
  assert.deepEqual(data.rankings['outfit-tab'].map((row) => row.skillId), [
    'pm-kakaxi', 'inspire-prototype', 'open-design', 'huashu-design', 'prd-generator',
  ]);
  assert.deepEqual(data.rankings['outfit-tab'].map((row) => row.effectScore), [92, 86, 65, 62, 58]);
});

test('keeps blocked results scoreless and excludes them from ranking', async () => {
  const { data } = await buildFixture();
  const blocked = data.results.find((row) => row.inputId === 'outfit-tab' && row.skillId === 'vne-prototype');
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.total, null);
  assert.equal(blocked.scores, null);
  assert.equal(data.rankings['outfit-tab'].some((row) => row.skillId === 'vne-prototype'), false);
  assert.deepEqual(data.applicability.find((row) => row.skillId === 'vne-prototype').rankedInputs, ['camera-upload']);
});

test('computes cross-input deltas only when both inputs have scores', async () => {
  const { data } = await buildFixture();
  assert.deepEqual(data.crossInput.map((row) => row.skillId), [
    'inspire-prototype', 'pm-kakaxi', 'prd-generator', 'open-design', 'huashu-design', 'vne-prototype',
  ]);
  assert.deepEqual(data.crossInput.map((row) => row.overallRank), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(data.crossInput.slice(0, 5).map((row) => row.combinedEffectScore), [89, 88, 69, 66.5, 63.5]);
  assert.equal(data.crossInput.find((row) => row.skillId === 'pm-kakaxi').delta, -8);
  assert.equal(data.crossInput.find((row) => row.skillId === 'open-design').delta, 3);
  assert.equal(data.crossInput.find((row) => row.skillId === 'inspire-prototype').delta, 6);
  assert.equal(data.crossInput.find((row) => row.skillId === 'vne-prototype').delta, null);
});

test('publishes the Chinese dashboard sections without an evidence gallery', async () => {
  const { output, data } = await buildFixture();
  const html = await readFile(path.join(output, 'index.html'), 'utf8');

  for (const label of ['原型能力实验对比', '实验设置', '输入', '参测 Skill 及来源', '执行主体与方式', '评分维度', '相机上传排名', '穿搭 Tab 排名', '未完全按 Skill 标准执行的部分', '跨输入比较', '适用性']) {
    assert.match(html, new RegExp(label));
  }
  assert.doesNotMatch(html, /原生流程偏离/);
  assert.match(html, /技能正式名称/);
  assert.doesNotMatch(html, /Skill 正式名称/);
  assert.doesNotMatch(html, /证据画廊/);
  for (const label of ['实验设置', '输入', '参测 Skill 及来源', '执行主体与方式', '评分维度']) {
    assert.ok(html.indexOf(label) < html.indexOf('跨输入比较'), `${label} must appear before cross-input comparison`);
  }
  assert.ok(html.indexOf('跨输入比较') < html.indexOf('概览'), 'cross-input comparison must appear before overview');
  assert.doesNotMatch(html, /\['排名','技能正式名称','总分','状态'\]/);
  assert.doesNotMatch(html, /id=["']gallery["']/);
  assert.doesNotMatch(html, /class=["']gallery["']/);
  assert.doesNotMatch(html, /<h2>原型产物<\/h2>|id=["']artifacts["']/);
  assert.equal(Object.hasOwn(data, 'gallery'), false);
});

test('renders twelve effect cells with direct prototype links in the cross-input table', async (t) => {
  const { output, data } = await buildFixture();
  const pairs = data.results.map((result) => `${result.inputId}::${result.skillId}`);
  assert.equal(new Set(pairs).size, 12, 'each experiment must have a unique inputId × skillId pair');
  const { server, url } = await serveDashboard(output);
  t.after(() => server.close());
  const { chromium } = await import(pathToFileURL(await findPlaywrightCore()).href);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  const settingCards = page.locator('.experiment-setting');
  assert.equal(await settingCards.count(), 4);
  for (const [index, setting] of data.experimentSettings.entries()) {
    const text = await settingCards.nth(index).innerText();
    assert.match(text, new RegExp(setting.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const item of setting.items) {
      const expected = typeof item === 'string' ? item : `${item.label}：${item.points} 分`;
      assert.ok(text.includes(expected), `missing rendered experiment setting text: ${expected}`);
    }
  }
  assert.equal(await settingCards.first().evaluate((card, cross) => {
    const settingsSection = card.closest('section');
    const crossSection = cross.closest('section');
    return Boolean(settingsSection.compareDocumentPosition(crossSection) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, await page.locator('#cross').elementHandle()), true, 'experiment settings section must precede cross-input section in the DOM');
  assert.equal(await page.locator('.prototype-effect').count(), 12);
  assert.equal(await page.locator('.deviation-result').count(), 12);
  for (const result of data.results) {
    const card = page.locator(`.prototype-effect[data-result-id="${result.inputId}::${result.skillId}"]`);
    assert.equal(await card.count(), 1, `missing cross-input effect cell for ${result.inputId}::${result.skillId}`);
    assert.ok(result.effectZh, `missing effect summary for ${result.inputId}::${result.skillId}`);
    assert.match(await card.innerText(), new RegExp(result.effectZh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(await card.innerText(), /PASS_WITH_CONCERNS|BLOCKED/);
    assert.deepEqual(await card.locator('a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), result.prototype ? [result.prototype.href] : []);

    assert.ok(Array.isArray(result.deviationsZh) && result.deviationsZh.length > 0, `missing Chinese deviations for ${result.inputId}::${result.skillId}`);
    const deviationCard = page.locator(`.deviation-result[data-result-id="${result.inputId}::${result.skillId}"]`);
    assert.equal(await deviationCard.count(), 1, `missing deviation card for ${result.inputId}::${result.skillId}`);
    const deviationText = await deviationCard.innerText();
    for (const item of result.deviationsZh) assert.match(deviationText, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const original of result.deviations) assert.equal(deviationText.includes(original), false, 'must not render the original English deviation text');
  }
});

test('rejects artifact metadata that traverses outside the repository', () => {
  assert.throws(() => resolveLocalArtifact(root, dashboardDirectory, {
    external: false,
    exists: false,
    href: '../../../../../etc/passwd',
    repoPath: '../etc/passwd',
  }), /must stay inside the repository/);
});

test('publishes report recommendations and loopback-safe relative artifact links', async () => {
  const { output, data } = await buildFixture();
  const report = await readFile(path.join(output, 'report.md'), 'utf8');
  assert.equal(report.endsWith('\n\n'), false, 'report must end with exactly one newline');
  for (const skill of ['open-design', 'huashu-design', 'prd-generator', 'pm-kakaxi', 'vne-prototype', 'inspire-prototype']) {
    assert.match(report, new RegExp(`## ${skill}`));
  }
  for (const label of ['Best use', 'Weakness', 'Recommended', 'Avoid']) assert.match(report, new RegExp(label));
  const localArtifacts = data.results.flatMap((row) => row.artifacts).filter((item) => !item.external);
  assert.ok(localArtifacts.some((artifact) => artifact.exists), 'fixture must include at least one existing local artifact');
  for (const artifact of localArtifacts) {
    resolveLocalArtifact(root, dashboardDirectory, artifact);
  }
});
