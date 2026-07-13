#!/usr/bin/env node
/* eslint-disable */
// =============================================================================
// audit-prototype.cjs — 原型可走通性 / 可点性 静态体检
//
// 为什么存在：这个 skill 给 PRD 文本配了独立 reviewer，却让原型靠作者自查过关。
// "自己查自己有偏见" 对原型一样成立——作者知道动线意图，所以页面在他眼里"是连
// 通的"，但实际生成的 href 可能指向不存在的页、入口页的主 CTA 可能根本没接。
// 这个脚本把"无断头路"从一句口号变成一条可执行的、确定性的门。
//
// 它只做静态分析（不渲染、不依赖 playwright），所以在任何环境都能跑。它查的是
// "结构上走不走得通"；"好不好看 / 顺不顺" 由设计 reviewer 用截图判断，两者互补。
//
// 用法:
//   node audit-prototype.cjs <canvas_dir> [--json]
//   <canvas_dir> 下应有 pages/*.html
//
// 退出码:
//   0 = 没有硬伤（可能有 advisory 警告，需人工扫一眼）
//   1 = 有硬伤（断链 / 孤岛页 / 入口走不出去）——不该在这个状态交付
//
// 硬伤（确定性、几乎零误报，会让退出码=1）:
//   1. 断链      — 页面里 <a href="/p/x"> 但 x.html 不存在（部署后必碎）
//   2. 孤岛页    — 这个页存在，但从入口页一路点过去到不了它（只能靠敲 URL）
//   3. 入口走不出 — 有 ≥2 个页，但入口页没有任何"指向别的页"的真链接（用户卡死在第一屏）
//   4. 漏组件    — 页面顶部装配清单声明了某组件，但页面里找不到它（data-component 标记缺失）。
//                  "一次糊整页丢细节"的那个病，机械卡住。只对写了清单的组件密集页生效。
//
// Advisory（启发式、可能误报，只提示不拦）:
//   5. 掐死的导航 — onclick="return false;" 或 href="#"：看着是入口、点了啥也不干
//   6. 假 affordance — 长得能点（cursor:pointer / 按钮样式）却没接 handler 的元素
//   7. 未接线状态 — 装配清单声明的共享状态，全页没人引用（可能某组件忘了接线）
//
// sandbox 页（文件头带 <!-- sandbox -->，组件精修车间）整个被排除，不参与任何检查。
// =============================================================================

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const CANVAS_DIR = args.find((a) => !a.startsWith('--'));

if (!CANVAS_DIR) {
  console.error('用法: node audit-prototype.cjs <canvas_dir> [--json]');
  process.exit(2);
}

const PAGES_DIR = path.join(CANVAS_DIR, 'pages');

function listPages() {
  let files;
  try {
    files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.html'));
  } catch (_) {
    console.error('读不到 ' + PAGES_DIR + '（这个目录下应该有 pages/*.html）');
    process.exit(2);
  }
  files.sort((a, b) => a.localeCompare(b)); // 数字前缀决定入口顺序，01- 在最前
  return files
    .map((f) => ({
      slug: f.replace(/\.html$/, ''),
      file: f,
      html: fs.readFileSync(path.join(PAGES_DIR, f), 'utf8'),
    }))
    // sandbox 页（组件精修车间，头部带 <!-- sandbox -->）不是交付产物：
    // 跳过它，别把它当孤岛/断头路报，也不对它做装配清单核对。
    .filter((p) => !/<!--\s*sandbox\s*-->/i.test(p.html.slice(0, 600)));
}

