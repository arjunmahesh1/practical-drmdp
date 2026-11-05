import {escape as esc,fmt} from './model.mjs';
import {matchesSetting,settingsCSV} from './setting-hierarchy.mjs?v=20261105-audit1';
import {auditRows} from './hierarchy-audit.mjs?v=20261105-audit1';
let inventory,audit;
const levels=['L1','L2','L3'];
const titles={pass:'Pass',fail:'Not established',borderline:'Borderline',unassessed:'No saved test',blocked:'Unavailable',inconclusive:'Inconclusive'};
const number=x=>Number.isFinite(x)?fmt(x,x!==0&&Math.abs(x)<.01?6:3):'N/A';
const ci=x=>x?`${number(x[0])} [${number(x[1])}, ${number(x[2])}]`:'N/A';
function comparison(row,view='advanced',axis=null){
 if(row.dataset)return 'reports/return-reliability/index.html?'+new URLSearchParams({v:'20261105-flat1',dataset:row.dataset,view:'comparison',mode:'fixed',setting:row.model});
 if(!row.study)return null;
 const scope=axis||view!=='advanced'?'axis':row.result.code==='L3'?'suite':row.result.code==='L2'?'axis':'nominal';
 const selectedAxis=axis||(row.result.code==='L2'?row.gates.L2.tests?.find(t=>t.L2&&t.eligible)?.axis:null);
 return '?'+new URLSearchParams({study:row.study,setting:row.model,reference:row.reference,scope,...row.archived?{archive:'1'}:{},...selectedAxis?{axis:selectedAxis}:{}})+'#'+view;
}
function gateCell(row,level){
 if(row.role==='reference'||row.role==='control')return '<span class="setting-muted">—</span>';
 const g=row.gates[level],qualitative=level==='L1',n=row.l1Nominal||row.nominal;
 const text=g.status==='pass'&&qualitative?'Comparable':g.status==='fail'&&qualitative?'Not met':titles[g.status];
 let detail='';
 if(level==='L1'&&n)detail=`<small>Mean ${number(n.mean)} vs ${number(n.referenceMean)}<br>Low-return: ${n.failures===null?'N/A':n.failures+'/'+n.policies} vs ${n.referenceFailures===null?'N/A':n.referenceFailures+'/'+n.referencePolicies}${row.l1ReferenceLabel&&g.originalReference!==row.reference?'<br>L1 reference: '+esc(row.l1ReferenceLabel):''}</small>`;
 if(level==='L2'&&g.declared)detail=`<small>${g.passed} passed / ${g.tested} evaluated<br>${g.declared} declared shifts</small>`;
 if(level==='L3'&&g.d_auc)detail=`<small>Δ AUC ${ci(g.d_auc)}<br>Δ return ${ci(g.d_mean)}<br>Margin ${number(g.margin)}</small>`;
 if(g.status==='blocked')detail+=`<small>${esc(g.note.split(';')[0])}</small>`;
 return `<span class="setting-gate ${g.status}" title="${esc(g.note||g.basis)}">${text}${qualitative&&g.status!=='blocked'?' · qualitative':''}</span>${detail}`;
}
function evidence(row){
 const tests=row.gates.L2.tests||[];
 return `<details class="setting-evidence"><summary>Evidence</summary><p><strong>${esc(row.environment)}</strong>${row.branch?'<br>'+esc(row.branch):''}</p>${row.audit?`<p>${esc(row.resampling)} · 10,000 resamples · pointwise 95% intervals. Comparator: ${esc(row.referenceLabel)}. Axis-specific nominal references; unadjusted exploratory analysis.</p>`:''}${levels.map(l=>`<p><strong>${l}: ${esc(titles[row.gates[l].status])}</strong> · ${esc(row.gates[l].basis)}<br>${esc(row.gates[l].note||'')}</p>`).join('')}
 ${tests.length?`<details><summary>${tests.length} shift assessments</summary><ul>${tests.map(t=>`<li><strong>${esc(t.axis)} / ${esc(t.side)}</strong>: ${t.eligible?(t.L2?'both elements pass':t.diagnosis==='adverse'?'no qualifying gain':'inconclusive'):esc(t.reason||'perturbation effect unverified')}${t.d_auc?`<br>Δ reliability AUC ${ci(t.d_auc)}<br>Δ whole-axis mean ${ci(t.d_axis_ret)}; margin ${number(t.margin)}<br>${t.n} policies; ${t.levels} shifted levels · <a href="${esc(comparison(row,'returns',t.axis))}">Axis curves</a>`:''}</li>`).join('')}</ul></details>`:''}
 ${row.comparisons?.length>1?`<details><summary>All ${row.comparisons.length} reference comparisons</summary>${row.comparisons.map(c=>`<p><strong>${esc(audit.labels[c.reference])}</strong>: L1 ${esc(titles[c.gates.L1.status])}; L2 ${c.gates.L2.passed}/${c.gates.L2.tested}; L3 ${esc(titles[c.gates.L3.status])}${c.gates.L3.d_auc?'<br>Suite ΔAUC '+ci(c.gates.L3.d_auc):''}</p>`).join('')}</details>`:''}
 ${row.paperGates?.L3.basis==='manuscript report'?`<details><summary>Original paper evidence</summary><p>${esc(row.paperGates.L3.note)}</p><p>The original reported numbers retain their own normalization and resampling convention. The new all-setting audit is separate.</p></details>`:''}</details>`;
}
export async function showSettings(root,openView,active=()=>true){
 if(!inventory){const r=await fetch('data/hierarchy/settings.json?v=20261105-flat1');if(!r.ok)throw Error('Setting inventory unavailable');inventory=await r.json();}
 if(!audit){const r=await fetch('data/hierarchy/assessments.json?v=20261105-audit1');if(!r.ok)throw Error('All-setting assessment unavailable');audit=await r.json();}
 if(!active())return;
 const q=new URLSearchParams(location.search),$=id=>root.querySelector('#'+id),sourceRows=inventory.rows.filter(r=>r.model);
 root.innerHTML=`<div class="library-heading"><h1>Results by setting</h1><a href="data/hierarchy/assessments.csv" download>All comparisons CSV ↓</a></div>
 <div class="metric-tabs" role="tablist" aria-label="Hierarchy views"><button role="tab" data-overview aria-selected="true">All settings</button><button role="tab" data-level="L1" aria-selected="false">Nominal summaries</button><button role="tab" data-level="L2" aria-selected="false">Whole-axis summaries</button><button role="tab" data-level="L3" aria-selected="false">Suite summaries</button></div>
 <p class="evidence-caution">Highest supported level under the paper’s exploratory tests. Levels are cumulative; L1 is qualitative. L2 needs a shift repair and whole-axis return guardrail; L3 needs one fixed setting across the full suite. Inconclusive does not mean failed, and unavailable rows state the missing requirement.</p>
 <div class="evidence-filters setting-filters"><label>Environment<select id="settings-env"><option value="all">All environments / versions</option>${[...new Set(sourceRows.map(r=>r.environment))].sort().map(e=>`<option>${esc(e)}</option>`).join('')}</select></label><label>Algorithm<select id="settings-algorithm"><option value="all">All algorithms</option>${[...new Set(sourceRows.map(r=>r.algorithm).filter(Boolean))].sort().map(e=>`<option>${esc(e)}</option>`).join('')}</select></label><label>Supported level<select id="settings-result">${[['all','All results'],['L3','L3'],['L2','L2'],['L1','L1 only'],['none','None (L1 failed)'],['borderline','Borderline L1'],['unassessed','Evidence unavailable'],['reference','References'],['control','Controls']].map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label><label>Find a cap or method<input id="settings-search" type="search" placeholder="Cap 400, β, joint-delta..."></label></div>
 <div class="setting-comparator"><label>Comparison<select id="settings-comparison"><option value="strongest">Strongest observed reference · ex post</option><option value="standard">Vanilla reference</option><option value="paper">Original paper reference</option><option value="all">Every named reference</option>${Object.keys(audit.labels).filter(m=>!['vanilla','standard'].includes(m)).map(m=>`<option value="reference:${esc(m)}">${esc(audit.labels[m])} reference</option>`).join('')}</select></label><p id="settings-selection-note"></p></div>
 <div class="setting-options"><span id="settings-study-filter" hidden></span></div>
 <div class="evidence-toolbar"><span id="settings-count"></span><button id="settings-download" class="text-button">Filtered CSV ↓</button></div>
 <div id="evidence-table" class="table-scroll setting-table" tabindex="0" aria-label="Environment, method, setting and supported robustness level"></div>
 <details class="setting-definitions"><summary>Definitions & evidence coverage</summary><label class="evidence-toggle"><input id="settings-archive" type="checkbox"> Include archived custom TD3-KL</label>
 <p>159 active settings, 217 fixed-reference comparisons. Every eligible shift is evaluated for each setting; the analysis is no longer limited to previously selected caps. L2/L3 use 10,000 whole-policy bootstrap resamples and a 5% mean-return margin. L1 has no numerical tolerance.</p>
 <p>Each new comparison uses its named comparator’s nominal median on each axis. The original saved paper tests used a fixed study reference and remain available as historical evidence; counts can differ. Matched policies are resampled together only for the explicitly paired historical comparisons. Other comparisons resample methods independently.</p>
 <p>Exploratory, unadjusted intervals across many settings and shifts are not independent confirmation. The strongest observed reference is chosen after seeing these results. A no-op comparison does not establish an advantage over vanilla. A weak control cannot rescue nominal incompetence. Nonpositive nominal references do not receive an invented normalized metric; unverified perturbation axes cannot certify a full suite.</p>
 <a href="data/hierarchy/audit-protocol.md">Audit protocol</a> · <a href="data/hierarchy/assessments.json" download>All assessment data ↓</a> · <a href="data/hierarchy/settings.json" download>Original setting inventory ↓</a></details>`;
 for(const b of root.querySelectorAll('[data-level]'))b.onclick=()=>openView(b.dataset.level);
 const ids={environment:'settings-env',algorithm:'settings-algorithm',result:'settings-result'};
 for(const [key,id]of Object.entries(ids)){const raw=q.get(key),value=key==='environment'?({Pendulum:'Inverted Pendulum',DoublePendulum:'Inverted Double Pendulum'}[raw]||raw):raw;if([...$(id).options].some(o=>o.value===value))$(id).value=value;}
 if([...$('settings-comparison').options].some(o=>o.value===q.get('comparison')))$('settings-comparison').value=q.get('comparison');
 $('settings-search').value=q.get('search')||'';$('settings-archive').checked=q.get('archive')==='1';
 const study=q.get('study');
 if(study){$('settings-study-filter').hidden=false;$('settings-study-filter').innerHTML=`Configuration: <code>${esc(study)}</code> <button id="settings-clear-study" class="text-button">All results</button>`;$('settings-clear-study').onclick=()=>{const u=new URL(location.href);u.searchParams.delete('study');history.replaceState(null,'',u);$('settings-study-filter').hidden=true;render();};}
 function render(){
  const mode=$('settings-comparison').value,filter={environment:$('settings-env').value,algorithm:$('settings-algorithm').value,result:$('settings-result').value,search:$('settings-search').value,archive:$('settings-archive').checked};
  const currentStudy=new URLSearchParams(location.search).get('study');
  const visible=auditRows(sourceRows,audit,mode).filter(r=>matchesSetting(r,filter)&&(!currentStudy||r.study===currentStudy));
  $('settings-count').textContent=`${new Set(visible.map(r=>r.id)).size} settings${mode==='all'?' · '+visible.filter(r=>r.audit).length+' reference pairs':''} · ${new Set(visible.map(r=>r.environment)).size} environments`;
  $('settings-selection-note').textContent=mode==='strongest'?'Reference selected after comparing the results; one reference remains fixed across every L3 axis.':mode==='all'?'All reference comparisons, including adverse and inconclusive results.':'One named reference per comparison; no switching between axes.';
  $('evidence-table').innerHTML=`<table><thead><tr><th>Environment / method</th><th>Supported level</th><th>Setting</th><th>Comparator</th><th>L1 · nominal</th><th>L2 · shift repair</th><th>L3 · full suite</th><th>Inspect</th></tr></thead><tbody>${visible.map(r=>`<tr data-setting-row="${esc(r.comparisonId||r.id)}" data-reference="${esc(r.reference)}" data-result="${r.result.code}"><th scope="row"><strong>${esc(r.environment)}</strong><small>${esc([r.algorithm,r.family].filter(Boolean).join(' '))}</small>${r.branch?'<small>'+esc(r.branch)+'</small>':''}${r.archived?'<small>Archived</small>':''}<small class="setting-mobile-summary">${esc(r.settingLabel)} · vs ${esc(r.referenceLabel)}</small></th><td><strong class="setting-result ${r.result.code}">${esc(r.result.label)}</strong></td><td>${esc(r.settingLabel)}</td><td>${esc(r.referenceLabel)}</td>${levels.map(l=>`<td>${gateCell(r,l)}</td>`).join('')}<td><a href="${esc(comparison(r,'returns'))}">Curves ↗</a><a href="${esc(comparison(r))}">Metrics ↗</a>${evidence(r)}</td></tr>`).join('')||'<tr><td colspan="8">No settings match these filters.</td></tr>'}</tbody></table>`;
  const u=new URL(location.href);u.search=new URLSearchParams({view:'settings',comparison:mode,...currentStudy?{study:currentStudy}:{},...Object.fromEntries(Object.entries(filter).filter(([k,v])=>k!=='archive'&&v&&v!=='all')),...filter.archive?{archive:'1'}:{}});u.hash='robustness';history.replaceState(null,'',u);
  $('settings-download').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([settingsCSV(visible)],{type:'text/csv'}));a.href=url;a.download='robustness-by-setting.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }
 for(const id of ['settings-env','settings-algorithm','settings-result','settings-archive','settings-comparison'])$(id).onchange=render;
 $('settings-search').oninput=render;render();
}
