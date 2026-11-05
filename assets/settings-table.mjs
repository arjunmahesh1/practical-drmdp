import {escape as esc,label,fmt} from './model.mjs';
import {matchesSetting,settingsCSV} from './setting-hierarchy.mjs';
let inventory;
const levels=['L1','L2','L3'];
const titles={pass:'Pass',fail:'Not met',borderline:'Borderline',unassessed:'Not assessed',inconclusive:'Inconclusive'};
const number=x=>Number.isFinite(x)?fmt(x,3):'N/A';
function comparison(row,view='advanced',axis=null){
  if(row.dataset)return 'reports/return-reliability/index.html?'+new URLSearchParams({v:'20261105-hierarchy1',dataset:row.dataset,view:'comparison',mode:'fixed',setting:row.model});
  if(!row.study)return null;
  return '?'+new URLSearchParams({study:row.study,setting:row.model,reference:row.reference,scope:'axis',...row.archived?{archive:'1'}:{},...axis?{axis}:{}})+'#'+view;
}
function gateCell(row,level){
  if(row.role==='reference'||row.role==='control')return '<span class="setting-muted">—</span>';
  const g=row.gates[level],reported=g.basis==='manuscript report';
  const qualitative=g.basis==='qualitative nominal review';
  const n=row.nominal;
  return `<span class="setting-gate ${g.status}" title="${esc(g.note||g.basis)}">${qualitative&&g.status==='pass'?'Comparable':titles[g.status]}${reported?' · reported':qualitative?' · qualitative':''}</span>${level==='L1'&&n?`<small>Mean ${number(n.mean)} vs ${number(n.referenceMean)}<br>Low-return: ${n.failures===null?'N/A':n.failures+'/'+n.policies} vs ${n.referenceFailures===null?'N/A':n.referenceFailures+'/'+n.referencePolicies}</small>`:''}${level==='L2'&&g.tested?`<small>${g.passed} passed / ${g.tested} assessed<br>${g.declared} declared shifts</small>`:''}`;
}
function evidence(row){
  const tests=row.gates.L2.tests||[];
  return `<details class="setting-evidence"><summary>Evidence</summary><p><strong>${esc(row.environment)}</strong><br>${esc(row.branch)}</p>${levels.map(l=>`<p><strong>${l}: ${esc(titles[row.gates[l].status])}</strong> · ${esc(row.gates[l].basis)}<br>${esc(row.gates[l].note||'')}</p>`).join('')}${tests.length?`<details><summary>${tests.length} saved shift tests</summary><ul>${tests.map(t=>`<li><strong>${esc(t.axis)} / ${esc(t.side)}</strong>: ${t.eligible?(t.L2?'both elements pass':'both elements not established'):'ineligible'}<br>Δ reliability AUC ${number(t.d_auc[0])} [${number(t.d_auc[1])}, ${number(t.d_auc[2])}]<br>Δ whole-axis mean ${number(t.d_axis_ret[0])} [${number(t.d_axis_ret[1])}, ${number(t.d_axis_ret[2])}]; margin ${number(t.margin)}<br>${t.n} policies; ${t.levels} shifted levels · <a href="${esc(comparison(row,'returns',t.axis))}">Axis curves</a></li>`).join('')}</ul></details>`:''}</details>`;
}
export async function showSettings(root,openView,active=()=>true){
  if(!inventory){const r=await fetch('data/hierarchy/settings.json?v=20261105-hierarchy1');if(!r.ok)throw Error('Setting inventory unavailable');inventory=await r.json();}
  if(!active())return;
  const q=new URLSearchParams(location.search),$=id=>root.querySelector('#'+id);
  const rows=inventory.rows;
  root.innerHTML=`<div class="library-heading"><h1>Results by setting</h1><a href="data/hierarchy/settings.csv" download>Complete CSV ↓</a></div>
    <div class="metric-tabs" role="tablist" aria-label="Hierarchy views"><button role="tab" data-overview aria-selected="true">All settings</button><button role="tab" data-level="L1" aria-selected="false">Nominal summaries</button><button role="tab" data-level="L2" aria-selected="false">Whole-axis summaries</button><button role="tab" data-level="L3" aria-selected="false">Suite summaries</button></div>
    <p class="evidence-caution">Levels are cumulative. L1 is qualitative, with borderline cases separate. L2 uses saved one-sided repair tests and whole-axis return guardrails; L3 uses one fixed setting across the suite. Untested is not failed.</p>
    <div class="evidence-filters setting-filters"><label>Environment<select id="settings-env"><option value="all">All environments / versions</option>${[...new Set(rows.map(r=>r.environment))].sort().map(e=>`<option>${esc(e)}</option>`).join('')}</select></label><label>Algorithm<select id="settings-algorithm"><option value="all">All algorithms</option>${[...new Set(rows.map(r=>r.algorithm))].sort().map(e=>`<option>${esc(e)}</option>`).join('')}</select></label><label>Result<select id="settings-result">${[['all','All results'],['L3','L3'],['L2','L2 / at least L2'],['L1','L1 / at least L1'],['none','None (L1 failed)'],['borderline','Borderline L1'],['unassessed','Not assessed'],['reference','References'],['control','Controls']].map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label><label>Find a cap or cohort<input id="settings-search" type="search" placeholder="Cap 400, β, joint-delta..."></label></div>
    <div class="setting-options"><label><input id="settings-archive" type="checkbox"> Include archived custom TD3-KL</label><span id="settings-study-filter" hidden></span></div>
    <div class="evidence-toolbar"><span id="settings-count"></span><button id="settings-download" class="text-button">Filtered CSV ↓</button></div>
    <div id="evidence-table" class="table-scroll setting-table" tabindex="0" aria-label="Environment, method, setting and cumulative robustness result"></div>
    <details class="setting-definitions"><summary>Definitions & evidence coverage</summary><dl>${levels.map(l=>`<dt><strong>${l}</strong></dt><dd>${esc(inventory.definitions[l])}</dd>`).join('')}</dl><p>${esc(inventory.criteria)}</p><ul>${inventory.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>${esc(inventory.definitionSource)}</p><a href="data/hierarchy/settings.json" download>Evidence data ↓</a></details>`;
  for(const b of root.querySelectorAll('[data-level]'))b.onclick=()=>openView(b.dataset.level);
  const ids={environment:'settings-env',algorithm:'settings-algorithm',result:'settings-result'};
  for(const [key,id] of Object.entries(ids)){const value=q.get(key);if([...$(id).options].some(o=>o.value===value))$(id).value=value;}
  $('settings-search').value=q.get('search')||'';$('settings-archive').checked=q.get('archive')==='1';
  const study=q.get('study');
  if(study){$('settings-study-filter').hidden=false;$('settings-study-filter').innerHTML=`Cohort: <code>${esc(study)}</code> <button id="settings-clear-study" class="text-button">All cohorts</button>`;$('settings-clear-study').onclick=()=>{const u=new URL(location.href);u.searchParams.delete('study');history.replaceState(null,'',u);$('settings-study-filter').hidden=true;render();};}
  function render(){
    const filter={environment:$('settings-env').value,algorithm:$('settings-algorithm').value,result:$('settings-result').value,search:$('settings-search').value,archive:$('settings-archive').checked};
    const currentStudy=new URLSearchParams(location.search).get('study');
    const visible=rows.filter(r=>matchesSetting(r,filter)&&(!currentStudy||r.study===currentStudy));
    const settings=visible.filter(r=>r.model),coverage=visible.filter(r=>!r.model);
    $('settings-count').textContent=`${settings.length} settings · ${new Set(settings.map(r=>r.environment)).size} environments${coverage.length?' · '+coverage.length+' environments without setting exports':''}`;
    $('evidence-table').innerHTML=`<table><thead><tr><th>Environment / method</th><th>Setting</th><th>Comparator</th><th>L1 · nominal</th><th>L2 · shift repair</th><th>L3 · full suite</th><th>Cumulative result</th><th>Inspect</th></tr></thead><tbody>${visible.map(r=>`<tr data-setting-row="${esc(r.id)}" data-result="${r.result.code}"><th scope="row"><strong>${esc(r.environment)}</strong><small>${esc(r.algorithm+' '+r.family)}</small><small>${esc(r.branch)}</small>${r.archived?'<small>Archived</small>':''}</th><td>${esc(r.settingLabel)}</td><td>${esc(r.referenceLabel)}</td>${levels.map(l=>`<td>${gateCell(r,l)}</td>`).join('')}<td><strong class="setting-result ${r.result.code}">${esc(r.result.label)}</strong></td><td>${r.model?`<a href="${esc(comparison(r,'returns'))}">Curves ↗</a><a href="${esc(comparison(r))}">Metrics ↗</a>`:''}${evidence(r)}</td></tr>`).join('')||'<tr><td colspan="8">No settings match these filters.</td></tr>'}</tbody></table>`;
    const u=new URL(location.href);u.search=new URLSearchParams({view:'settings',...currentStudy?{study:currentStudy}:{},...Object.fromEntries(Object.entries(filter).filter(([k,v])=>k!=='archive'&&v&&v!=='all')),...filter.archive?{archive:'1'}:{}});u.hash='robustness';history.replaceState(null,'',u);
    $('settings-download').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([settingsCSV(visible)],{type:'text/csv'}));a.href=url;a.download='robustness-by-setting.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  }
  for(const id of ['settings-env','settings-algorithm','settings-result','settings-archive'])$(id).onchange=render;
  $('settings-search').oninput=render;render();
}
