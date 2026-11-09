import {escape as esc,label,fmt} from './model.mjs?v=20261107-cells1';
import {auditLink,klOffContrast} from './new-cell-audit.mjs';
const num=x=>Number.isFinite(x)?fmt(x,Math.abs(x)<1?3:2):'N/A';
const ci=x=>x?`${num(x[0])} [${num(x[1])}, ${num(x[2])}]`:'N/A';
const methodName=m=>m==='paired'?'Paired':'Independent';
export function auditView(cell,model,sensitivity){
  const saved=cell.settings[model],entry=sensitivity.cells.find(c=>c.study===cell.study);
  if(!entry?.settings[model])throw Error('Missing pairing sensitivity: '+cell.study+'/'+model);
  const test=entry.settings[model],method=entry.primary;
  return {...saved,method,design:entry.design,reason:entry.reason,sensitivity:test,
    suite_d_rel:test.suite[method].d_rel,suite_d_ret:test.suite[method].d_ret,
    L3:test.suite[method].passes,L2_pass:test.shifts.filter(s=>s[method].passes).map(s=>s.shift),
    eligibleRepairs:test.primaryEligibleRepairs,
    shifts:test.shifts.map(t=>({...t,d_rel:t[method].d_rel,d_axis_ret:t[method].d_ret,L2:t[method].passes}))};
}
const notes={
  drawer_sac_tv30:'Caps 20 and 24 meet the paired suite tests and also pass the independent sensitivity check. Cap 24 has one method-sensitive local repair. Caps 10–16 substantially reduce nominal success; cap 32 has no established suite gain.',
  drawer_ppo_tv30:'No qualifying shift repair or suite gain. Tight caps hurt nominal outcomes; looser caps do not establish a gain.',
  drawer_td3_tv30:'No qualifying shift repair. Cap 12 has a positive reliability interval, but fails the suite return guardrail.',
  pickcube_td3_kl30:'β3/10/30 and KL off meet the suite tests against October 28 standard under independent resampling. No KL-specific gain is established. Alternative-learner and batch differences may explain this contrast. β0.3 has only 0.2% nominal success.',
  pickcube_sac_kl30:'No suite gain. β10 has one local repair under the design-correct independent test, absent under seed-index pairing. β1 has an adverse reliability effect. A local test pass is not an overall KL-effect claim.',
  pusher_td3_kl_delta30:'Same-cluster matched design. No suite pass. β300 has one paired local repair and a second under independent resampling. KL off has one eligible paired repair; its two reported friction repairs have unverified perturbation effectiveness. Reliability here is recorded success_once, not normalized negative return.'
};
function sensitivityDetails(test,primary){
  return `<details class="pairing-details"><summary>Paired / independent intervals${test.changes.length?' · flags differ':''}</summary>${['paired','independent'].map(m=>`<p><strong>${methodName(m)}${m===primary?' · primary':''}</strong>: ${test[m].passes?'component test passes':'component test not established'}<br>Δ reliability ${ci(test[m].d_rel)}<br>Δ return ${ci(test[m].d_ret)}<br>Reliability: ${test[m].repair?'positive':'not established'}; return guardrail: ${test[m].no_harm?'passes':'not established'}</p>`).join('')}<p>Changed flags: ${esc(test.changes.join(', ')||'none')}.</p></details>`;
}
export async function showNewCellAudit(root,active=()=>true){
  const r=await fetch('data/new-cells/audit.json?v=20261107-cells1');if(!r.ok)throw Error('Original audit unavailable');
  const audit=await r.json();
  const sr=await fetch('data/new-cells/sensitivity.json?v=20261108-pairing1');if(!sr.ok)throw Error('Pairing sensitivity unavailable');
  const sensitivity=await sr.json();if(!active())return;
  const q=new URLSearchParams(location.search),selected=q.get('study');
  root.innerHTML=`<div class="library-heading"><h1>Results & pairing sensitivity</h1><a href="data/new-cells/sensitivity.csv" download>Both methods CSV ↓</a></div>
    <nav class="new-cell-audit-nav" aria-label="Audit profile"><a href="?view=settings#robustness">Older all-setting audit</a><span>Six new cells · pairing clarified November 8</span></nav>
    <p class="evidence-caution">Matched by design within the same study, code and cluster, as confirmed by the human. PickCube KL versus October 28 standard is cross-batch and uses independent resampling. All intervals are pointwise 95% percentile bootstrap intervals from 10,000 whole-policy resamples. Normalization and shift rules remain fixed. These exploratory component tests do not certify cumulative L1/L2/L3 or establish equivalence.</p>
    <p class="evidence-caution" id="pairing-summary">${sensitivity.summary.comparisons} comparisons: ${sensitivity.summary.pairedPrimary} paired primary, ${sensitivity.summary.independentPrimary} independent primary. ${sensitivity.summary.changedSuiteVerdicts} suite pass/fail changes between methods. ${sensitivity.summary.changedEligibleShiftVerdicts} eligible local pass/fail changes; 2 additional changes concern unverified friction axes.</p>
    <div class="evidence-filters"><label>Environment / method<select id="new-cell-filter"><option value="all">All six cells</option>${audit.cells.map(c=>`<option value="${esc(c.study)}">${esc(c.cell)}</option>`).join('')}</select></label></div>
    <div id="pairing-changes"></div><div id="new-cell-results"></div>
    <details class="setting-definitions"><summary>Design exceptions & methods</summary><p>${esc(sensitivity.scope)}</p><p>Paired tests resample corresponding policies together. Independent tests resample the two cohorts separately. Each policy retains all its axes and severities. Shared seed labels alone do not establish pairing. Cross-batch paired intervals are retained only as historical sensitivity values, not as a valid design alternative.</p><ul>${sensitivity.exceptions.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><p>L2 repair uses one side of an axis with a whole-axis return guardrail. The suite test uses equal-axis weights. R₀ stays the original fixed study nominal median, not an axis-specific redefinition. Qualitative L1 and cumulative hierarchy gates are unchanged.</p><p>The human confirms the design; this is not a new check of initial weights or RNG traces. Older published audits retain their actual resampling method. The earlier PPO Walker correlation claim is not assumed for these cells.</p><p>KL-off differences remain point estimates on the same standard normalization, without a KL-versus-KL-off confidence interval. Missing settings and failed slots are not averaged. Return bands remain sample SD, not confidence intervals. New videos have not been substituted.</p><a href="data/new-cells/sensitivity.json" download>Sensitivity data</a> · <a href="data/new-cells/audit.json" download>Original November 7 import</a> · <a href="${esc(sensitivity.methodReference)}" target="_blank" rel="noopener">Resampling convention</a></details>`;
  const filter=root.querySelector('#new-cell-filter');filter.value=audit.cells.some(c=>c.study===selected)?selected:'all';
  function render(){
    const order=['drawer_sac_tv30','pickcube_td3_kl30','drawer_ppo_tv30','drawer_td3_tv30','pickcube_sac_kl30','pusher_td3_kl_delta30'];
    const cells=audit.cells.filter(c=>filter.value==='all'||c.study===filter.value).sort((a,b)=>order.indexOf(a.study)-order.indexOf(b.study));
    const changed=sensitivity.changes.filter(c=>cells.some(s=>s.study===c.study)&&c.components.includes('passes'));
    root.querySelector('#pairing-changes').innerHTML=`<details class="setting-definitions"><summary>${changed.length} local verdict differences</summary><ul>${changed.map(c=>`<li><strong>${esc(c.study+' / '+label(c.model)+' / '+c.scope)}</strong>: paired ${c.paired?'passes':'not established'}, independent ${c.independent?'passes':'not established'}. ${c.eligible?'Eligible axis.':'Perturbation effect unverified; not an eligible repair.'}</li>`).join('')}</ul></details>`;
    root.querySelector('#new-cell-results').innerHTML=cells.map(c=>{
      const design=sensitivity.cells.find(s=>s.study===c.study);
      return `<section class="new-cell-section" data-new-cell="${esc(c.study)}"><h2>${esc(c.cell)}</h2><p>${esc(notes[c.study])}</p><p class="small"><strong>${methodName(design.primary)} primary</strong> · ${esc(design.reason)}<br>30 policies per setting · ${esc(c.reliability==='success rate'?'Recorded success_once fraction':'Clipped retained-return reliability; fixed R₀ = '+num(c.R0))}. Standard nominal success ${num(100*c.standard.nominal_success)}%.</p>
      ${c.incompleteSettings?.length?`<p class="evidence-caution">Incomplete settings, excluded from averages: ${c.incompleteSettings.map(s=>`${esc(label(s.setting))}: ${s.completed}/${s.intended} completed, ${s.failed} failed`).join('; ')}. Failed returns remain NULL.</p>`:''}
      <div class="table-scroll" tabindex="0" aria-label="${esc(c.cell)} results"><table><thead><tr><th>Setting</th><th>Nominal success</th><th>Eligible L2 repairs</th><th>Suite Δ reliability [95%]</th><th>Suite Δ return [95%]</th><th>Suite component test</th><th>Inspect</th></tr></thead><tbody>${Object.keys(c.settings).map(m=>{
        const s=auditView(c,m,sensitivity),off=klOffContrast(c,s),axis=s.shifts[0].shift.split('/')[0],t=s.sensitivity;
        const changed=t.shifts.some(v=>v.changes.length)||t.suite.changes.length;
        return `<tr data-new-setting="${esc(m)}" data-pairing="${s.method}"><th scope="row">${esc(label(m))}${m==='kl_bypass'?'<small>Control, not KL enabled</small>':''}${changed?'<small class="pairing-sensitive">Method-sensitive flags</small>':''}</th><td>${num(100*s.nominal_success)}%<small>Return ${num(s.nominal_return)}</small></td><td>${s.eligibleRepairs.length} / ${s.n_shifts}${c.unverifiedAxes?.length?`<small>${s.L2_pass.length} statistical passes before excluding unverified axes.</small>`:''}${t.changedShiftVerdicts.length?`<small class="pairing-sensitive">${t.changedShiftVerdicts.length} local verdict change${t.changedShiftVerdicts.length===1?'':'s'}</small>`:''}<details><summary>Shift evidence</summary><ul>${s.shifts.map(v=>`<li><a href="${esc(auditLink(c,m,'returns',{axis:v.shift.split('/')[0]}))}">${esc(v.shift)}</a>: ${!v.eligible?'effect unverified':v.L2?'repair':'not established'}${v.changes.length?' · method-sensitive flags':''}<br>Δ reliability ${ci(v.d_rel)}<br>Δ whole-axis return ${ci(v.d_axis_ret)}; margin ${num(v.margin)}${sensitivityDetails(v,s.method)}</li>`).join('')}</ul></details></td><td>${ci(s.suite_d_rel)}${off&&m!=='kl_bypass'?`<small>vs KL off: ${num(off.reliability)} · point estimate only</small>`:''}</td><td>${ci(s.suite_d_ret)}<small>Margin ${num(s.suite_margin)}</small>${off&&m!=='kl_bypass'?`<small>vs KL off: ${num(off.returns)} · point estimate only</small>`:''}</td><td>${s.L3?'<strong>Suite test passes · exploratory</strong>':'Not established'}<small>${methodName(s.method)} vs standard</small>${sensitivityDetails(t.suite,s.method)}</td><td><a href="${esc(auditLink(c,m,'returns',{axis}))}">Curves</a><a href="${esc(auditLink(c,m,'advanced',{axis,metric:c.reliability==='success rate'?'outcomes':'aggregate'}))}">Metrics</a><a href="?cohort=${esc(c.study)}&parameter=${esc(m)}#environments">Environment</a></td></tr>`;
      }).join('')}</tbody></table></div></section>`;
    }).join('');
    const u=new URL(location.href);u.search=new URLSearchParams({view:'new-cells',...filter.value!=='all'?{study:filter.value}:{}});history.replaceState(null,'',u);
  }
  filter.onchange=render;render();
}
