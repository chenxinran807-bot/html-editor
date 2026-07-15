import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = 'work/douyin-outfit-content-feed';

test('ships a versioned, safe editable runtime and complete delivery artifacts', async () => {
  const [html, prd, contextSource, profileSource, manifestSource, patchesSource, commentsSource, summary, assumptions] = await Promise.all([
    readFile(`${root}/index.html`, 'utf8'),
    readFile(`${root}/prd.md`, 'utf8'),
    readFile(`${root}/demo-context.json`, 'utf8'),
    readFile(`${root}/design-profile.json`, 'utf8'),
    readFile(`${root}/prototype.manifest.json`, 'utf8'),
    readFile(`${root}/prototype.patches.json`, 'utf8'),
    readFile(`${root}/agent-comments.json`, 'utf8'),
    readFile(`${root}/demo-summary.md`, 'utf8'),
    readFile(`${root}/assumptions.md`, 'utf8'),
  ]);
  const context = JSON.parse(contextSource);
  const profile = JSON.parse(profileSource);
  const manifest = JSON.parse(manifestSource);
  const patches = JSON.parse(patchesSource);
  const comments = JSON.parse(commentsSource);

  assert.equal(context.sourcePrd, prd);
  for (const field of ['completeness', 'pageUnits', 'visualInventory', 'interactionInventory', 'stateMatrix', 'assumptions', 'openQuestions', 'doNotInfer', 'evidenceSources']) {
    assert.ok(context[field], `demo-context missing ${field}`);
  }
  assert.deepEqual(Object.keys(context.completeness).sort(), ['interaction', 'semantic', 'state', 'visual']);
  assert.equal(profile.domain, 'ecommerce');
  assert.ok(profile.tokens && profile.componentRouting);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.startPage, 'feed');
  assert.ok(manifest.pages.flatMap((page) => page.elements).length > 0);
  assert.deepEqual(patches, { schemaVersion: 1, manifestId: manifest.id, patches: {} });
  assert.deepEqual(comments, { schemaVersion: 1, manifestId: manifest.id, comments: [] });
  assert.match(summary, /按场景[\s\S]*适合我[\s\S]*博主推荐/);
  assert.match(summary, /编辑模式|编辑态/);
  assert.match(assumptions, /演示作者|演示素材/);
  assert.match(assumptions, /真实商品数据不可用/);

  assert.match(html, /data-mode="preview"/);
  assert.match(html, /id="authoring-controls"/);
  for (const id of ['mode-preview', 'mode-edit', 'edit-text', 'edit-color', 'edit-image', 'edit-hidden', 'edit-disabled', 'edit-target', 'undo-edit', 'redo-edit', 'export-patches', 'agent-request', 'agent-submit', 'export-comments']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing authoring control ${id}`);
  }
  assert.match(html, /outfit-content-feed:v1/);
  assert.match(html, /localStorage\.setItem/);
  assert.match(html, /URL\.createObjectURL/);
  assert.match(html, /SAFE_IMAGE_PATH/);
  assert.match(html, /document\.createTextNode|textContent/);
  assert.match(html, /body\[data-mode="preview"\] #authoring-controls\{display:none\}/);
});

test('every literal and generated editable region has a deterministic unique key', async () => {
  const html = await readFile(`${root}/index.html`, 'utf8');
  const literalKeys = [...html.matchAll(/data-proto-key="([^"$]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(literalKeys).size, literalKeys.length, 'literal data-proto-key values must not repeat');
  assert.doesNotMatch(html, /data-proto-key="(?:open-card|toggle-like|toggle-collect|toggle-follow|hide-card)"/);
  for (const suffix of ['open', 'like', 'collect', 'follow', 'hide']) {
    assert.match(html, new RegExp(`data-proto-key="\\$\\{escapeAttr\\(card\\.id\\)\\}-${suffix}"`));
  }
  assert.match(html, /function\s+applyEditablePatches\s*\(/);
  assert.match(html, /function\s+bindEditableRegions\s*\(/);
});

test('mobile feed exposes stable prototype hooks and remains locally self-contained', async () => {
  const html = await readFile(`${root}/index.html`, 'utf8');

  for (const key of [
    'nav-title',
    'channel-scene',
    'channel-fit',
    'channel-creator',
    'featured-theme',
    'inspiration-strip',
    'mixed-feed',
    'bottom-nav-outfit',
  ]) {
    assert.match(html, new RegExp(`data-proto-key=["']${key}["']`), `missing prototype hook: ${key}`);
  }

  for (const cardType of ['creator', 'collection', 'outfit']) {
    assert.match(html, new RegExp(`data-card-type=["']${cardType}["']`), `missing card type: ${cardType}`);
  }

  assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}]/u, 'emoji are not approved interface icons');
  assert.doesNotMatch(html, /(?:https?:)?\/\//i, 'the prototype must not load remote dependencies');
  assert.match(html, /type=["']module["']/);
  assert.match(html, /from\s+["']\.\/catalog\.js["']/);
  assert.match(html, /from\s+["']\.\/state\.js["']/);
});

test('feed navigation preserves browsing context without reloading the page', async () => {
  const html = await readFile(`${root}/index.html`, 'utf8');

  assert.doesNotMatch(html, /location\.reload\s*\(/, 'detail return must re-render in place');
  assert.doesNotMatch(html, /rgba\s*\(/i, 'all interface colors must come from approved tokens');
  assert.match(html, /function\s+restoreFeedScroll\s*\(/, 'scroll restoration must be an explicit post-render step');
  assert.match(
    html,
    /setFeedStatus\(state,'ready'\);\s*renderFeed\(\);\s*restoreFeedScroll\(\)/,
    'saved scroll must be restored only after the ready feed has rendered',
  );
  assert.match(html, /\.status\{[^}]*min-height:var\(--feed-reserve\)/, 'loading must reserve feed height');
  assert.match(html, /returnToFeed\(state\);\s*closeStateMenu\(true\);\s*renderShell\(\);\s*renderFeed\(\);\s*restoreFeedScroll\(\)/, 'detail return must restore controls and feed before scroll');
});

test('all structural CSS dimensions are named in the root token registry', async () => {
  const html = await readFile(`${root}/index.html`, 'utf8');
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const declarationsOutsideRoot = style.replace(/:root\{[^}]*\}/, '');

  assert.doesNotMatch(
    declarationsOutsideRoot,
    /(?:\d*\.)?\d+(?:px|vh)\b/,
    'raw structural px/vh dimensions must be declared once as named root constants',
  );
});

test('feed controls are semantic, accessible, and race-safe', async () => {
  const html = await readFile(`${root}/index.html`, 'utf8');

  assert.doesNotMatch(html, /<button[^>]*>\s*<div\b/i, 'detail controls must not wrap block card markup');
  assert.match(html, /aria-label="查看\$\{escapeAttr\(card\.title\)\}详情"/);
  assert.match(html, /aria-pressed="\$\{[^}]+\}"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-selected=/);
  assert.match(html, /let loadGeneration=0/);
  assert.match(html, /clearTimeout\(loadTimer\)/);
  assert.match(html, /generation!==loadGeneration/);
  assert.match(html, /cancelAnimationFrame\(restoreFrame\)/);
  assert.match(html, /function escapeText\(/);
  assert.match(html, /function escapeAttr\(/);
});

test('detail navigation escapes catalog content and invalidates pending feed work', async () => {
  const html = await readFile(`${root}/index.html`, 'utf8');

  assert.match(html, /function\s+cancelPendingLoad\s*\(/);
  assert.match(html, /function\s+showDetail\(card\)\{cancelPendingLoad\(\)/);
  assert.match(html, /src="\$\{escapeAttr\(card\.assetPath\)\}"/);
  assert.match(html, /alt="\$\{escapeAttr\(card\.title\)\}抽象穿搭插图"/);
  assert.match(html, /<h2>\$\{escapeText\(card\.title\)\}<\/h2>/);
  assert.match(html, /<p>\$\{escapeText\(card\.reason\|\|card\.description\)\}<\/p>/);
  assert.match(html, /loadGeneration\+\+/);
  assert.match(html, /clearTimeout\(loadTimer\)/);
  assert.match(html, /cancelAnimationFrame\(restoreFrame\)/);
});

test('exposes observable detail, feedback, recovery, and live-region hooks', async () => {
  const html = await readFile(`${root}/index.html`, 'utf8');
  for (const key of [
    'back-to-feed', 'undo-hide', 'clear-filter', 'retry-feed',
    'creator-detail', 'collection-detail', 'outfit-detail',
  ]) {
    assert.match(html, new RegExp(`data-proto-key=["']${key}["']`), `missing observable hook: ${key}`);
  }
  for (const suffix of ['open', 'like', 'collect', 'follow', 'hide']) {
    assert.match(html, new RegExp(`data-proto-key="\\$\\{escapeAttr\\(card\\.id\\)\\}-${suffix}"`), `missing deterministic ${suffix} hook`);
  }
  assert.match(html, /aria-live=["']polite["']/);
  assert.match(html, /data-feed-state=["'](?:loading|empty|error|image-failure|ready)["']/);
  assert.match(html, /function\s+renderCreatorDetail\s*\(/);
  assert.match(html, /function\s+renderCollectionDetail\s*\(/);
  assert.match(html, /function\s+renderOutfitDetail\s*\(/);
});

test('binds every detail action and state recovery hook to an observable transition', async () => {
  const html = await readFile(`${root}/index.html`, 'utf8');

  assert.match(html, /data-proto-key="outfit-commerce-feedback"/);
  assert.match(html, /querySelector\('\.secondary-action'\).*showToast\('已记录查看搭配单品意向'\)/);
  assert.match(html, /data-proto-key="collection-content-\$\{escapeAttr\(item\.id\)\}" data-id="\$\{escapeAttr\(item\.id\)\}"/);
  assert.match(html, /data-proto-key="adjacent-collection" data-adjacent-id=/);
  assert.match(html, /querySelector\('\[data-adjacent-id\]'\).*showDetail\(nextCard\)/);

  assert.match(html, /data-detail-reaction.*toggleReaction\(state,card\.id,button\.dataset\.detailReaction\)/s);
  assert.match(html, /data-detail-hide.*hideCard\(state,card\.id\).*returnToFeed\(state\)/s);
  assert.match(html, /data-feed-state.*setFeedStatus\(state,button\.dataset\.feedState\).*renderFeed\(\)/s);
  assert.match(html, /data-clear-filter.*selectFilter\(state,catalog\.channels\[state\.channel\]\[0\]\).*setFeedStatus\(state,'ready'\)/s);
  assert.match(html, /data-retry-feed.*startLoading\(\)/s);
  assert.match(html, /feedStatus==='image-failure'.*class="image-failure".*图片暂时无法显示/s);
});

test('keeps prototype state controls hidden in detail and preserves failed media ratios', async () => {
  const html = await readFile(`${root}/index.html`, 'utf8');
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

  assert.match(style, /\.state-menu\[hidden\]\{display:none\}/);
  assert.match(style, /\.image-failure\{[^}]*aspect-ratio:3\/4/);
  assert.match(style, /\.collection-card \.image-failure\{aspect-ratio:1\/1\}/);
  assert.match(style, /\.outfit-card \.image-failure\{aspect-ratio:4\/5\}/);
  assert.match(html, /function closeStateMenu\(enabled=false\).*stateMenu\.hidden=true.*stateToggle\.disabled=!enabled/s);
  assert.match(html, /function showDetail\(card\)\{cancelPendingLoad\(\);closeStateMenu\(\)/);
  assert.match(html, /returnToFeed\(state\);closeStateMenu\(true\);renderShell\(\)/);
  assert.match(html, /media\.dataset\.imageState='failed'/);
});

test('all required local SVG assets physically exist and are self-contained', async () => {
  const assetsDirectory = `${root}/assets`;
  const names = await readdir(assetsDirectory);
  const required = [
    ...['creator', 'collection', 'outfit'].flatMap((type) => [1, 2, 3, 4].map((number) => `${type}-${number}.svg`)),
    ...['search', 'back', 'more', 'like', 'collect', 'follow', 'retry', 'home', 'outfit', 'cart', 'profile'].map((name) => `${name}.svg`),
  ];

  for (const name of required) {
    assert.ok(names.includes(name), `missing physical SVG asset: ${name}`);
    const svg = await readFile(`${assetsDirectory}/${name}`, 'utf8');
    assert.match(svg, /<svg\b/);
    assert.match(svg, /viewBox="[^"]+"/);
    assert.doesNotMatch(svg, /(?:https?:)?\/\/(?!www\.w3\.org\/2000\/svg)/i, `remote dependency in ${name}`);
    assert.doesNotMatch(svg, /<text\b|<image\b|<font\b/i, `non-abstract or external content in ${name}`);
  }
});

const acceptedStatements = [
  '# 抖音商城独立端穿搭 Tab',
  '首要目标是提升穿搭内容浏览时长和连续浏览意愿。',
  '页面面向男女混合用户，覆盖更多风格与场景。',
  '页面采用真人穿搭、主题合集与商品搭配混排的内容流。',
  '二级结构采用三个平行 Tab：按场景、适合我、博主推荐。',
  '用户可以喜欢、收藏、关注，也可以标记不感兴趣并撤销。',
  '用户可以进入真人穿搭详情、主题合集详情和商品搭配详情，返回后恢复频道、筛选和滚动位置。',
  '页面覆盖加载、空内容、加载失败、图片失败和重试状态。',
];

test('freezes the accepted outfit content feed requirements', async () => {
  const [prd, semanticRequirementsSource] = await Promise.all([
    readFile(`${root}/prd.md`, 'utf8'),
    readFile(`${root}/semantic-requirements.json`, 'utf8'),
  ]);
  const requirements = JSON.parse(semanticRequirementsSource);

  assert.equal(requirements.schemaVersion, 1);
  assert.equal(requirements.confidence, 'high');
  assert.equal(requirements.title, '抖音商城独立端穿搭 Tab');
  assert.equal(requirements.actor, '男女混合的穿搭内容浏览用户');
  assert.equal(requirements.goal, '提升穿搭内容浏览时长和连续浏览意愿');

  assert.equal(requirements.extractionMode, 'model-semantic');
  assert.deepEqual(requirements.screens, [
    '穿搭内容流',
    '真人穿搭详情',
    '主题合集详情',
    '商品搭配详情',
  ]);

  for (const statement of acceptedStatements) {
    assert.ok(prd.includes(statement), `accepted statement missing: ${statement}`);
  }

  const evidenceById = new Map(requirements.evidence.map((item) => [item.id, item]));
  assert.equal(evidenceById.size, requirements.evidence.length, 'evidence IDs must be unique');
  assert.deepEqual(
    [...evidenceById.keys()].sort(),
    ['goal', 'audience', 'content-mix', 'secondary-tabs', 'engagement-actions', 'detail-navigation', 'page-states'].sort(),
    'evidence IDs must exactly cover the accepted requirement categories',
  );
  for (const item of requirements.evidence) {
    assert.ok(prd.includes(item.quote), `evidence quote not found verbatim: ${item.quote}`);
  }
  assert.ok(evidenceById.get('goal').quote.includes(requirements.goal), 'goal must link to verbatim evidence');
  for (const actorTerm of ['男女混合', '用户']) {
    assert.ok(evidenceById.get('audience').quote.includes(actorTerm), `actor evidence lacks term: ${actorTerm}`);
  }

  assert.deepEqual(requirements.businessObjects.map(({ name }) => name), [
    '真人穿搭',
    '主题合集',
    '商品搭配',
  ]);
  for (const object of requirements.businessObjects) {
    const evidence = evidenceById.get(object.evidenceId);
    assert.ok(evidence, `business object lacks linked evidence: ${object.name}`);
    assert.ok(evidence.quote.includes(object.name), `business object evidence mismatches term: ${object.name}`);
  }

  const actionTerms = new Map([
    ['喜欢', ['喜欢']],
    ['收藏', ['收藏']],
    ['关注', ['关注']],
    ['标记不感兴趣', ['标记不感兴趣']],
    ['撤销不感兴趣', ['不感兴趣', '撤销']],
    ['进入真人穿搭详情', ['进入', '真人穿搭详情']],
    ['进入主题合集详情', ['进入', '主题合集详情']],
    ['进入商品搭配详情', ['进入', '商品搭配详情']],
    ['返回内容流并恢复状态', ['返回', '恢复']],
    ['失败后重试', ['失败', '重试']],
  ]);
  assert.deepEqual(requirements.userActions.map(({ name }) => name), [...actionTerms.keys()]);
  for (const action of requirements.userActions) {
    const evidence = evidenceById.get(action.evidenceId);
    assert.ok(evidence, `user action lacks linked evidence: ${action.name}`);
    for (const term of actionTerms.get(action.name)) {
      assert.ok(evidence.quote.includes(term), `user action evidence mismatches term: ${action.name} / ${term}`);
    }
  }

  assert.ok(Object.keys(requirements.pageContent).length > 0, 'pageContent must be non-empty');
  assert.deepEqual(requirements.pageContent.feed, ['真人穿搭', '主题合集', '商品搭配']);
  assert.deepEqual(requirements.pageContent.states, ['加载', '空内容', '加载失败', '图片失败', '重试']);
  for (const contentType of requirements.pageContent.feed) {
    assert.ok(evidenceById.get('content-mix').quote.includes(contentType), `feed item lacks verbatim evidence: ${contentType}`);
  }
  for (const state of requirements.pageContent.states) {
    assert.ok(evidenceById.get('page-states').quote.includes(state), `page state lacks verbatim evidence: ${state}`);
  }

  assert.ok(Object.keys(requirements.informationArchitecture).length > 0, 'informationArchitecture must be non-empty');
  assert.deepEqual(requirements.informationArchitecture.secondaryTabs, ['按场景', '适合我', '博主推荐']);
  assert.equal(requirements.informationArchitecture.relationship, 'parallel');
  for (const tab of requirements.informationArchitecture.secondaryTabs) {
    assert.ok(evidenceById.get('secondary-tabs').quote.includes(tab), `IA tab lacks verbatim evidence: ${tab}`);
  }

  assert.equal(requirements.transitions.length, 3, 'exactly three open transitions are required');
  const expectedDetailScreens = ['真人穿搭详情', '主题合集详情', '商品搭配详情'];
  const openDestinations = requirements.transitions.map(({ to }) => to);
  const returnOrigins = requirements.transitions.filter(({ return: returnBehavior }) => returnBehavior).map(({ to }) => to);
  assert.equal(returnOrigins.length, 3, 'exactly three return transitions are required');
  assert.deepEqual(
    [...new Set(openDestinations)].sort(),
    [...expectedDetailScreens].sort(),
    'open transitions must have three exact unique destinations',
  );
  assert.deepEqual(
    [...new Set(requirements.transitions.map(({ action }) => action))].sort(),
    ['打开真人穿搭', '打开主题合集', '打开商品搭配'].sort(),
    'open transitions must have three exact unique actions',
  );
  assert.deepEqual(
    requirements.transitions.map(({ action, to }) => `${action}→${to}`).sort(),
    [
      '打开真人穿搭→真人穿搭详情',
      '打开主题合集→主题合集详情',
      '打开商品搭配→商品搭配详情',
    ].sort(),
    'each open action must lead to its matching detail screen',
  );
  assert.deepEqual(
    [...new Set(returnOrigins)].sort(),
    [...expectedDetailScreens].sort(),
    'return transitions must originate from each exact detail screen',
  );
  for (const transition of requirements.transitions) {
    assert.equal(transition.from, '穿搭内容流');
    assert.ok(requirements.screens.includes(transition.to), `unknown detail destination: ${transition.to}`);
    assert.ok(transition.action.startsWith('打开'));
    assert.equal(transition.return, '恢复频道、筛选和滚动位置');
    assert.ok(evidenceById.get('detail-navigation').quote.includes(transition.to));
    for (const restoredState of ['频道', '筛选', '滚动位置']) {
      assert.ok(evidenceById.get('detail-navigation').quote.includes(restoredState));
    }
  }

  assert.ok(requirements.assumptions.length > 0);
  assert.ok(requirements.assumptions.some((item) => item.includes('演示内容')));
  assert.ok(requirements.assumptions.every((item) => prd.includes(item)), 'assumptions must be verbatim in the PRD');
  assert.ok(requirements.gaps.length > 0);
  assert.ok(requirements.gaps.some((item) => item.includes('真实商品')));
  assert.ok(requirements.gaps.every((item) => prd.includes(item)), 'gaps must be verbatim in the PRD');
});