// 把一个跳转目标（不管写成 /p/x、./x.html、x.html）统一成 slug
function toSlug(raw) {
  let s = raw.trim();
  s = s.replace(/^\/p\//, '').replace(/^\.?\//, '').replace(/\.html$/, '');
  s = s.replace(/[?#].*$/, ''); // 去掉 query / hash
  return s;
}

// 抽出一个页面"能把用户带到别的页"的所有真实跳转边。
// 覆盖三种写法：<a href>、内联 onclick 里的 location、<script> 里的 location 赋值
// （比如 sendTask() 里的 window.location.href='/p/02-...'，这是真实动线的一部分）。
function extractEdges(html) {
  const targets = new Set();

  // 1) href="/p/x" | "./x.html" | "x.html"（排除 http(s)、mailto、tel、纯 #、纯 /）
  const hrefRe = /href\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = hrefRe.exec(html))) {
    const v = m[1].trim();
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(v)) continue;
    if (v === '#' || v === '' || v === '/') continue;
    if (v.startsWith('/p/') || /\.html($|[?#])/.test(v)) targets.add(toSlug(v));
  }

  // 2) location.href = '/p/x' / location.assign('/p/x') / location='/p/x'（onclick 或 script 里都算）
  const locRe = /location(?:\.href)?\s*(?:=|\.assign\s*\()\s*['"]([^'"]+)['"]/gi;
  while ((m = locRe.exec(html))) {
    const v = m[1].trim();
    if (v.startsWith('/p/') || /\.html($|[?#])/.test(v) || /^[\w-]+$/.test(v)) {
      targets.add(toSlug(v));
    }
  }

  return targets;
}

// 收集页面里被 JS 接管的 id 和 class，用来给"假 affordance"启发式消除误报——
// 一个裸 <div class="session-item"> 如果有脚本对 .session-item 做了事件绑定/委托，
// 那它其实是活的，不该被报。
function collectJsWired(html) {
  const ids = new Set();
  const classes = new Set();
  const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
  const blob = scripts.join('\n') + '\n' + (html.match(/on\w+\s*=\s*"[^"]*"/gi) || []).join('\n');
  let m;
  const idRe = /getElementById\(\s*['"]([\w-]+)['"]\s*\)/gi;
  while ((m = idRe.exec(blob))) ids.add(m[1]);
  // .foo 出现在 querySelector / closest / matches / classList 操作 / 事件委托里
  const clsRe = /(?:querySelector(?:All)?|closest|matches)\(\s*['"][^'"]*?\.([\w-]+)[^'"]*?['"]\s*\)/gi;
  while ((m = clsRe.exec(blob))) classes.add(m[1]);
  const getClsRe = /getElementsByClassName\(\s*['"]([\w-]+)['"]\s*\)/gi;
  while ((m = getClsRe.exec(blob))) classes.add(m[1]);
  return { ids, classes };
}

// 启发式：找"长得能点、却没接任何东西"的元素。保守优先（宁可漏报不要误报，
// 因为误报=狼来了，比承认查不全更糟）。只盯三类高置信信号，且排除 JS 接管的。
function detectFakeAffordances(html) {
  const out = [];
  const { ids, classes } = collectJsWired(html);

  // 哪些 class 在 <style> 里被赋了 cursor:pointer
  const pointerClasses = new Set();
  const styleBlocks = html.match(/<style[\s\S]*?<\/style>/gi) || [];
  const css = styleBlocks.join('\n');
  const ruleRe = /\.([\w-]+)\s*(?:[,{][^}]*?)cursor\s*:\s*pointer/gi;
  let m;
  while ((m = ruleRe.exec(css))) pointerClasses.add(m[1]);

  // 扫两类元素：
  //   - 块级元素（div/li/tr/span）：只有带了"我可点"的视觉信号（cursor:pointer）才算 affordance
  //   - <button>：本身就长得能点，不需要 cursor:pointer；没接 handler 就是死键
  const tagRe = /<(div|li|tr|span|button)\b([^>]*)>/gi;
  let tag;
  while ((tag = tagRe.exec(html))) {
    const el = tag[1].toLowerCase();
    const attrs = tag[2];
    if (/\bon\w+\s*=/.test(attrs)) continue; // 有内联 handler，活的
    if (el === 'button' && /\btype\s*=\s*"(submit|reset)"/i.test(attrs)) continue; // 表单按钮
    const idMatch = attrs.match(/\bid\s*=\s*"([\w-]+)"/);
    if (idMatch && ids.has(idMatch[1])) continue; // JS 按 id 接了
    const classMatch = attrs.match(/\bclass\s*=\s*"([^"]*)"/);
    const elClasses = classMatch ? classMatch[1].split(/\s+/) : [];
    if (elClasses.some((c) => classes.has(c))) continue; // JS 按 class 接了/委托了

    let why;
    if (el === 'button') {
      why = '<button> 没接 handler';
    } else {
      const inlinePointer = /style\s*=\s*"[^"]*cursor\s*:\s*pointer/i.test(attrs);
      const classPointer = elClasses.some((c) => pointerClasses.has(c));
      if (!inlinePointer && !classPointer) continue; // 没有"我可点"的视觉信号，跳过
      why = inlinePointer ? 'inline cursor:pointer' : 'class 带 cursor:pointer';
    }

    // 是否被 <a> 包着：看这个标签之前最后一次出现的是 <a 还是 </a>（被包住就是真链接）
    const before = html.slice(0, tag.index);
    if (before.lastIndexOf('<a ') > before.lastIndexOf('</a>')) continue;

    out.push({ tag: el, cls: elClasses.join(' ') || '(无 class)', why });
  }
  return out;
}

// 逐元素看"被掐死的导航"。区分两档：
//   hard = `onclick="return false"` 挂在能点的元素上、且没有诚实置灰——这就是
//          那个上线后碎掉的确定性反模式（看着能点、点了啥也不干），该硬卡。
//   soft = `href="#"` 的死链接（没真 handler），提示人工看一眼。
// **诚实置灰（aria-disabled="true"）一律放过**——那正是 skill 推荐的"做不了就明示"
// 写法，不能反过来 nag 它（这是 reviewer 抓出来的一个真坑）。
function detectNeutered(html) {
  const hard = [], soft = [];
  const tagRe = /<(a|button|div|span|li)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const el = m[1].toLowerCase();
    const attrs = m[2];
    const clickableTag = el === 'a' || el === 'button';
    const clickClass = /class\s*=\s*"[^"]*\b(nav|tab|menu|item|link|btn|button)\b/i.test(attrs);
    if (!clickableTag && !clickClass) continue;
    if (/aria-disabled\s*=\s*"true"/i.test(attrs)) continue; // 诚实置灰，放过
    const returnFalse = /onclick\s*=\s*"return false;?\s*"/i.test(attrs);
    const hashHref = /href\s*=\s*"#"/i.test(attrs);
    const realOnclick = /onclick\s*=\s*"(?!\s*return false)/i.test(attrs);
    const snip = `<${el} ${attrs.trim().slice(0, 60)}>`;
    if (returnFalse) hard.push(snip);
    else if (hashHref && !realOnclick) soft.push(snip);
  }
  return { hard, soft };
}

// 解析页面顶部的装配清单（组件密集页才有；普通页没有，返回 null、跳过核对）。
//   <!-- manifest
//   state: selectedRepo, selectedBranch
//   components: repo-branch-selector [reuse], at-directory [complex], send-bar
//   -->
function parseManifest(html) {
  const block = html.match(/<!--\s*manifest\b([\s\S]*?)-->/i);
  if (!block) return null;
  const body = block[1];
  const grab = (key) => {
    const m = body.match(new RegExp(key + '\\s*:\\s*(.+)', 'i'));
    return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  };
  const components = grab('components')
    .map((c) => c.replace(/\[[^\]]*\]/g, '').trim()) // 去掉 [complex] / [reuse] flag，留组件名
    .filter(Boolean);
  return { state: grab('state'), components };
}

// 拿清单核对页面：
//   dropped = 清单声明的组件，但页面源码里找不到 data-component="<name>"（被漏掉了，硬伤）
//   unwired = 清单声明的状态 key，但全页（清单注释之外）没人引用（可能忘接线，提示）
function checkManifest(html, manifest) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const dropped = manifest.components.filter(
    (name) => !new RegExp('data-component\\s*=\\s*"' + esc(name) + '"', 'i').test(html)
  );
  const bodyOutsideManifest = html.replace(/<!--\s*manifest\b[\s\S]*?-->/i, '');
  const unwired = manifest.state.filter((key) => !bodyOutsideManifest.includes(key));
  return { dropped, unwired };
}

// ---------------------------------------------------------------------------
const pages = listPages();
if (pages.length === 0) {
  console.error('pages/ 里没有 .html 页面');
  process.exit(2);
}

const slugSet = new Set(pages.map((p) => p.slug));

// 入口根：默认就是数字前缀最小的页。多入口/多角色原型（合法形态）给额外入口页文件
// 头加 `<!-- entry -->` 注释，它就也算一个根——这样它不会被误判成"孤岛断头路"。
const markedEntries = pages.filter((p) => /<!--\s*entry\s*-->/i.test(p.html.slice(0, 600))).map((p) => p.slug);
const roots = [...new Set([pages[0].slug, ...markedEntries])];
const entry = pages[0].slug;

// 建图
const graph = new Map(); // slug -> Set(target slug)
const dangling = []; // {from, target}
const perPage = {};
const neuteredHard = {}; // slug -> [死按钮片段]
const droppedComponents = {}; // slug -> [清单声明但页面里缺的组件名]
const unwiredState = {}; // slug -> [清单声明但全页没引用的状态 key]
for (const p of pages) {
  const edges = extractEdges(p.html);
  graph.set(p.slug, edges);
  for (const t of edges) {
    if (!slugSet.has(t)) dangling.push({ from: p.slug, target: t });
  }
  const neut = detectNeutered(p.html);
  if (neut.hard.length) neuteredHard[p.slug] = neut.hard;
  const manifest = parseManifest(p.html);
  if (manifest) {
    const mc = checkManifest(p.html, manifest);
    if (mc.dropped.length) droppedComponents[p.slug] = mc.dropped;
    if (mc.unwired.length) unwiredState[p.slug] = mc.unwired;
  }
  perPage[p.slug] = {
    edgesTo: [...edges].filter((t) => t !== p.slug),
    neuteredSoft: neut.soft,
    fakeAffordances: detectFakeAffordances(p.html),
  };
}

// 从所有入口根 BFS（只走指向"存在的页"的边），算可达集
const reachable = new Set(roots);
const queue = [...roots];
while (queue.length) {
  const cur = queue.shift();
  for (const t of graph.get(cur) || []) {
    if (slugSet.has(t) && !reachable.has(t)) {
      reachable.add(t);
      queue.push(t);
    }
  }
}
const islands = pages.map((p) => p.slug).filter((s) => !reachable.has(s));

// 入口走不出去：≥2 页但主入口没有任何非自指、且指向存在页的边
const entryEdges = [...(graph.get(entry) || [])].filter((t) => t !== entry && slugSet.has(t));
const entryStuck = pages.length >= 2 && entryEdges.length === 0;

const neuteredHardCount = Object.keys(neuteredHard).length;
const droppedCount = Object.keys(droppedComponents).length;
const hardFail = dangling.length > 0 || islands.length > 0 || entryStuck || neuteredHardCount > 0 || droppedCount > 0;

const result = {
  canvas_dir: CANVAS_DIR,
  pages: pages.map((p) => p.slug),
  entry,
  entry_roots: roots,
  reachable: [...reachable],
  hard_issues: {
    dangling_links: dangling,
    islands,
    entry_stuck: entryStuck,
    neutered_nav: neuteredHard, // onclick="return false" 的死键，确定性反模式
    dropped_components: droppedComponents, // 装配清单声明但页面里缺的组件
  },
  advisory: {
    dead_hash_links: Object.fromEntries(
      Object.entries(perPage).filter(([, v]) => v.neuteredSoft.length).map(([k, v]) => [k, v.neuteredSoft])
    ),
    fake_affordances: Object.fromEntries(
      Object.entries(perPage).filter(([, v]) => v.fakeAffordances.length).map(([k, v]) => [k, v.fakeAffordances])
    ),
    unwired_state: unwiredState, // 装配清单声明但全页没引用的共享状态
  },
  pass: !hardFail,
};

if (JSON_MODE) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(hardFail ? 1 : 0);
}

// 人话报告
const L = [];
const rootDesc = roots.length > 1 ? `入口=${roots.join(', ')}（多入口）` : `入口=${entry}`;
L.push(`原型体检 · ${pages.length} 个页 · ${rootDesc}`);
L.push('—'.repeat(48));

if (!hardFail) {
  L.push('✅ 没有硬伤：从入口能一路点到每一个页，没有断链、没有死键。');
} else {
  L.push('❌ 有硬伤，这个状态不该交付：');
  if (entryStuck) {
    L.push(`  • 入口页「${entry}」走不出去——它没有任何指向别的页的真链接。`);
    L.push(`    用户打开第一屏就卡住，只能敲 URL 翻页。八成是主 CTA（发送/进入/下一步）没接成 <a href> 或没接 location 跳转。`);
  }
  if (islands.length) {
    L.push(`  • 孤岛页（存在、但从入口点不到，只能敲 URL）：${islands.join(', ')}`);
    L.push(`    多数情况是：孤岛页的上一步缺一个真能点、带用户过来的入口——补上。`);
    L.push(`    例外：若某个本就是另一个合法入口（多角色/多入口原型），给它文件头加 <!-- entry --> 注释，体检就不再报它。`);
  }
  if (Object.keys(neuteredHard).length) {
    L.push(`  • 被掐死的导航（onclick="return false"，看着能点、点了啥也不干——上线必碎的反模式）：`);
    for (const [pg, hits] of Object.entries(neuteredHard)) {
      L.push(`      ${pg}：${hits.slice(0, 3).join('  ')}${hits.length > 3 ? ` …共 ${hits.length} 处` : ''}`);
    }
    L.push(`    要么把目标页建出来真接上，要么诚实置灰（aria-disabled="true" + cursor:not-allowed），别用 return false 偷掐。`);
  }
  if (dangling.length) {
    L.push(`  • 断链（链接指向不存在的页，部署后必碎）：`);
    for (const d of dangling) L.push(`      ${d.from} → /p/${d.target}（${d.target}.html 不存在）`);
  }
  if (Object.keys(droppedComponents).length) {
    L.push(`  • 漏掉的组件（装配清单声明了，但页面里没有对应 data-component 标记——"一次糊整页丢细节"的那个病）：`);
    for (const [pg, names] of Object.entries(droppedComponents)) {
      L.push(`      ${pg}：缺 ${names.join(', ')}`);
    }
    L.push(`    要么把这些组件补进页面（根元素带 data-component="<名字>"），要么从清单里删掉（确实不做了）。`);
  }
}

const softEntries = Object.entries(result.advisory.dead_hash_links);
const fakeEntries = Object.entries(result.advisory.fake_affordances);
const unwiredEntries = Object.entries(result.advisory.unwired_state);
if (softEntries.length || fakeEntries.length || unwiredEntries.length) {
  L.push('');
  L.push('⚠ 需要人工扫一眼（启发式，可能误报）：');
  for (const [pg, hits] of softEntries) {
    L.push(`  • ${pg}：死链接（href="#" 没接 handler）×${hits.length}——是占位就接上或诚实置灰`);
  }
  for (const [pg, items] of fakeEntries) {
    const sample = items.slice(0, 4).map((i) => `<${i.tag} class="${i.cls}">`).join('  ');
    L.push(`  • ${pg}：${items.length} 个元素看着能点却没接 handler，例如 ${sample}`);
    L.push(`    （若是用 JS 事件委托接的可忽略；否则就是"假 affordance"——hover 变手型却点不动，最招人骂。）`);
  }
  for (const [pg, keys] of unwiredEntries) {
    L.push(`  • ${pg}：装配清单声明的共享状态 ${keys.join(', ')} 全页没人引用——可能某个组件忘了接线`);
  }
}

L.push('—'.repeat(48));
L.push(hardFail ? '结论：先补好硬伤再交付。' : '结论：结构上走得通。剩下的好不好看交给设计 reviewer + 你自己点一遍。');
console.log(L.join('\n'));
process.exit(hardFail ? 1 : 0);
