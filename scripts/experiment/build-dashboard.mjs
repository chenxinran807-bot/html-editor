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
const resolveEntry = async (value, inputId, skillId) => {
  if (external(value)) return { value, href: value, external: true, exists: true };
  const repoPath = value.startsWith('experiments/') ? value : `${cellPath(inputId, skillId)}/${value}`;
  return { value, repoPath, href: repoHref(repoPath), external: false, exists: await exists(path.join(root, repoPath)) };
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
      results.push({ ...value, capabilityName: skill.capabilityName, resultHref: repoHref(resultRepoPath), artifacts, evidence });
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
  const gallery = results.flatMap((row) => row.evidence
    .filter((item) => item.exists && !item.external && /\.(png|jpe?g|webp)$/i.test(item.value))
    .map((item) => ({ inputId: row.inputId, skillId: row.skillId, ...item })));
  const data = {
    generatedAt: new Date().toISOString(),
    summary: { resultCount: results.length, scoredCount: results.filter((row) => row.scores).length, blockedCount: results.filter((row) => row.status === 'BLOCKED').length },
    dimensions,
    rankings,
    results,
    gallery,
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
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Native Prototype Skills Comparison</title>
<style>:root{color-scheme:dark;--bg:#09111f;--panel:#111d31;--line:#263653;--text:#edf4ff;--muted:#9fb0ca;--accent:#69e4c4}*{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui;background:radial-gradient(circle at 10% 0,#18345b,transparent 32%),var(--bg);color:var(--text)}main{max-width:1440px;margin:auto;padding:32px}h1{font-size:32px;margin:0 0 8px}h2{margin-top:42px}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.card{background:rgba(17,29,49,.94);border:1px solid var(--line);border-radius:16px;padding:18px;overflow:auto}.metric{font-size:28px;font-weight:800;color:var(--accent)}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--line);vertical-align:top}.bar{height:8px;background:#263653;border-radius:8px;overflow:hidden}.bar>i{display:block;height:100%;background:linear-gradient(90deg,#6f8cff,var(--accent))}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.gallery a{color:inherit;text-decoration:none}.gallery img{width:100%;height:240px;object-fit:cover;border-radius:10px;background:#07101d}.chips{display:flex;gap:6px;flex-wrap:wrap}.chip{padding:3px 8px;border-radius:99px;background:#243653;color:#cfe0ff}a{color:#8fdcff}.deviation{border-left:3px solid #ffb86b;padding-left:10px;margin:8px 0}@media(max-width:700px){main{padding:18px}table{font-size:12px}}</style></head>
<body><main><h1>Native Prototype Skill Comparison</h1><p class="muted">12 个隔离实验结果的可审计聚合。BLOCKED 不补分、不参与排名。</p>
<section><h2>概览</h2><div id="overview" class="grid"></div></section>
<section><h2>camera-upload 排名</h2><div id="rank-camera" class="card"></div></section>
<section><h2>outfit-tab 排名</h2><div id="rank-outfit" class="card"></div></section>
<section><h2>七维分解</h2><div id="dimensions" class="card"></div></section>
<section><h2>证据画廊</h2><div id="gallery" class="gallery"></div></section>
<section><h2>Artifact 链接</h2><div id="artifacts" class="grid"></div></section>
<section><h2>偏离</h2><div id="deviations" class="grid"></div></section>
<section><h2>跨输入</h2><div id="cross" class="card"></div></section>
<section><h2>适用性</h2><div id="applicability" class="card"></div></section>
</main><script>
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table=(heads,rows)=>'<table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
fetch('data.json').then(r=>r.json()).then(d=>{
 overview.innerHTML=[['结果',d.summary.resultCount],['已评分',d.summary.scoredCount],['BLOCKED',d.summary.blockedCount]].map(x=>'<div class="card"><div class="metric">'+x[1]+'</div>'+x[0]+'</div>').join('');
 const ranking=id=>table(['#','Skill','Total','Status'],d.rankings[id].map(x=>[x.rank,esc(x.skillId),x.total,esc(x.status)]));
 document.querySelector('#rank-camera').innerHTML=ranking('camera-upload');document.querySelector('#rank-outfit').innerHTML=ranking('outfit-tab');
 dimensions.innerHTML=table(['Input','Skill','Total',...d.dimensions],d.results.map(x=>[esc(x.inputId),esc(x.skillId),x.total??'—',...d.dimensions.map(k=>x.scores?'<div>'+x.scores[k]+'</div><div class="bar"><i style="width:'+(x.scores[k]/({fidelity:20,flowCoverage:15,interaction:20,visualHierarchy:15,edgeStates:10,stability:10,handoff:10}[k])*100)+'%"></i></div>':'—')]));
 gallery.innerHTML=d.gallery.map(x=>'<a class="card" href="'+esc(x.href)+'"><img loading="lazy" src="'+esc(x.href)+'"><b>'+esc(x.skillId)+'</b><br><span class="muted">'+esc(x.inputId)+' · '+esc(x.value)+'</span></a>').join('');
 artifacts.innerHTML=d.results.map(x=>'<div class="card"><b>'+esc(x.inputId)+' · '+esc(x.skillId)+'</b><ul>'+x.artifacts.map(a=>'<li><a href="'+esc(a.href)+'">'+esc(a.value)+'</a> '+(a.exists?'':'<span class="muted">(missing)</span>')+'</li>').join('')+'</ul></div>').join('');
 deviations.innerHTML=d.results.map(x=>'<div class="card"><b>'+esc(x.inputId)+' · '+esc(x.skillId)+'</b>'+x.deviations.map(v=>'<div class="deviation">'+esc(v)+'</div>').join('')+'</div>').join('');
 cross.innerHTML=table(['Skill','outfit-tab','camera-upload','Δ camera−outfit'],d.crossInput.map(x=>[esc(x.skillId),x.outfitTotal??'—',x.cameraTotal??'—',x.delta??'不适用']));
 applicability.innerHTML=table(['Skill','参与排名','排除'],d.applicability.map(x=>[esc(x.skillId),esc(x.rankedInputs.join(', ')),x.excludedInputs.length?esc(x.excludedInputs.map(y=>y.inputId+' ('+y.status+')').join(', ')):'—']));
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

await build();
