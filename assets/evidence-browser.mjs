import {escape as esc,label,fmt} from './model.mjs';
import {showSettings} from './audited-settings.mjs?v=20261107-cells1';
import {showNewCellAudit} from './pairing-audit.mjs?v=20261108-pairing1';
import {showProfiles} from './robustness-profiles.mjs?v=20261114-profiles1';
const root=document.getElementById('evidence-page');
let index,limit=80,ticket=0;
const $=id=>document.getElementById(id),q=()=>new URLSearchParams(location.search);
const number=x=>x===null||!Number.isFinite(x)?'N/A':fmt(x,Math.abs(x)<1?4:2);
function destination(row,view='advanced'){
 const u=new URL(location.href);u.search=new URLSearchParams({study:row.study,setting:row.model,reference:row.reference,axis:row.axis||'mass',scope:row.scope,metric:row.selectedAuc===null?'raw':'reliability',...row.value!==null?{value:row.value}:{}});u.hash=view;
 return u.pathname+u.search+u.hash;
}
function exportRows(rows){
 const fields=['level','study','environment','algorithm','family','branch','model','reference','scope','axis','value','selectedMean','referenceMean','deltaMean','selectedAuc','referenceAuc','deltaAuc','minN','referenceMinN','intended','status','warning','paperLabel'];
 const csv=[fields,...rows.map(r=>fields.map(f=>r[f]??''))].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='descriptive-hierarchy-comparisons.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function route(){
 root.hidden=location.hash!=='#robustness';root.dataset.active=root.hidden?'0':'1';if(root.hidden){++ticket;return;}
 const job=++ticket;root.innerHTML='<p role="status">Loading measured comparisons...</p>';
 try{
  if(q().get('view')==='new-cells'){await showNewCellAudit(root,()=>job===ticket&&!root.hidden);return;}
  if(q().get('view')==='settings'){await showSettings(root,openView,()=>job===ticket&&!root.hidden);return;}
  if(!q().has('level')){await showProfiles(root,()=>job===ticket&&!root.hidden);return;}
  if(!index){const r=await fetch('data/evidence-index.json?v=20261107-cells1');if(!r.ok)throw Error('Comparison index unavailable');index=await r.json();}if(job!==ticket)return;shell();}
 catch(e){if(job===ticket)root.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}
}
function openView(level){const u=new URL(location.href);if(level==='settings'){u.searchParams.set('view','settings');u.searchParams.delete('level');}else{u.searchParams.delete('view');u.searchParams.set('level',level);}history.pushState(null,'',u);route();}
function shell(){
 const studies=[...new Map(index.rows.map(r=>[r.study,r])).values()];
 root.innerHTML=`<div class="library-heading"><div><h1>Descriptive comparisons</h1><p class="library-subtitle">Nominal, whole-axis and full-suite summaries.</p></div><a href="data/evidence-index.json" download>Comparison data ↓</a></div>
 <p class="evidence-caution">Exploratory evidence, not L1/L2/L3 certification. A favorable badge requires higher mean return and reliability AUC, complete policy counts and no flagged perturbation warning. No statistical significance or physical task success is inferred.</p>
 <div class="metric-tabs" role="tablist" aria-label="Hierarchy views"><button role="tab" data-overview>All settings</button><button role="tab" data-level="L1">Nominal summaries</button><button role="tab" data-level="L2">Whole-axis summaries</button><button role="tab" data-level="L3">Suite summaries</button></div>
 <div class="evidence-filters"><label>Environment<select id="evidence-env"><option value="all">All environments / versions</option>${[...new Set(studies.map(r=>r.environment))].map(e=>`<option>${esc(e)}</option>`).join('')}</select></label><label>Cohort<select id="evidence-study"><option value="all">All cohorts</option>${studies.map(r=>`<option value="${r.study}">${esc(r.environment+' / '+r.algorithm+'-'+r.family+' / '+r.branch)}</option>`).join('')}</select></label><label>Comparisons<select id="evidence-status"><option value="all">All results, gains first</option><option value="gain">Mean + reliability gains</option><option value="mixed">Mixed trade-offs</option><option value="paper">Paper examples</option></select></label><label>Find a setting or perturbation<input id="evidence-search" type="search" placeholder="Cap, mass, PPO, friction..."></label></div>
 <label id="evidence-condition-label" class="evidence-toggle"><input id="evidence-condition" type="checkbox"> Notable single severities instead of full axes</label>
 <p id="evidence-scope-note"></p><div class="evidence-toolbar"><span id="evidence-count"></span><button id="evidence-download" class="text-button">Export comparisons ↓</button></div><div id="evidence-table" class="table-scroll"></div><button id="evidence-more" class="text-button">More comparisons</button>
 <details class="evidence-paper"><summary>Paper examples and their exact comparators</summary><div>${index.paperExamples.map(r=>`<p><strong>${esc(r.paperTitle)}</strong> · ${esc(label(r.model))} vs ${esc(label(r.reference))}. <a href="${r.url}">Matching metrics ↗</a>${r.paperPdf?` · <a href="${r.paperPdf}" target="_blank" rel="noopener">Original paper PDF ↗</a>`:''}${r.note?`<br>${esc(r.note)}`:''}</p>`).join('')}</div><p>Single-condition illustrations are not full-axis evidence. Historical inactive-cap comparisons do not establish an advantage against ordinary standard training.</p></details>
 <details><summary>Inverted Pendulum and Inverted Double Pendulum</summary><p>The original evaluation sets have policy-level hierarchy assessments. Additional 16-axis Pendulum and 12-axis Double Pendulum sets retain separate descriptive metrics; earlier levels do not transfer.</p><a href="reports/return-reliability/index.html?v=20261105-pendulum1">Original evaluations ↗</a> · <a href="reports/pendulum-additions/index.html?v=20261105-additions1">Additional axes ↗</a></details>
 <details><summary>Definitions and scope</summary><p>Whole-axis summaries average both sides of nominal; they are not the one-sided L2 repair test. Suite summaries give each axis equal weight. All settings lists the current cumulative hierarchy and its saved gate evidence; these descriptive rows do not assign passes.</p><p><dfn title="R₀ is the median nominal return of the named reference policies. It is fixed across methods.">R₀</dfn> is the nominal reference median. <dfn title="For each trained policy, divide its episode-mean return by R₀; count the fraction with Z at least t.">S(t) = P(R / R₀ ≥ t)</dfn>. <dfn title="Average clip(R/R₀, 0, 1). This descriptive integral does not include a confidence interval.">Reliability AUC</dfn> is mean clipped retained return. Nonpositive reference returns remain in native units.</p><p>Unfinished cohorts and perturbation-effect warnings are retained. Favorable results are selected after seeing the same data. All settings and adverse comparisons remain accessible. ${esc(index.conditionSelection)}</p></details>`;
 const level=['L1','L2','L3'].includes(q().get('level'))?q().get('level'):'L2';root.dataset.level=level;
 if(studies.some(r=>r.study===q().get('study')))$('evidence-study').value=q().get('study');
 if(studies.some(r=>r.environment===q().get('environment')))$('evidence-env').value=q().get('environment');
 if(['gain','mixed','paper'].includes(q().get('result')))$('evidence-status').value=q().get('result');
 $('evidence-condition').checked=q().get('conditions')==='1';$('evidence-search').value=q().get('search')||'';
 root.querySelector('[data-overview]').onclick=()=>openView('settings');
 for(const b of root.querySelectorAll('[data-level]'))b.onclick=()=>{root.dataset.level=b.dataset.level;limit=80;render();};
 for(const id of ['evidence-env','evidence-study','evidence-status','evidence-condition'])$(id).onchange=()=>{limit=80;render();};
 $('evidence-search').oninput=()=>{limit=80;render();};$('evidence-more').onclick=()=>{limit+=80;render();};render();
}
function render(){
 const level=root.dataset.level,condition=level==='L2'&&$('evidence-condition').checked;
 $('evidence-condition-label').hidden=level!=='L2';
 root.querySelectorAll('[data-level]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.level===level)));
 const target=condition?'condition':level,env=$('evidence-env').value,study=$('evidence-study').value,status=$('evidence-status').value,search=$('evidence-search').value.toLowerCase();
 const rows=index.rows.filter(r=>r.level===target&&(env==='all'||r.environment===env)&&(study==='all'||r.study===study)&&(status==='all'||status==='gain'&&r.favorable||status==='mixed'&&r.status==='Mixed trade-off'||status==='paper'&&r.paperLabel)&&[r.environment,r.study,r.branch,r.algorithm,r.family,label(r.model),r.axisTitle,r.value].join(' ').toLowerCase().includes(search)).sort((a,b)=>Number(b.favorable)-Number(a.favorable)||(b.deltaAuc??-Infinity)-(a.deltaAuc??-Infinity)||a.study.localeCompare(b.study));
 $('evidence-scope-note').textContent=condition?'Strongest measured single severity per setting/axis · selected ex post, not an axis-wide claim.':level==='L1'?'Nominal return and retained-return distributions. Return-threshold learning is not physical success.':level==='L2'?'One fixed cap across every measured shifted level of one axis.':'One fixed cap across the saved suite. A local gain need not carry over.';
 $('evidence-count').textContent=`${rows.length} matching comparisons · ${rows.filter(r=>r.favorable).length} joint mean / reliability gains`;
 const u=new URL(location.href);u.search=new URLSearchParams({level,...study!=='all'?{study}:{},...env!=='all'?{environment:env}:{},...status!=='all'?{result:status}:{},...condition?{conditions:'1'}:{},...search?{search}:{}});history.replaceState(null,'',u.pathname+u.search+'#robustness');
 $('evidence-table').innerHTML=`<table><thead><tr><th>Environment / cohort / setting</th><th>Scope</th><th>Comparator</th><th>Δ mean return</th><th>Δ reliability AUC</th><th>Policies</th><th>Measured result</th><th>Inspect</th></tr></thead><tbody>${rows.slice(0,limit).map(r=>`<tr><td><strong>${esc(r.environment+' / '+r.algorithm+'-'+r.family+' / '+label(r.model))}</strong><small>${esc(r.branch)}</small></td><td>${esc(r.axisTitle||r.scope)}${r.value!==null?' = '+r.value:''}${r.paperLabel?'<small>Paper example</small>':''}</td><td>${esc(label(r.reference))}${!r.referenceIsStandard?'<small>Not ordinary standard</small>':''}</td><td class="${r.deltaMean>0?'delta-positive':r.deltaMean<0?'delta-negative':''}">${number(r.deltaMean)}</td><td class="${r.deltaAuc>0?'delta-positive':r.deltaAuc<0?'delta-negative':''}">${number(r.deltaAuc)}</td><td>${r.minN} / ${r.intended}<small>Reference: ${r.referenceMinN}</small></td><td><span class="evidence-status ${r.favorable?'gain':''}" title="${esc(r.warning||'Descriptive comparison; no inferential certificate')}">${esc(r.status)}</span></td><td><a href="${destination(r)}">Metrics ↗</a><a href="${destination(r,'returns')}">Curves ↗</a></td></tr>`).join('')||'<tr><td colspan="8">No comparisons match these filters.</td></tr>'}</tbody></table>`;
 $('evidence-more').hidden=rows.length<=limit;$('evidence-download').onclick=()=>exportRows(rows);
}
window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
window.addEventListener('results-context',e=>{if(e.detail.page==='robustness'&&root.dataset.active!=='1')route();else if(e.detail.page!=='robustness'&&root.dataset.active==='1'){root.dataset.active='0';root.hidden=true;++ticket;}});route();
