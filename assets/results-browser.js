import {label,escape as esc,fmt,bestModelOnAxis} from './model.mjs?v=20261104-library1';
import {summarize,severity,rawReliability} from './appendix-metrics.mjs';
import {normalizedSurvival,returnDistribution,capSummaries,bestFixedSetting,recordedOutcomes,reliabilityDisplay} from './browser-metrics.mjs?v=20261107-signed1';

const root=document.getElementById('analysis-page'),$=id=>document.getElementById(id),cache=new Map();
const palette=['#17806b','#9463a0','#ad7a20','#587bba','#b94d72','#677449','#7b4c31','#2287a0','#ab4d9c','#7074b2','#d66d24','#2f766e','#9c783c','#7d565f','#4b6986'];
const q=()=>new URLSearchParams(location.search);
const num=x=>x===null||!Number.isFinite(x)?'N/A':fmt(x,Math.abs(x)<1?3:1);
const pct=x=>x===null||!Number.isFinite(x)?'N/A':fmt(100*x,1)+'%';
const metrics=[['reliability','Reliability'],['distribution','Distributions'],['aggregate','Cap Comparison'],['severity','Shift Severity'],['outcomes','Task Outcomes']];
let context,study,request=0,latestKey='';
function setQuery(values){const u=new URL(location.href);for(const [k,v] of Object.entries(values)){if(v===null)u.searchParams.delete(k);else u.searchParams.set(k,v);}history.replaceState(null,'',u);}
function select(id,entries,value){$(id).innerHTML=entries.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');$(id).value=value;}
function choose(values){window.dispatchEvent(new CustomEvent('results-select',{detail:values}));}
function modelFor(axis){return context.selection==='best'?bestModelOnAxis(context.study,context.study.axes.find(a=>a.id===axis)):context.model;}
function modelsFor(axis){return [...new Set(context.allSettings?study.models:[context.reference,modelFor(axis)])];}
function color(model){return model===context.reference?'#003087':model===context.model?'#d94b24':palette[study.models.indexOf(model)%palette.length];}
function legend(models){return `<div class="analysis-legend">${models.map(m=>`<span style="--series:${color(m)}">${esc(label(m))}</span>`).join('')}</div>`;}
function csv(name,rows){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')],{type:'text/csv'}));a.href=url;a.download=name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function range(values,pad=true){const lo=Math.min(...values),hi=Math.max(...values),p=pad?(hi-lo||Math.abs(hi)||1)*.08:0;return [lo-p,hi+p];}

function chart(series,xlabel,ylabel,{xr=null,yr=[0,1],dots=false,threshold=null}={}){
  const nonempty=series.filter(s=>s.points.length);
  if(!nonempty.length)return '<div class="metric-unavailable">Unavailable for this scope or reference.</div>';
  if(!xr)xr=range(nonempty.flatMap(s=>s.points.map(p=>p[0])),false);
  const W=640,H=350,L=76,R=22,T=16,B=66;
  const x=v=>L+(v-xr[0])/(xr[1]-xr[0]||1)*(W-L-R),y=v=>H-B-(v-yr[0])/(yr[1]-yr[0]||1)*(H-B-T);
  let out=`<svg class="metric-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ylabel)} by ${esc(xlabel)}"><title>${esc(ylabel)} by ${esc(xlabel)}</title>`;
  for(let i=0;i<4;i++){const v=yr[0]+i/3*(yr[1]-yr[0]);out+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#e4e8ed"/><text x="${L-9}" y="${y(v)+5}" text-anchor="end">${fmt(v,Math.abs(yr[1]-yr[0])<3?2:0)}</text>`;}
  for(let i=0;i<4;i++){const v=xr[0]+i/3*(xr[1]-xr[0]);out+=`<text x="${x(v)}" y="${H-B+25}" text-anchor="middle">${fmt(v,Math.abs(xr[1]-xr[0])<3?2:0)}</text>`;}
  if(threshold!==null&&threshold>=xr[0]&&threshold<=xr[1])out+=`<line x1="${x(threshold)}" x2="${x(threshold)}" y1="${T}" y2="${H-B}" stroke="#6c7784" stroke-dasharray="4 4"/>`;
  for(const s of nonempty){
    if(dots)out+=s.points.map(p=>`<circle cx="${x(p[0])}" cy="${y(p[1])}" r="5" fill="${color(s.model)}" opacity=".8"><title>${esc(label(s.model))}${p[2]?' / '+esc(p[2]):''}: ${num(p[0])}, ${num(p[1])}</title></circle>`).join('');
    else out+=`<path d="${s.points.map((p,i)=>(i?'L':'M')+x(p[0])+','+y(p[1])).join(' ')}" stroke="${color(s.model)}" stroke-width="${[context.reference,context.model].includes(s.model)?2.8:1.6}" fill="none"><title>${esc(label(s.model))}</title></path>`;
  }
  return out+`<path d="M${L},${T}V${H-B}H${W-R}" stroke="#9ba5b1" fill="none"/><text x="${(L+W-R)/2}" y="${H-12}" text-anchor="middle">${esc(xlabel)}</text><text transform="translate(18 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle">${esc(ylabel)}</text></svg>`;
}

async function receive(e){
  context=e.detail;
  if(!['advanced','seeds'].includes(context.page)){latestKey='';++request;return;}
  const key=JSON.stringify([context.study.id,context.model,context.reference,context.selection,context.allSettings,context.axis,context.index,context.page,q().get('scope'),q().get('metric'),q().get('value')]);
  if(key===latestKey)return;latestKey=key;
  const ticket=++request;
  root.innerHTML='<p class="load-state" role="status">Loading policy summaries...</p>';
  try{
    if(!cache.has(context.study.id)){const r=await fetch('data/appendix/'+context.study.id+'.json');if(!r.ok)throw Error('Policy summaries unavailable.');cache.set(context.study.id,await r.json());}
    if(ticket!==request)return;study=cache.get(context.study.id);shell();
  }catch(error){if(ticket===request)root.innerHTML=`<p role="alert">${esc(error.message)}</p>`;}
}

function shell(){
  const params=q(),seeds=context.page==='seeds';
  let metric=params.get('metric')||'reliability';
  if(metric==='seeds')metric='distribution';
  if(!metrics.some(([m])=>m===metric)&&metric!=='raw')metric='reliability';
  root.innerHTML=`<div class="analysis-heading"><h1>${seeds?'Training seeds':'Advanced metrics'}</h1><a class="download-link" href="data/appendix/${study.id}.csv" download title="Download all policy summaries">Policy summaries ↓</a></div>
    ${seeds?'':`<div class="metric-tabs" role="tablist" aria-label="Advanced metric">${metrics.map(([m,l])=>`<button role="tab" data-metric="${m}" aria-selected="${String(m===(metric==='raw'?'reliability':metric))}">${l}</button>`).join('')}</div>`}
    <div class="analysis-toolbar"><label id="analysis-kind-label">Measure<select id="analysis-kind"><option value="reliability">Normalized reliability</option><option value="raw">Native-return survival</option></select></label><label id="analysis-scope-label">Scope<select id="analysis-scope"><option value="gallery">By perturbation</option><option value="suite">Full suite</option><option value="axis">Single axis</option><option value="condition">Single condition</option><option value="nominal">Nominal</option></select></label><label id="analysis-axis-label">Perturbation<select id="analysis-axis"></select></label><label id="analysis-value-label">Condition<select id="analysis-value"></select></label><label id="analysis-search-label">Find a perturbation<input id="analysis-search" type="search" placeholder="Mass, friction, action noise..."></label><label class="toggle" id="conditional-label"><input type="checkbox" id="analysis-conditional"> Nominally competent only</label></div>
    <div id="analysis-caption" class="analysis-caption"></div><div id="analysis-content" role="tabpanel"></div>
    <details class="analysis-definitions"><summary>Definitions & provenance</summary><p>Each observation is a trained policy's episode-mean return. Reliability uses the reference nominal median R₀ and Z = R / R₀. AUC = mean clip(Z, 0, 1); low-return probability = P(Z &lt; 0.5). Normalized metrics are undefined for R₀ ≤ 0. Native-return survival remains available.</p><p>Levels are equally weighted within each axis; full-suite summaries weight axes equally and exclude nominal levels. Conditional analyses use each method's own nominally competent policies. Missing finals are not imputed. Matching seed indices do not establish a paired design. All interactive metrics are descriptive, not confidence intervals, significance or task-success claims.</p><p>Source: ${esc(study.source)}<br>SHA256 ${esc(study.sourceSha256)}</p></details>`;
  select('analysis-axis',study.axes.map(a=>[a.id,a.title]),context.axis);
  const point=context.study.axes.find(a=>a.id===context.axis).curves[context.reference][context.index];
  select('analysis-value',study.axes.find(a=>a.id===context.axis).values[context.reference].map(p=>[String(p.x),String(p.x)]),String(point.x));
  $('analysis-kind').value=metric==='raw'?'raw':'reliability';
  const allowed=['gallery','suite','axis','condition','nominal'];
  $('analysis-scope').value=allowed.includes(params.get('scope'))?params.get('scope'):(seeds?'suite':'condition');
  if(!params.has('metric')&&reliabilityDisplay(study,modelsFor(context.axis),context.reference,$('analysis-scope').value==='gallery'?'axis':$('analysis-scope').value,context.axis,point.x).normalized===false){metric='raw';$('analysis-kind').value='raw';}
  if(context.selection==='best'&&$('analysis-scope').value==='suite')$('analysis-scope').value='gallery';
  $('analysis-conditional').checked=params.get('conditional')==='1';
  root.dataset.metric=metric;
  const tabs=[...root.querySelectorAll('[data-metric]')];
  tabs.forEach((b,i)=>{
    b.id='metric-tab-'+b.dataset.metric;
    b.onclick=()=>{setQuery({metric:b.dataset.metric});root.dataset.metric=b.dataset.metric;tabs.forEach(t=>t.setAttribute('aria-selected',String(t===b)));$('analysis-content').setAttribute('aria-labelledby',b.id);render();};
    b.onkeydown=e=>{const next=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(next!==null){e.preventDefault();tabs[next].focus();tabs[next].click();}};
  });
  $('analysis-kind').onchange=()=>{root.dataset.metric=$('analysis-kind').value;setQuery({metric:root.dataset.metric});render();};
  $('analysis-scope').onchange=render;
  $('analysis-conditional').onchange=render;
  $('analysis-search').oninput=render;
  $('analysis-axis').onchange=()=>choose({axis:$('analysis-axis').value});
  $('analysis-value').onchange=()=>choose({index:context.study.axes.find(a=>a.id===context.axis).curves[context.reference].findIndex(p=>p.x===Number($('analysis-value').value))});
  render();
}

function render(){
  const seeds=context.page==='seeds',metric=seeds?'seeds':root.dataset.metric,scope=$('analysis-scope').value,axis=$('analysis-axis').value,value=Number($('analysis-value').value);
  const conditional=$('analysis-conditional').checked&&metric==='reliability';
  const special=['aggregate','severity'].includes(metric),gallery=scope==='gallery'&&!special;
  $('analysis-kind-label').hidden=!['reliability','raw'].includes(metric);
  $('analysis-scope-label').hidden=special;
  $('analysis-axis-label').hidden=special||!['axis','condition','nominal'].includes(scope);
  $('analysis-value-label').hidden=special||scope!=='condition';
  $('analysis-search-label').hidden=!gallery;
  $('conditional-label').hidden=metric!=='reliability';
  for(const o of $('analysis-scope').options)o.disabled=context.selection==='best'&&o.value==='suite';
  setQuery({metric:seeds?q().get('metric'):metric,scope,conditional:conditional?'1':null,value});
  const stamp=context.selection==='best'?'Best per axis · ex-post full-grid return selection':context.allSettings?'All settings':label(context.model);
  $('analysis-caption').textContent=`${stamp} vs ${label(context.reference)} · ${special?'full-suite aggregate':scope==='condition'?'single severity: '+value:scope==='nominal'?'nominal':scope==='suite'?'full-suite aggregate':'perturbation aggregate'} · descriptive`;
  if(metric==='aggregate'){renderCaps();return;}
  if(metric==='severity'){renderSeverity();return;}
  const axes=gallery?study.axes.filter(a=>(a.title+' '+a.id).toLowerCase().includes($('analysis-search').value.toLowerCase())):[study.axes.find(a=>a.id===axis)];
  const panels=axes.map(a=>panel(metric,gallery?'axis':scope,a,value,conditional));
  $('analysis-content').innerHTML=`<div class="${gallery?'metrics-gallery':'metrics-single'}">${panels.join('')||'<p class="metric-unavailable">No matching perturbations.</p>'}</div>`;
  root.querySelectorAll('[data-open-axis]').forEach(b=>b.onclick=()=>{setQuery({scope:'axis'});choose({axis:b.dataset.openAxis});});
  root.querySelectorAll('[data-seed-download]').forEach(b=>b.onclick=()=>downloadSeeds(scope,axis,value));
  root.querySelectorAll('[data-native-returns]').forEach(b=>b.onclick=()=>{root.dataset.metric='raw';$('analysis-kind').value='raw';setQuery({metric:'raw'});render();});
  if(!gallery&&['reliability','raw'].includes(metric)){
    const slider=$('metric-threshold');
    if(slider){slider.oninput=()=>{$('metric-threshold-label').textContent=metric==='raw'?num(Number(slider.value)):pct(Number(slider.value));updateThreshold(metric,scope,axis,value,conditional,Number(slider.value));};slider.oninput();}
  }
}

function panel(metric,scope,axis,value,conditional){
  const models=modelsFor(axis.id),selected=modelFor(axis.id),gallery=$('analysis-scope').value==='gallery';
  const summaries=models.map(m=>({model:m,data:summarize(study,m,context.reference,scope,axis.id,value,conditional)}));
  const selectedSummary=summaries.find(s=>s.model===selected)?.data;
  let plot='',extra='',title=axis.title;
  if(metric==='reliability'||metric==='raw'){
    const series=models.map(model=>({model,points:metric==='raw'?rawReliability(study,model,context.reference,scope,axis.id,value).points:normalizedSurvival(study,model,context.reference,scope,axis.id,value,conditional).points}));
    plot=chart(series,metric==='raw'?'Native return threshold':'Retained-return threshold','Fraction of policies',metric==='raw'?{}:{xr:[0,1],threshold:.5});
    if(metric==='reliability'&&!series.some(s=>s.points.length))plot='<div class="metric-unavailable">Nonpositive nominal reference or unavailable policies.<br>Native-return survival is available.</div>';
    const display=reliabilityDisplay(study,models,context.reference,scope,axis.id,value);
    if(metric==='reliability'&&display.negative)plot=`<p class="compact-note">Negative returns lie left of this 0–1 view, so different negative outcomes can look identical here. <button type="button" class="download-link" data-native-returns>Show native returns</button></p>`+plot;
    if(metric==='raw'&&display.negative)plot='<p class="compact-note">Native thresholds preserve negative returns. Higher (less negative) is better.</p>'+plot;
    if(!gallery&&series.some(s=>s.points.length)){
      const all=series.flatMap(s=>s.points.map(p=>p[0])),lo=metric==='raw'?Math.min(...all):0,hi=metric==='raw'?Math.max(...all):1;
      extra=`<label class="threshold-control">${metric==='raw'?'Return':'Retention'} threshold <output id="metric-threshold-label"></output><input id="metric-threshold" type="range" min="${lo}" max="${hi}" step="${metric==='raw'?(hi-lo)/200||1:.01}" value="${metric==='raw'?(lo+hi)/2:.5}"></label><div id="threshold-readout"></div>`;
    }
  }else if(metric==='distribution'){
    plot=chart(models.map(model=>({model,points:returnDistribution(study,model,context.reference,scope,axis.id,value)})),'Policy mean return','Cumulative fraction');
  }else if(metric==='seeds'){
    const values=summaries.flatMap(s=>s.data.seeds);
    plot=values.length?chart(summaries.map(s=>({model:s.model,points:s.data.seeds.map(p=>[p.seed,p.raw])})),'Training seed','Mean return',{dots:true,xr:range(values.map(p=>p.seed)),yr:range(values.map(p=>p.raw))}):'<div class="metric-unavailable">No policy summaries.</div>';
    extra=seedTable(summaries);
  }else if(metric==='outcomes'){
    const rows=models.map(model=>({model,values:recordedOutcomes(study,model,context.reference,scope,axis.id,value)}));
    const keys=[...new Set(rows.flatMap(r=>Object.keys(r.values)))];
    plot=keys.length?`<div class="table-scroll"><table><thead><tr><th>Episode outcome</th>${models.map(m=>`<th>${esc(label(m))}</th>`).join('')}</tr></thead><tbody>${keys.map(k=>`<tr><td>${esc(k.replaceAll('_',' '))}</td>${rows.map(r=>`<td>${pct(r.values[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="metric-unavailable">No recorded task-outcome fields in this cohort.</div>';
  }
  if(scope==='suite')title='Full suite · equal-axis weights';
  if(scope==='nominal')title='Nominal · '+axis.title;
  if(scope==='condition')title+=' · '+value;
  const stats=selectedSummary?`<div class="panel-stats"><span>Mean <strong>${num(selectedSummary.raw)}</strong></span><span>AUC <strong>${num(selectedSummary.auc)}</strong></span><span>P(Z &lt; 0.5) <strong>${pct(selectedSummary.catastrophe)}</strong></span><span>Policies <strong>${selectedSummary.minN===selectedSummary.maxN?selectedSummary.minN:selectedSummary.minN+'–'+selectedSummary.maxN}/${study.intendedPolicies}</strong></span></div>`:'';
  return `<article class="metric-panel"><div class="metric-panel-heading"><h2>${esc(title)}</h2>${gallery?`<button data-open-axis="${esc(axis.id)}" title="Open ${esc(axis.title)}" aria-label="Open ${esc(axis.title)}">↗</button>`:''}</div>${plot}${legend(models)}<div class="panel-selection">${esc(label(selected))}${context.selection==='best'?' · ex post':''}</div>${stats}${extra}</article>`;
}

function updateThreshold(metric,scope,axis,value,conditional,t){
  $('threshold-readout').innerHTML=modelsFor(axis).map(m=>{const p=metric==='raw'?rawReliability(study,m,context.reference,scope,axis,value).survival(t):summarize(study,m,context.reference,scope,axis,value,conditional).reliability(t);return `<span>${esc(label(m))} <strong>${pct(p)}</strong></span>`;}).join('');
}

function seedTable(summaries){
  const ids=[...new Set(summaries.flatMap(s=>s.data.seeds.map(p=>p.seed)))].sort((a,b)=>a-b);
  return `<div class="seed-table table-scroll"><table><thead><tr><th>Seed</th>${summaries.map(s=>`<th>${esc(label(s.model))}</th>`).join('')}</tr></thead><tbody>${ids.map(id=>`<tr><td>${id}</td>${summaries.map(s=>`<td>${num(s.data.seeds.find(p=>p.seed===id)?.raw??null)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><button class="download-link" data-seed-download>Download seed table ↓</button>`;
}
function downloadSeeds(scope,axis,value){
  const rows=[['study','scope','axis','setting','seed','mean_return','reliability_auc','conditions','axes']];
  const axes=scope==='gallery'?study.axes:[study.axes.find(a=>a.id===axis)];
  for(const a of axes)for(const model of modelsFor(a.id))for(const s of summarize(study,model,context.reference,scope==='gallery'?'axis':scope,a.id,value).seeds)rows.push([study.id,scope,a.id,model,s.seed,s.raw,s.auc,s.conditions,s.axes]);
  csv(study.id+'-seed-summary',rows);
}

function renderCaps(){
  const rows=capSummaries(study,context.reference),best=bestFixedSetting(study,context.reference),ref=rows.find(r=>r.model===context.reference).suite;
  const scatter=chart(rows.map(r=>({model:r.model,points:r.nominal.raw!==null&&r.suite.raw!==null?[[r.nominal.raw,r.suite.raw]]:[]})),'Nominal mean return','Suite mean return',{dots:true,xr:range(rows.map(r=>r.nominal.raw).filter(Number.isFinite)),yr:range(rows.map(r=>r.suite.raw).filter(Number.isFinite))});
  const axisStats=study.axes.map(a=>({axis:a,reference:summarize(study,context.reference,context.reference,'axis',a.id),models:study.models.map(m=>summarize(study,m,context.reference,'axis',a.id))}));
  const deltas=axisStats.flatMap(a=>a.models.map(r=>r.raw===null||a.reference.raw===null?null:r.raw-a.reference.raw)).filter(Number.isFinite),max=Math.max(...deltas.map(Math.abs),1);
  $('analysis-content').innerHTML=`<div class="cap-overview"><div>${scatter}</div><div><h2>All settings</h2>${legend(study.models)}<p class="compact-note">Suite means: nonnominal levels, equal-axis weights.</p><p class="best-fixed">Highest suite mean · ${esc(label(best))}<span>Active settings only · ex post</span></p><button class="select-fixed" id="select-suite-best">Select ${esc(label(best))}</button></div></div>
    <div class="table-scroll cap-table"><table><thead><tr><th>Setting</th><th>Nominal mean</th><th>Suite mean</th><th>Δ reference</th><th>Reliability AUC</th><th>Low-return probability</th><th>Policies / intended</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.model===context.model?'selected-row':''}"><td><button data-select-model="${esc(r.model)}">${esc(label(r.model))}${r.model===best?' · highest suite mean':''}</button></td><td>${num(r.nominal.raw)}</td><td>${num(r.suite.raw)}</td><td>${r.suite.raw===null||ref.raw===null?'N/A':num(r.suite.raw-ref.raw)}</td><td>${num(r.suite.auc)}</td><td>${pct(r.suite.catastrophe)}</td><td>${r.suite.minN===r.suite.maxN?r.suite.minN:r.suite.minN+'–'+r.suite.maxN} / ${study.intendedPolicies}</td></tr>`).join('')}</tbody></table></div>
    <div class="section-heading"><h2>Cap × perturbation</h2><span class="small">Mean-return difference from ${esc(label(context.reference))}</span></div><div class="table-scroll heatmap"><table><thead><tr><th>Setting</th>${study.axes.map(a=>`<th>${esc(a.title)}</th>`).join('')}</tr></thead><tbody>${study.models.map((m,i)=>`<tr><th>${esc(label(m))}</th>${axisStats.map(a=>{const d=a.models[i].raw===null||a.reference.raw===null?null:a.models[i].raw-a.reference.raw;return `<td><button data-heat-model="${esc(m)}" data-heat-axis="${esc(a.axis.id)}" style="background:${d===null?'#f0f2f5':d>=0?`rgba(23,128,107,${.06+.3*Math.abs(d)/max})`:`rgba(201,68,81,${.06+.3*Math.abs(d)/max})`}" title="${esc(label(m)+' / '+a.axis.title)}: Δ return ${num(d)}">${num(d)}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div><button class="download-link" id="cap-download">Download cap summary ↓</button>`;
  if(context.study.flatResponseAxes?.length)$('analysis-content').insertAdjacentHTML('afterbegin',`<p class="caution">Suite includes ${context.study.flatResponseAxes.length} localized mass/friction axes with flat saved returns. Physical perturbation effectiveness is unverified.</p>`);
  $('select-suite-best').onclick=()=>choose({model:best});
  root.querySelectorAll('[data-select-model]').forEach(b=>b.onclick=()=>choose({model:b.dataset.selectModel}));
  root.querySelectorAll('[data-heat-model]').forEach(b=>b.onclick=()=>{setQuery({metric:'reliability',scope:'axis'});choose({model:b.dataset.heatModel,axis:b.dataset.heatAxis});});
  $('cap-download').onclick=()=>csv(study.id+'-caps',[['setting','reference','nominal_mean','suite_mean','reliability_auc','low_return_probability','min_n','max_n','intended'],...rows.map(r=>[r.model,context.reference,r.nominal.raw,r.suite.raw,r.suite.auc,r.suite.catastrophe,r.suite.minN,r.suite.maxN,study.intendedPolicies])]);
}

function renderSeverity(){
  const rows=severity(study,study.baseline);
  $('analysis-content').innerHTML=`<div class="section-heading"><h2>Standard-policy shift severity</h2><span class="small">1 − median retained return · standard reference</span></div><div class="severity-list">${rows.map(r=>`<button data-severity-axis="${esc(r.id)}"><span>${esc(r.title)}</span><span class="severity-track"><i style="width:${r.value===null?0:Math.max(0,Math.min(1,r.value))*100}%"></i></span><strong>${num(r.value)}</strong></button>`).join('')}</div><p class="compact-note">Axis-specific standard nominal median. Nonpositive references: N/A. Values are descriptive, not physical parameter scales.</p>`;
  root.querySelectorAll('[data-severity-axis]').forEach(b=>b.onclick=()=>{setQuery({metric:'reliability',scope:'axis'});choose({axis:b.dataset.severityAxis});});
}

window.addEventListener('results-context',receive);
window.dispatchEvent(new Event('results-request'));
