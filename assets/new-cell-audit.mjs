import {escape as esc,label,fmt} from './model.mjs?v=20261107-cells1';
const num=x=>Number.isFinite(x)?fmt(x,Math.abs(x)<1?3:2):'N/A';
const ci=x=>x?`${num(x[0])} [${num(x[1])}, ${num(x[2])}]`:'N/A';
export function auditLink(cell,model,view='advanced',extra={}){
  return '?'+new URLSearchParams({study:cell.study,setting:model,reference:'vanilla',axis:cell.shownAxis||'action_noise',scope:'suite',...extra})+'#'+view;
}
export const klOffContrast=(cell,setting)=>cell.settings.kl_bypass?{
  reliability:setting.suite_d_rel[0]-cell.settings.kl_bypass.suite_d_rel[0],
  returns:setting.suite_d_ret[0]-cell.settings.kl_bypass.suite_d_ret[0]
}:null;
const notes={
  drawer_sac_tv30:'Caps 20 and 24 meet the supplied L2/L3 tests against same-batch standard. Caps 10–16 substantially reduce nominal success; cap 32 has no established gain.',
  drawer_ppo_tv30:'No shift repair in the supplied audit. Tight caps hurt nominal outcomes; looser caps do not establish a gain.',
  drawer_td3_tv30:'No shift repair. Cap 12 has a positive reliability interval, but fails the suite return guardrail.',
  pickcube_td3_kl30:'β3/10/30 and KL off all meet the supplied L3 tests against October 28 standard. No KL-specific gain is established. Alternative-learner and batch differences may explain the standard contrast. β0.3 has only 0.2% nominal success.',
  pickcube_sac_kl30:'No shift repair or suite gain. β1 has an adverse reliability effect; the remaining settings are close to standard.',
  pusher_td3_kl_delta30:'Same-cluster standard. No suite pass. The supplied audit reports 3 KL-off repairs, but both friction directions have flat per-policy returns and unverified perturbation effectiveness; do not interpret them as verified repairs. β300 reports 1 repair. β3/10 severely reduce nominal success. Reliability here is recorded success_once, not a normalized negative return.'
};
export async function showNewCellAudit(root,active=()=>true){
  const r=await fetch('data/new-cells/audit.json?v=20261107-cells1');if(!r.ok)throw Error('November 7 audit unavailable');
  const audit=await r.json();if(!active())return;
  const q=new URLSearchParams(location.search),selected=q.get('study');
  root.innerHTML=`<div class="library-heading"><h1>November 7 results</h1><a href="data/new-cells/settings.csv" download>All settings CSV ↓</a></div>
    <nav class="new-cell-audit-nav" aria-label="Audit profile"><a href="?view=settings#robustness">Existing all-setting audit</a><span>November 7 supplied audit</span></nav>
    <p class="evidence-caution">Exploratory results selected per cell, not independent confirmation. Supplied pointwise 95% intervals use 10,000 paired seed-index resamples and one fixed study nominal median. Pairing design is unconfirmed. These numbers do not replace the existing independent/per-axis audit or certify cumulative L1/L2/L3.</p>
    <div class="evidence-filters"><label>Environment / method<select id="new-cell-filter"><option value="all">All six cells</option>${audit.cells.map(c=>`<option value="${esc(c.study)}">${esc(c.cell)}</option>`).join('')}</select></label></div>
    <div id="new-cell-results"></div>
    <details class="setting-definitions"><summary>Methods & interpretation</summary><p>${esc(audit.profile)}</p><p>L2 counts are the supplied split-axis repairs with whole-axis return guardrails. Reported L3 tests require a positive suite reliability interval and a suite return lower bound above the shown margin. The supplied script does not separately encode qualitative L1 or enforce the cumulative hierarchy. No new pass is assigned here.</p><p>KL-off differences below are point estimates obtained by subtracting two contrasts against the same standard. No KL-versus-KL-off confidence interval was supplied; lack of established gain is not equivalence or a causal learner attribution. Standard and KL-off remain separately selectable on the curves and advanced metrics.</p><p>Return bands elsewhere are across-policy sample SD, not these bootstrap intervals. Native-return survival and recorded task success are distinct measures. Only complete 30-policy cohorts are exported; missing settings and failed slots are not filled or treated as successes. No new videos have been substituted.</p><a href="data/new-cells/audit.json" download>Full audit and shift evidence</a></details>`;
  const filter=root.querySelector('#new-cell-filter');filter.value=audit.cells.some(c=>c.study===selected)?selected:'all';
  function render(){
    const order=['drawer_sac_tv30','pickcube_td3_kl30','drawer_ppo_tv30','drawer_td3_tv30','pickcube_sac_kl30','pusher_td3_kl_delta30'];
    const cells=audit.cells.filter(c=>filter.value==='all'||c.study===filter.value).sort((a,b)=>order.indexOf(a.study)-order.indexOf(b.study));
    root.querySelector('#new-cell-results').innerHTML=cells.map(c=>`<section class="new-cell-section" data-new-cell="${esc(c.study)}"><h2>${esc(c.cell)}</h2><p>${esc(notes[c.study])}</p><p class="small">30 training policies per setting · ${esc(c.reliability==='success rate'?'Recorded success_once fraction':'Clipped retained-return reliability; fixed R₀ = '+num(c.R0))}. Nominal success: standard ${num(100*c.standard.nominal_success)}%.</p>
      ${c.incompleteSettings?.length?`<p class="evidence-caution">Incomplete settings, excluded from averages: ${c.incompleteSettings.map(s=>`${esc(label(s.setting))}: ${s.completed}/${s.intended} completed, ${s.failed} failed`).join('; ')}. Failed returns remain NULL; no retries or replacements.</p>`:''}
      <div class="table-scroll" tabindex="0" aria-label="${esc(c.cell)} results"><table><thead><tr><th>Setting</th><th>Nominal success</th><th>L2 repairs</th><th>Suite Δ reliability [95%]</th><th>Suite Δ return [95%]</th><th>Reported suite test</th><th>Inspect</th></tr></thead><tbody>${Object.entries(c.settings).map(([m,s])=>{
        const off=klOffContrast(c,s),axis=s.shifts[0].shift.split('/')[0];
        return `<tr data-new-setting="${esc(m)}"><th scope="row">${esc(label(m))}${m==='kl_bypass'?'<small>Control, not KL enabled</small>':''}</th><td>${num(100*s.nominal_success)}%<small>Return ${num(s.nominal_return)}</small></td><td>${s.L2_pass.length} / ${s.n_shifts}${c.unverifiedAxes?.length?'<small>Reported count; flagged axes are not verified repairs.</small>':''}<details><summary>Shift evidence</summary><ul>${s.shifts.map(t=>`<li><a href="${esc(auditLink(c,m,'returns',{axis:t.shift.split('/')[0]}))}">${esc(t.shift)}</a>: ${c.unverifiedAxes?.includes(t.shift.split('/')[0])?'effect unverified':t.L2?'repair':'not established'}<br>Δ reliability ${ci(t.d_rel)}<br>Δ whole-axis return ${ci(t.d_axis_ret)}; margin ${num(t.margin)}</li>`).join('')}</ul></details></td><td>${ci(s.suite_d_rel)}${off&&m!=='kl_bypass'?`<small>vs KL off: ${num(off.reliability)} · point estimate only</small>`:''}</td><td>${ci(s.suite_d_ret)}<small>Margin ${num(s.suite_margin)}</small>${off&&m!=='kl_bypass'?`<small>vs KL off: ${num(off.returns)} · point estimate only</small>`:''}</td><td>${s.L3?'<strong>Reported L3 · exploratory</strong>':'Not established'}<small>Comparator: standard</small></td><td><a href="${esc(auditLink(c,m,'returns',{axis}))}">Curves</a><a href="${esc(auditLink(c,m,'advanced',{axis,metric:c.reliability==='success rate'?'outcomes':'aggregate'}))}">Metrics</a><a href="?cohort=${esc(c.study)}&parameter=${esc(m)}#environments">Environment</a></td></tr>`;
      }).join('')}</tbody></table></div></section>`).join('');
    const u=new URL(location.href);u.search=new URLSearchParams({view:'new-cells',...filter.value!=='all'?{study:filter.value}:{}});history.replaceState(null,'',u);
  }
  filter.onchange=render;render();
}
