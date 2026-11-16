import {escape as esc,fmt} from './model.mjs';
export const suppliedProfileId=id=>({json:'yiting_doublependulum_original','json 2':'yiting_pendulum_original',json6:'yiting_pendulum_additional',json7:'yiting_doublependulum_additional'}[id]);
export const suppliedLabel=model=>model==='non-robust'?'Standard':model.replace('-',' ');
export const originalSet=id=>['json','json 2'].includes(id);

export async function showSupplied(root,entry,requested,saved,{load,chart,alive}){
 const sets=entry.resultSets||[entry],chosen=sets.find(s=>s.dataset===requested)||sets[0];
 const report=new URL(chosen.report,location.href),source=report.pathname.includes('pendulum-additions')?'reports/pendulum-additions':'reports/return-reliability';
 const payload=await load(source+'/outputs/metrics.json');if(!alive())return;
 const c=payload.cohorts.find(c=>c.id===chosen.dataset);if(!c)throw Error('Evaluation set unavailable');
 const incoming=new URLSearchParams(saved||''),q=new URLSearchParams(location.search);
 const candidate=incoming.get('setting')||q.get('parameter')||q.get('setting');
 let model=c.models.includes(candidate)?candidate:c.models[1],axis=c.axes.find(a=>a.id===(incoming.get('axis')||q.get('shift')))||c.axes[0];
 let point=incoming.has('value')?axis.levels.reduce((best,x,i)=>Math.abs(x-Number(incoming.get('value')))<Math.abs(axis.levels[best]-Number(incoming.get('value')))?i:best,0):axis.nominal_index??0;
 const original=originalSet(c.id),$=id=>root.querySelector('#'+id),n=x=>fmt(x,Math.abs(x)<1?3:1);
 root.innerHTML=`<header class="env-title"><div><h2>${esc(entry.name)}</h2><p>TV and KL settings · base algorithm unreported</p></div></header>
 <div class="env-cohort-control"><label>Evaluation set<select id="sup-set">${sets.map(s=>`<option value="${esc(s.dataset)}">${originalSet(s.dataset)?'Original':'Additional'} · ${s.axisCount} perturbations</option>`).join('')}</select></label><span>${original?'30 independent policies per setting':'Additional evaluations of earlier policies · no extra training seeds'}</span></div>
 <p class="env-data-note">${original?'Policy identities within each setting are confirmed. Methods are compared as independent groups.':'Descriptive results only: the added files’ cross-axis policy mapping is not confirmed. Original scope claims are not transferred.'}</p>
 <div class="env-comparison-controls"><label>Setting<select id="sup-setting">${c.models.map(m=>`<option value="${esc(m)}">${esc(suppliedLabel(m))}</option>`).join('')}</select></label><label>Perturbation<select id="sup-axis">${c.axes.map(a=>`<option value="${a.id}">${esc(a.title)}</option>`).join('')}</select></label></div>
 <div class="env-severity-controls"><label>Measured value<select id="sup-value"></select></label><label class="env-severity-slider"><span id="sup-axis-name"></span><input id="sup-slider" type="range" min="0" step="1" aria-label="Measured perturbation level"><output id="sup-value-label"></output></label><button id="sup-nominal" type="button" class="text-button">Nominal ↺</button></div>
 <p id="sup-background" class="env-evidence-note"></p><div class="env-plots"><section><h3>Return curve</h3><div id="sup-curve"></div><div id="sup-legend" class="env-legend"></div></section><section><h3>Return reliability</h3><div id="sup-reliability"></div><p id="sup-readout" class="env-evidence-note"></p></section></div>
 <p class="env-analysis-links"><a id="sup-profile">Robustness profile ↗</a><a id="sup-full">Detailed report ↗</a></p>
 <section class="env-method-summary"><h3>Settings across this evaluation set</h3><p id="sup-best" class="env-evidence-note"></p><div class="table-scroll" id="sup-settings-table"></div></section>
 <p class="env-evidence-note">No rollout videos were supplied for this evaluation set.</p>
 <details class="env-provenance"><summary>Data, definitions & downloads</summary><p>These sets remain separate; policy rows are never concatenated. Algorithm, parameter units, physical-success and activation evidence remain unreported.${c.auc_is_normalized_mean?' Reliability AUC equals mean return divided by '+n(c.reference)+' in this bounded set; it is not independent evidence of improvement.':''}</p><p>R₀ = ${n(c.reference)}, from the saved standard nominal median. Compound level zero already contains a physical shift. Exact source IDs and unresolved intervention factors remain in the detailed report.</p><a href="${source}/outputs/setting_summary.csv" download>Settings CSV ↓</a> · <a href="${source}/outputs/metrics.json" download>Source summary JSON ↓</a></details>`;
 $('sup-set').value=chosen.dataset;$('sup-setting').value=model;$('sup-axis').value=axis.id;
 $('sup-set').onchange=()=>{root.dispatchEvent(new CustomEvent('supplied-set-change',{bubbles:true,detail:{dataset:$('sup-set').value}}));};
 $('sup-setting').onchange=()=>{model=$('sup-setting').value;render();};
 $('sup-axis').onchange=()=>{axis=c.axes.find(a=>a.id===$('sup-axis').value);point=axis.nominal_index??0;render();};
 $('sup-value').onchange=()=>{point=Number($('sup-value').value);render();};$('sup-slider').oninput=()=>{point=Number($('sup-slider').value);render();};
 $('sup-nominal').onclick=()=>{point=axis.nominal_index;render();};
 function render(){if(!alive())return;const state=new URLSearchParams({dataset:c.id,view:'returns',setting:model,axis:axis.id,value:axis.levels[point]});
  const u=new URL(location.href);u.search=new URLSearchParams({environment:entry.id,batch:c.id,reportState:state.toString()});u.hash='environments';history.replaceState(null,'',u);
  $('sup-value').innerHTML=axis.levels.map((x,i)=>`<option value="${i}">${n(x)}${i===axis.nominal_index?' · nominal':''}</option>`).join('');$('sup-value').value=point;
  $('sup-slider').max=axis.levels.length-1;$('sup-slider').value=point;$('sup-axis-name').textContent=axis.unit;$('sup-value-label').textContent=n(axis.levels[point]);$('sup-nominal').hidden=axis.nominal_index===null;
  $('sup-background').textContent=axis.background||'One measured physical or signal perturbation.';
  const series=[c.baseline,model].filter((m,i,all)=>all.indexOf(m)===i).map(m=>({name:suppliedLabel(m),points:axis.levels.map((x,i)=>({x,y:axis.settings[m].levels.mean[i],sd:axis.settings[m].levels.sd[i]}))}));
  $('sup-curve').innerHTML=chart(series,axis.unit,'Mean return',{bands:true,nominal:axis.nominal_index===null?null:axis.levels[axis.nominal_index],current:axis.levels[point]});
  $('sup-legend').textContent=series.map(s=>s.name).join(' / ')+' · sample SD, not confidence intervals';
  const survival=[c.baseline,model].filter((m,i,all)=>all.indexOf(m)===i).map(m=>{const z=axis.settings[m].values.map(row=>row[point]/c.reference),xs=[...new Set([0,1,...z.filter(v=>v>=0&&v<=1)])].sort((a,b)=>a-b),points=[];
   for(const x of xs){points.push({x,y:z.filter(v=>v>=x).length/z.length});if(x<1)points.push({x,y:z.filter(v=>v>x).length/z.length});}return {name:suppliedLabel(m),points};});
  $('sup-reliability').innerHTML=chart(survival,'Retained-return threshold','Fraction meeting threshold',{unit:true});
  const selected=axis.settings[model].levels,reference=axis.settings[c.baseline].levels;
  $('sup-readout').textContent=`At ${n(axis.levels[point])}: mean ${n(selected.mean[point])} vs ${n(reference.mean[point])}; reliability AUC ${n(selected.auc[point])} vs ${n(reference.auc[point])}. Return thresholds are not physical task success.`;
  const profile=new URL(location.href);profile.search=new URLSearchParams({view:'profiles',study:suppliedProfileId(c.id),setting:model===c.baseline?c.models[1]:model,reference:c.baseline});profile.hash='robustness';$('sup-profile').href=profile.pathname+profile.search+profile.hash;
  const full=new URL(report);full.searchParams.delete('embed');for(const [key,value] of state)full.searchParams.set(key,value);$('sup-full').href=full.pathname+full.search;
  const rows=[...c.summary].sort((a,b)=>b.mean-a.mean),standard=rows.find(r=>r.model===c.baseline);
  $('sup-best').textContent=`Highest measured suite mean: ${suppliedLabel(rows[0].model)} (${n(rows[0].mean)}); standard ${n(standard.mean)}. Fixed setting, equal weight per axis. Descriptive and selected after seeing results; not a statistical winner.`;
  $('sup-settings-table').innerHTML=`<table><thead><tr><th>Setting</th><th>Suite mean</th><th>Change vs standard</th></tr></thead><tbody>${rows.map(r=>`<tr${r.model===model?' class="profile-selected"':''}><td><button type="button" class="text-button" data-sup-model="${esc(r.model)}">${esc(suppliedLabel(r.model))}</button></td><td>${n(r.mean)}</td><td>${n(r.mean-standard.mean)}</td></tr>`).join('')}</tbody></table>`;
  root.querySelectorAll('[data-sup-model]').forEach(b=>b.onclick=()=>{model=b.dataset.supModel;$('sup-setting').value=model;render();});
 }
 render();
}
