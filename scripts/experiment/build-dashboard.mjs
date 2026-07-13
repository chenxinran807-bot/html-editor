#!/usr/bin/env node
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResult } from './validate-result.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dimensions = ['fidelity', 'flowCoverage', 'interaction', 'visualHierarchy', 'edgeStates', 'stability', 'handoff'];
const args = process.argv.slice(2);
const outputFlag = args.indexOf('--output');
const output = outputFlag >= 0 ? path.resolve(root, args[outputFlag + 1]) : path.join(root, 'comparison/native-experiment');

const exists = async (file) => access(file).then(() => true, () => false);
const repoHref = (repoPath) => `../../${repoPath.split(path.sep).join('/')}`;
const external = (value) => /^https?:\/\//.test(value);
const cellPath = (inputId, skillId) => `experiments/cells/${inputId}/${skillId}`;

export function resolveLocalEntry(value, inputId, skillId) {
  const unsafe = () => new Error(`Unsafe local entry path: ${value}`);
  if (path.isAbsolute(value) || value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value) || value.includes('\\')) throw unsafe();
  if (value.split('/').includes('..')) throw unsafe();
  const repoPath = value.startsWith('experiments/') ? value : `${cellPath(inputId, skillId)}/${value}`;
  const resolved = path.resolve(root, repoPath);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw unsafe();
  return { repoPath, href: repoHref(repoPath) };
}

const resolveEntry = async (value, inputId, skillId) => {
  if (external(value)) return { value, href: value, external: true, exists: true };
  const { repoPath, href } = resolveLocalEntry(value, inputId, skillId);
  return { value, repoPath, href, external: false, exists: await exists(path.join(root, repoPath)) };
};

function rank(rows) {
  return rows.filter((row) => row.scores && Number.isFinite(row.total)).sort((a, b) =>
    b.total - a.total ||
    b.scores.fidelity - a.scores.fidelity ||
    b.scores.interaction - a.scores.interaction ||
    b.scores.stability - a.scores.stability ||
    a.skillId.localeCompare(b.skillId),
  ).map((row, index) => ({ ...row, rank: index + 1 }));
}

const strategy = {
  'open-design': {
    best: 'When a team needs the strongest balanced clickable flow and reproducible browser evidence across both inputs.',
    weakness: 'Nested source screenshots and shallow or incomplete recovery behavior reduce visual and interaction credibility.',
    recommended: 'Recommended for general-purpose prototype reviews where flow coverage matters most.',
    avoid: 'Avoid when pixel-clean source reconstruction or fully terminal AI recovery states are mandatory.',
  },
  'huashu-design': {
    best: 'When exploring several visual directions before committing to one implementation.',
    weakness: 'Directions share substantial structure, and browser assertions do not deeply verify every variant or state.',
    recommended: 'Recommended for early design divergence with a later consolidation pass.',
    avoid: 'Avoid when a compact, production-like artifact and exhaustive interaction proof are required.',
  },
  'prd-generator': {
    best: 'When the prototype must ship with structured PRD, canvas, review, and handoff records.',
    weakness: 'Runtime fidelity and token wiring lag the documentation, and some controls remain shallow.',
    recommended: 'Recommended for documentation-heavy handoff and traceability workflows.',
    avoid: 'Avoid when the only priority is the most polished, native-feeling interaction demo.',
  },
  'pm-kakaxi': {
    best: 'When rapid high-fidelity delivery and strong fixed-task interaction coverage are the priority.',
    weakness: 'Inferred product content and review controls can leak into the visible experience or conflict semantically.',
    recommended: 'Recommended for camera-upload style demos with a disciplined inference review.',
    avoid: 'Avoid when every visible datum must be source-grounded and all peripheral controls must work.',
  },
  'vne-prototype': {
    best: 'When a cloud-materials React scaffold, build gate, manifest, and formal UI specification are required.',
    weakness: 'Private dependencies reduce portability; one input is blocked and the mobile case clashes with the console shell.',
    recommended: 'Recommended for internal console-oriented prototypes with registry access and build approvals.',
    avoid: 'Avoid for portable/offline evaluation or mobile-first work without a compatible VNE shell.',
  },
  'inspire-prototype': {
    best: 'When a hosted prototype URL must be generated quickly with minimal local setup.',
    weakness: 'Interaction reliability and source-image relevance vary sharply, especially on outfit-tab.',
    recommended: 'Recommended for fast hosted concept previews followed by mandatory live-browser review.',
    avoid: 'Avoid when deterministic local artifacts, deep interaction coverage, or strict source fidelity are required.',
  },
};

const deviationSummaryZh = {
  'outfit-tab::open-design': [
    'AI 重试后会持续停留在加载态，尚未验证最终恢复为成功或失败。',
    '部分可见控件仅显示短暂提示，交互反馈、悬停效果和页面转场不够完整。',
    '参考截图被再次嵌入新界面，产生界面套娃、控件残影和裁切；分类与 AI 终态覆盖也不完整。',
    '未执行规定的结构化需求问卷及独立的 setup、run、verifier 子流程，浏览器断言也较浅。',
  ],
  'outfit-tab::huashu-design': [
    '没有完整直接复用官方 ios_frame.jsx，三个设计方向仍共享较多运行结构与内容。',
    '六个分类中只有通勤、出游、小个子具备独立数据，其余分类复用了默认卡片。',
    '浏览器验证仅覆盖首台手机和出游路径，未完整验证全部分类、反馈、返回与两项 AI 操作。',
    '部分尺码、适配建议和商品信息缺少来源或 Mock 标识；品牌核验与新素材采集未执行。',
  ],
  'outfit-tab::prd-generator': [
    'prd.yaml 与原生状态规范仍有差距，设计姿态、追踪和画布元数据不完整。',
    '场景与体型分类、购买和继续搭配等目标状态没有完整呈现，部分控件交互较浅。',
    '参考拼图被直接放入产品界面，形成明显的界面套娃；设计 token 与追踪交付未真正接入。',
    '未进行独立评审，浏览器验证改用 Chrome CDP，且没有覆盖完整反馈与异常矩阵。',
  ],
  'outfit-tab::pm-kakaxi': [
    '商品尺码、材质、发货和加购信息存在无来源推断，替代商品价格也前后冲突。',
    '关注、导航、加购、上传和 AI 推荐等多个可见控件没有实际行为。',
    '异常态、键盘操作和视觉还原验证不足，完整页面截图的嵌入与裁切削弱了高保真程度。',
    '没有独立人工视觉评审，也未向外部飞书多维表格发送使用追踪数据。',
  ],
  'outfit-tab::vne-prototype': [
    '官方私有 cloud-materials 依赖无法从公共 npm 获取，后续官方构建命令又在启动前被审批门禁拒绝。',
    '由于原生构建门禁未通过，没有生成 dist、开发预览、浏览器任务、错误记录或截图。',
  ],
  'outfit-tab::inspire-prototype': [
    '原始生成标准输出未逐字保存，现有 NDJSON 是经过规范化和脱敏的审计记录。',
    '平台最多接收 10 张图片，因此从 13 张输入恢复为只附带 5 张产品方案图。',
    '购买、AI 搭配和 AI 试穿控件不可用；生成图片与服装无关，且缺少避雷、尺码和面料建议。',
  ],
  'camera-upload::open-design': [
    '需求问答由冻结 PRD 推断，独立 setup、run、verifier 子流程无法执行。',
    '相机与审核使用本地模拟；玩偶图片和完整界面截图被用于成功路径，造成界面套娃。',
    '协议选择、相册选中态和完成后的持久终态不完整，权限、空相册、网络失败和超时未实现。',
    '部分截图处于转场中间帧，QA 不自动启动服务，结构化记录也未覆盖成功支路与第二视口。',
  ],
  'camera-upload::huashu-design': [
    '弱运行环境下三个方向采用串行隔离生成，品牌、颜色、审核时长和模拟失败控件均为 Mock。',
    '方向 A 存在黑色拉伸空白，PRD 截图被再次嵌入相机和审核页面，形成界面套娃。',
    '镜头翻转只改变文字，审核失败依赖显式测试按钮，成功、权限、设备、网络与超时状态缺失。',
    'CDP 断言偏浅；三份自包含 HTML 合计约 29 MB，维护和评审成本较高。',
  ],
  'camera-upload::prd-generator': [
    '相机拍摄与远程审核使用本地确定性模拟，评审记录也不是由独立上下文生成。',
    '整屏截图被复用为相机、信息流和相册素材，产生双状态栏、双控件和镜像文字。',
    '菜单与搜索仅用提示反馈，相册选项汇入同一路径；成功审核、权限拒绝和空相册未实现。',
    '导出的设计 token 仅用于文档说明，独立画布页面运行时没有真正引用。',
  ],
  'camera-upload::pm-kakaxi': [
    '相机与审核为本地模拟，权限拒绝、空相册和审核超时属于无视觉依据的评审推断态。',
    '相册缩略图是评估占位素材，ScenarioBar 属于外部评审控件而非用户产品界面。',
    '未实现成功创建与删除；相机缺少闪光灯，失败结果缺少参考稿中的完成操作。',
    '视觉规格记录与失败文案断言较浅，三个推断异常态也缺少完整原始轨迹和独立截图。',
  ],
  'camera-upload::vne-prototype': [
    '移动交互被放在 VNE 控制台框架中，整屏相机截图又叠加生成控件，形成双重界面与裁切黑边。',
    '初始化需要内部源和六项构建脚本审批；构建产物还依赖两张外部图片，并非严格单文件。',
    'QA 只在桌面视口验证失败路径，缺少成功、真实设备不可用和审核服务或网络异常分支。',
    '规格与单页状态机实现存在漂移，浏览器路径、内网依赖和遥测记录也降低了可移植与可审计性。',
  ],
  'camera-upload::inspire-prototype': [
    '审核失败与服务异常页面的“重新上传”均不可用，无法重新开始上传或拍摄。',
    '失败指导过于笼统，食物、风景和泛人物占位图也不符合清晰单人正脸目标。',
    '原始生成 NDJSON 未保存，现有报告为字段级脱敏查询和压缩后的生成记录。',
    '相机与内容审核均为演示模拟，没有调用真实设备或审核服务。',
  ],
};

async function build() {
  const manifest = JSON.parse(await readFile(path.join(root, 'experiments/manifest.json'), 'utf8'));
  const results = [];
  const failures = [];
  for (const inputId of manifest.inputs) {
    for (const skill of manifest.skills) {
      const resultRepoPath = `${cellPath(inputId, skill.id)}/result.json`;
      let value;
      try {
        value = JSON.parse(await readFile(path.join(root, resultRepoPath), 'utf8'));
      } catch (error) {
        failures.push(`${resultRepoPath}: ${error.message}`);
        continue;
      }
      const validation = validateResult(value);
      if (!validation.valid) {
        failures.push(`${resultRepoPath}: ${validation.errors.join('; ')}`);
        continue;
      }
      if (value.inputId !== inputId || value.skillId !== skill.id) failures.push(`${resultRepoPath}: manifest identity mismatch`);
      const artifacts = await Promise.all(value.artifacts.map((entry) => resolveEntry(entry, inputId, skill.id)));
      const evidence = await Promise.all(value.evidence.map((entry) => resolveEntry(entry, inputId, skill.id)));
      const deviationsZh = deviationSummaryZh[`${inputId}::${skill.id}`];
      if (!deviationsZh?.length) failures.push(`${resultRepoPath}: missing Chinese deviation summary`);
      results.push({ ...value, deviationsZh, capabilityName: skill.capabilityName, resultHref: repoHref(resultRepoPath), artifacts, evidence });
    }
  }
  if (failures.length || results.length !== 12) throw new Error(`Result validation failed before aggregation:\n${failures.join('\n')}\nvalidated=${results.length}/12`);

  const rankings = Object.fromEntries(manifest.inputs.map((inputId) => [inputId, rank(results.filter((row) => row.inputId === inputId))]));
  const crossInput = manifest.skills.map(({ id: skillId }) => {
    const outfit = results.find((row) => row.skillId === skillId && row.inputId === 'outfit-tab');
    const camera = results.find((row) => row.skillId === skillId && row.inputId === 'camera-upload');
    const eligible = Boolean(outfit?.scores && camera?.scores);
    return { skillId, outfitTotal: outfit?.scores ? outfit.total : null, cameraTotal: camera?.scores ? camera.total : null, delta: eligible ? camera.total - outfit.total : null };
  });
  const applicability = manifest.skills.map(({ id: skillId, capabilityName }) => {
    const rows = results.filter((row) => row.skillId === skillId);
    return {
      skillId,
      capabilityName,
      rankedInputs: rows.filter((row) => row.scores && Number.isFinite(row.total)).map((row) => row.inputId),
      excludedInputs: rows.filter((row) => !row.scores || !Number.isFinite(row.total)).map((row) => ({ inputId: row.inputId, status: row.status, reason: row.reason ?? null })),
    };
  });
  const data = {
    summary: { resultCount: results.length, scoredCount: results.filter((row) => row.scores).length, blockedCount: results.filter((row) => row.status === 'BLOCKED').length },
    dimensions,
    rankings,
    results,
    crossInput,
    applicability,
  };

  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'data.json'), `${JSON.stringify(data, null, 2)}\n`);
  await writeFile(path.join(output, 'index.html'), dashboardHtml());
  await writeFile(path.join(output, 'report.md'), reportMarkdown(data, manifest.skills));
  console.log(`Validated ${results.length}/12 results; dashboard written to ${path.relative(root, output) || '.'}`);
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>原型能力实验对比</title>
<style>:root{color-scheme:dark;--bg:#09111f;--panel:#111d31;--line:#263653;--text:#edf4ff;--muted:#9fb0ca;--accent:#69e4c4}*{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui;background:radial-gradient(circle at 10% 0,#18345b,transparent 32%),var(--bg);color:var(--text)}main{max-width:1440px;margin:auto;padding:32px}h1{font-size:32px;margin:0 0 8px}h2{margin-top:42px}h3{margin:24px 0 12px}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.card{background:rgba(17,29,49,.94);border:1px solid var(--line);border-radius:16px;padding:18px;overflow:auto}.metric{font-size:28px;font-weight:800;color:var(--accent)}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--line);vertical-align:top}.bar{height:8px;background:#263653;border-radius:8px;overflow:hidden}.bar>i{display:block;height:100%;background:linear-gradient(90deg,#6f8cff,var(--accent))}.artifact-result ul{padding-left:20px}.artifact-result a{display:inline-block;margin:4px 0;color:#8fdcff}.deviation{border-left:3px solid #ffb86b;padding-left:10px;margin:8px 0}@media(max-width:700px){main{padding:18px}table{font-size:12px}}</style></head>
<body><main><h1>原型能力实验对比</h1><p class="muted">12 个隔离实验结果的可审计聚合。已阻断结果不补分、不参与排名。</p>
<section><h2>概览</h2><div id="overview" class="grid"></div></section>
<section><h2>相机上传排名</h2><div id="rank-camera" class="card"></div></section>
<section><h2>穿搭 Tab 排名</h2><div id="rank-outfit" class="card"></div></section>
<section><h2>七维分解</h2><div id="dimensions" class="card"></div></section>
<section><h2>原型产物</h2><div id="artifacts"></div></section>
<section><h2>未完全按 Skill 标准执行的部分</h2><div id="deviations" class="grid"></div></section>
<section><h2>跨输入比较</h2><div id="cross" class="card"></div></section>
<section><h2>适用性</h2><div id="applicability" class="card"></div></section>
</main><script>
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table=(heads,rows)=>'<table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const inputLabel={"camera-upload":'相机上传',"outfit-tab":'穿搭 Tab'};
const statusLabel={PASS:'通过',CONCERNS:'有关注项',PASS_WITH_CONCERNS:'通过，但有关注项',BLOCKED:'已阻断',NOT_APPLICABLE:'不适用'};
const dimensionLabel={fidelity:'还原度',flowCoverage:'流程覆盖',interaction:'交互',visualHierarchy:'视觉层级',edgeStates:'边界状态',stability:'稳定性',handoff:'交付质量'};
fetch('data.json').then(r=>r.json()).then(d=>{
 overview.innerHTML=[['实验结果',d.summary.resultCount],['已评分',d.summary.scoredCount],['已阻断',d.summary.blockedCount]].map(x=>'<div class="card"><div class="metric">'+x[1]+'</div>'+x[0]+'</div>').join('');
 const ranking=id=>table(['排名','技能正式名称','总分','状态'],d.rankings[id].map(x=>[x.rank,esc(x.capabilityName),x.total,esc(statusLabel[x.status]??'未知状态')]));
 document.querySelector('#rank-camera').innerHTML=ranking('camera-upload');document.querySelector('#rank-outfit').innerHTML=ranking('outfit-tab');
 dimensions.innerHTML=table(['输入','技能正式名称','总分',...d.dimensions.map(k=>dimensionLabel[k])],d.results.map(x=>[esc(inputLabel[x.inputId]),esc(x.capabilityName),x.total??'未评分',...d.dimensions.map(k=>x.scores?'<div>'+x.scores[k]+'</div><div class="bar"><i style="width:'+(x.scores[k]/({fidelity:20,flowCoverage:15,interaction:20,visualHierarchy:15,edgeStates:10,stability:10,handoff:10}[k])*100)+'%"></i></div>':'未评分')]));
 artifacts.innerHTML=Object.keys(inputLabel).map(inputId=>'<h3>'+inputLabel[inputId]+'</h3><div class="grid">'+d.results.filter(x=>x.inputId===inputId).map(x=>{const available=x.artifacts.filter(a=>a.exists);return '<article class="card artifact-result" data-result-id="'+esc(x.inputId+'::'+x.skillId)+'"><b>'+esc(x.capabilityName)+'</b><p>状态：'+esc(statusLabel[x.status]??'未知状态')+' · 总分：'+(x.total??'未评分')+'</p>'+(available.length?'<ul>'+available.map(a=>'<li><a href="'+esc(a.href)+'">打开产物：'+esc(a.value)+'</a></li>').join('')+'</ul>':'<p class="muted">暂无可打开产物</p>')+'</article>'}).join('')+'</div>').join('');
 deviations.innerHTML=d.results.map(x=>'<article class="card deviation-result" data-result-id="'+esc(x.inputId+'::'+x.skillId)+'"><b>'+esc(inputLabel[x.inputId])+' · '+esc(x.capabilityName)+'</b>'+(x.deviationsZh.length?x.deviationsZh.map(v=>'<div class="deviation">'+esc(v)+'</div>').join(''):'<p class="muted">暂无偏离记录</p>')+'</article>').join('');
 cross.innerHTML=table(['技能正式名称','穿搭 Tab','相机上传','差值（相机上传−穿搭 Tab）'],d.crossInput.map(x=>[esc(d.results.find(y=>y.skillId===x.skillId).capabilityName),x.outfitTotal??'不适用',x.cameraTotal??'不适用',x.delta??'不适用']));
 applicability.innerHTML=table(['技能正式名称','参与排名的输入','排除的输入'],d.applicability.map(x=>[esc(x.capabilityName),x.rankedInputs.length?esc(x.rankedInputs.map(y=>inputLabel[y]).join('、')):'无',x.excludedInputs.length?esc(x.excludedInputs.map(y=>inputLabel[y.inputId]+'（'+(statusLabel[y.status]??'未知状态')+'）').join('、')):'无']));
});</script></body></html>`;
}

function reportMarkdown(data, skills) {
  const lines = ['# Native Prototype Skill Comparison', '', `Generated from ${data.summary.resultCount} validated cell results. Rankings exclude scoreless statuses; cross-input deltas require scores on both inputs.`, ''];
  for (const { id: skillId } of skills) {
    const rows = data.results.filter((row) => row.skillId === skillId);
    const advice = strategy[skillId];
    const refs = rows.map((row) => {
      const evidence = row.evidence.find((item) => item.exists && !item.external);
      return `[${row.inputId} result](${row.resultHref})${evidence ? ` · [evidence](${evidence.href})` : ''}`;
    }).join(' · ');
    lines.push(`## ${skillId}`, '', `- **Best use:** ${advice.best}`, `- **Weakness:** ${advice.weakness}`, `- **Recommended:** ${advice.recommended}`, `- **Avoid:** ${advice.avoid}`, `- **Evidence:** ${refs}`, '');
  }
  lines.push('## Ranking snapshots', '');
  for (const [inputId, rows] of Object.entries(data.rankings)) {
    lines.push(`### ${inputId}`, '', ...rows.map((row) => `${row.rank}. **${row.skillId}** — ${row.total}/100 ([result](${row.resultHref}))`), '');
  }
  const excluded = data.applicability.flatMap((row) => row.excludedInputs.map((item) => `- **${row.skillId} / ${item.inputId}:** ${item.status} — ${item.reason ?? 'No scored result.'}`));
  lines.push('## Applicability exclusions', '', ...(excluded.length ? excluded : ['None.']), '');
  while (lines.at(-1) === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
