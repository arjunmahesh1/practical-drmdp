import {escape as esc,fmt,label,activeModel,axisLabel,bestModelOnAxis,nearestPoint} from './model.mjs?v=20261104-library1';
import {visibleStudy,suppliedEnvironments} from './results-policy.mjs';
import {withRecordings,recordingOverlay,libraryRecordingCoverage} from './recording-overlay.mjs';
import {summarize,rawReliability} from './appendix-metrics.mjs';
import {normalizedSurvival} from './browser-metrics.mjs';
import {segmentWindow,segmentSource,segmentFrame,segmentTime} from './video-segment.mjs';
import {episodeTraceSVG} from './replay-chart.mjs';

const root=typeof document==='undefined'?null:document.getElementById('environment-page'),$=id=>document.getElementById(id);
const cache=new Map(),colors=['#003087','#d94b24'];
let library,environment,cohort,data,policy,model,axis,selection='fixed',conditionIndex=0,evidence,ticket=0,mediaTicket=0,animation;
const query=()=>new URLSearchParams(location.search);
const display=x=>x===null?'N/A':fmt(x,Math.abs(x)<1?3:1);
export const belongsTo=(entry,text,source,scope)=>
  (entry.name+' '+entry.framework+' '+entry.simulator+' '+entry.taskIds.join(' ')).toLowerCase().includes(text.toLowerCase())&&
  (source==='all'||entry.simulator===source)&&(scope==='all'||entry.stage===scope);

export function previewChart(series,xlabel,ylabel,{unit=false,bands=false,nominal=null,current=null}={}){
  const points=series.flatMap(s=>s.points);
  if(!points.length)return '<p class="env-unavailable">No values available for this scope.</p>';
  const xs=points.map(p=>p.x),ys=points.flatMap(p=>bands?[p.y-(p.sd||0),p.y+(p.sd||0)]:[p.y]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),bottom=unit?0:Math.min(...ys),top=unit?1:Math.max(...ys);
  const pad=unit?0:(top-bottom||Math.abs(top)||1)*.07,ymin=bottom-pad,ymax=top+pad;
  const W=560,H=315,L=75,R=20,T=16,B=61;
  const x=v=>L+(v-xmin)/(xmax-xmin||1)*(W-L-R),y=v=>H-B-(v-ymin)/(ymax-ymin||1)*(H-B-T);
  let out=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ylabel)} by ${esc(xlabel)}"><title>${esc(ylabel)} by ${esc(xlabel)}</title>`;
  for(let i=0;i<4;i++){
    const yy=ymin+i*(ymax-ymin)/3,xx=xmin+i*(xmax-xmin)/3;
    out+=`<line x1="${L}" x2="${W-R}" y1="${y(yy)}" y2="${y(yy)}" stroke="#e0e5e9"/><text x="${L-8}" y="${y(yy)+4}" text-anchor="end">${fmt(yy,unit?2:Math.abs(ymax-ymin)<4?2:0)}</text><text x="${x(xx)}" y="${H-B+24}" text-anchor="middle">${fmt(xx,Math.abs(xmax-xmin)<3?2:1)}</text>`;
  }
  if(nominal!==null)out+=`<line x1="${x(nominal)}" x2="${x(nominal)}" y1="${T}" y2="${H-B}" stroke="#a0a9ad" stroke-dasharray="3 4"/>`;
  if(current!==null)out+=`<line x1="${x(current)}" x2="${x(current)}" y1="${T}" y2="${H-B}" stroke="#d94b24" stroke-dasharray="5 3"><title>Selected severity: ${current}</title></line>`;
  series.forEach((s,i)=>{
    if(bands)out+=`<path d="${s.points.map((p,j)=>(j?'L':'M')+x(p.x)+','+y(p.y+(p.sd||0))).join(' ')} ${s.points.toReversed().map(p=>'L'+x(p.x)+','+y(p.y-(p.sd||0))).join(' ')}Z" fill="${colors[i]}" opacity=".12"/>`;
    out+=`<path d="${s.points.map((p,j)=>(j?'L':'M')+x(p.x)+','+y(p.y)).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="2.3"><title>${esc(s.name)}</title></path>`;
    const selected=s.points.find(p=>p.x===current);if(selected)out+=`<circle cx="${x(current)}" cy="${y(selected.y)}" r="4" fill="${colors[i]}"><title>${esc(s.name)}: ${selected.y}</title></circle>`;
  });
  return out+`<path d="M${L},${T}V${H-B}H${W-R}" fill="none" stroke="#9da8ae"/><text x="${(L+W-R)/2}" y="${H-10}" text-anchor="middle">${esc(xlabel)}</text><text transform="translate(18 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle">${esc(ylabel)}</text></svg>`;
}

function href(view,extra={}){
  const u=new URL(location.href);u.search=new URLSearchParams({study:cohort.id,setting:model,axis:axis?.id||'',value:axis?.curves[data.baseline][conditionIndex].x,...extra});u.hash=view;
  return u.pathname+u.search+u.hash;
}
function remember(){
  const u=new URL(location.href);u.search=new URLSearchParams({environment:environment.id});
  if(cohort)u.searchParams.set('cohort',cohort.id);
  if(model)u.searchParams.set('parameter',model);
  if(axis)u.searchParams.set('shift',axis.id);
  if(axis)u.searchParams.set('value',axis.curves[data.baseline][conditionIndex].x);
  if(selection==='best')u.searchParams.set('selection','best');
  history.replaceState(null,'',u.pathname+u.search+'#environments');
}
async function json(path){if(!cache.has(path)){const r=await fetch(path);if(!r.ok)throw Error('Unavailable: '+path);cache.set(path,await r.json());}return cache.get(path);}
function pause(){++mediaTicket;cancelAnimationFrame(animation);const v=$('env-video');if(v){v.pause();v.removeAttribute('src');v.load();}}

function shell(){
  root.innerHTML=`<div class="library-heading"><h1>Environments</h1></div>
    <div class="env-counts"><span><strong>${library.entries.filter(e=>e.cohorts.length||e.report).length}</strong> with results</span><span><strong>${library.entries.filter(e=>e.videoSelections).length}</strong> with videos</span><span><strong>${library.entries.flatMap(e=>e.cohorts).length}</strong> study cohorts</span></div>
    <div class="env-filters"><label>Find an environment<input id="env-search" type="search" placeholder="Task or simulator..."></label><label>Simulator<select id="env-source"><option value="all">All simulators</option>${[...new Set(library.entries.map(e=>e.simulator))].map(s=>`<option>${esc(s)}</option>`).join('')}</select></label><label>Studies<select id="env-scope"><option value="all">All studies</option><option value="main">Main campaign</option><option value="supplied">Pendulum / DoublePendulum</option><option value="pilot">Pilot</option><option value="development">Earlier development</option></select></label></div>
    <div class="env-layout"><aside class="env-directory" aria-label="Environment directory"><label class="env-jump">Environment<select id="env-jump"></select></label><p id="env-matches" class="small"></p><div id="env-list"></div></aside><div id="env-detail" aria-live="polite"></div></div>`;
  $('env-search').oninput=directory;$('env-source').onchange=directory;$('env-scope').onchange=directory;
  $('env-jump').onchange=()=>selectEnvironment($('env-jump').value);
  directory();
}
function directory(){
  const entries=library.entries.filter(e=>belongsTo(e,$('env-search').value,$('env-source').value,$('env-scope').value));
  $('env-matches').textContent=entries.length+' environment entries';
  $('env-jump').innerHTML=entries.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
  if(environment)$('env-jump').value=environment.id;
  $('env-list').innerHTML=entries.map(e=>{const gains=e.cohorts.reduce((n,c)=>n+(evidence?.summary[c.id]?.suiteGains||0),0);return `<button class="env-entry" data-env="${e.id}" aria-pressed="${e===environment}"><strong>${esc(e.name)}</strong><span>${esc(e.simulator)}</span><small>${e.cohorts.length?e.cohorts.length+' cohorts':e.stage==='supplied'?'Supplied data':e.stage==='pilot'?'Pilot':'Development'}${e.videoSelections?' · Videos':''}</small>${gains?`<small class="env-gain" title="${gains} fixed settings have higher full-suite mean return and reliability AUC than their comparator; descriptive, not statistically certified.">${gains} suite gain${gains===1?'':'s'} · descriptive</small>`:''}</button>`;}).join('')||'<p class="env-unavailable">No matching environment.</p>';
  $('env-list').querySelectorAll('[data-env]').forEach(b=>b.onclick=()=>selectEnvironment(b.dataset.env));
  if(environment&&entries.length&&!entries.includes(environment))selectEnvironment(entries[0].id);
  if(!entries.length){pause();++ticket;$('env-detail').innerHTML='<p class="env-unavailable">No environment matches these filters.</p>';}
}
async function selectEnvironment(id,initial=false){
  pause();environment=library.entries.find(e=>e.id===id)||library.entries[0];cohort=null;axis=null;model=null;selection='fixed';directory();
  const entry=environment;
  if(entry.report){
    const saved=initial?query().get('reportState'):null;
    ++ticket;remember();
    const report=new URL(entry.report,location.href);
    report.searchParams.set('v','20261105-navigation1');
    if(saved){const state=new URLSearchParams(saved);if(state.get('dataset')===report.searchParams.get('dataset'))for(const key of ['view','setting','family','mode','axis','value','scope','measure','tail','threshold','bands'])if(state.has(key))report.searchParams.set(key,state.get(key));}
    const full=new URL(report);full.searchParams.delete('embed');
    $('env-detail').innerHTML=`<header class="env-title"><div><h2>${esc(entry.name)}</h2></div><a id="env-full-report" href="${esc(full.href)}" target="_blank" rel="noopener">Full report ↗</a></header><p class="env-evidence-note">Supplied returns; algorithm, backend and training-seed identities unconfirmed. No video available.</p><iframe class="env-supplied-report" title="${esc(entry.name)} return curves and advanced metrics" src="${esc(report.href)}"></iframe>`;return;
  }
  $('env-detail').innerHTML=`<header class="env-title"><div><h2>${esc(entry.name)}</h2><p>${esc(entry.framework)} <span aria-hidden="true">/</span> ${esc(entry.simulator)}</p></div><span class="env-stage">${entry.stage==='main'?'Main campaign':entry.stage==='pilot'?'Pilot':'Earlier development'}</span></header>
    ${entry.cohorts.length?`<div class="env-cohort-control"><label>Method / cohort<select id="env-cohort">${entry.cohorts.map(s=>`<option value="${s.id}">${esc(s.algorithm+'-'+s.family+' / '+s.branch)}</option>`).join('')}</select></label><span id="env-coverage"></span></div><div id="env-results" role="status">Loading saved results...</div>`:
      `<div class="env-empty"><h3>${entry.stage==='pilot'?'Pilot, not a full-30 result':'No completed return export'}</h3><p>${esc(entry.note)}</p><dl><div><dt>Return curves</dt><dd>Not available in the validated library</dd></div><div><dt>Advanced metrics</dt><dd>No eligible policy-level export</dd></div><div><dt>Policy video</dt><dd>${entry.recordingPending?'Recording pending':'No linked recording'}</dd></div></dl></div>`}`;
  if(!entry.cohorts.length){++ticket;remember();return;}
  const requested=initial?(query().get('cohort')||query().get('study')):null;
  $('env-cohort').value=entry.cohorts.some(c=>c.id===requested)?requested:entry.preferred||entry.cohorts[0].id;
  $('env-cohort').onchange=()=>selectCohort($('env-cohort').value);
  await selectCohort($('env-cohort').value,initial);
}
async function selectCohort(id,initial=false){
  const job=++ticket;pause();cohort=environment.cohorts.find(s=>s.id===id);
  $('env-results').innerHTML='<p class="small" role="status">Loading saved results...</p>';
  try{
    const nextData=await withRecordings(await json('data/'+cohort.id+'.json'));
    const nextPolicy=await json('data/appendix/'+cohort.id+'.json');
    if(job!==ticket||location.hash!=='#environments')return;
    data=nextData;policy=nextPolicy;
    const requested=initial?(query().get('parameter')||query().get('setting')):null;
    model=data.models.includes(requested)?requested:activeModel(data.models)||data.baseline;
    axis=data.axes.find(a=>a.id===(initial?(query().get('shift')||query().get('axis')):null))||data.axes[0];
    conditionIndex=nearestPoint(axis.curves[data.baseline],initial&&query().has('value')?Number(query().get('value')):axis.nominal);
    selection=initial&&(query().get('selection')==='best'||requested==='best')?'best':'fixed';
    $('env-coverage').textContent=`${cohort.models.length} settings · ${cohort.axisCount} perturbations · ${cohort.intendedPolicies} intended policies per setting${cohort.gridComplete===false?' · grid incomplete':''}`;
    const gains=evidence.summary[cohort.id]?.suiteGains||0;
    $('env-coverage').insertAdjacentHTML('beforeend',` · <a href="?study=${cohort.id}&level=L3${gains?'&result=gain':''}#robustness">${gains?gains+' suite gains':'Compare robustness'} ↗</a>`);
    $('env-results').innerHTML=`<div class="env-comparison-controls"><label>Setting<select id="env-setting">${data.models.map(m=>`<option value="${esc(m)}">${esc(label(m))}</option>`).join('')}</select></label><label>Perturbation<select id="env-shift">${data.axes.map(a=>`<option value="${a.id}">${esc(a.title)}</option>`).join('')}</select></label></div>
      <div class="env-cap-selection"><button id="env-best-cap" type="button" class="text-button" aria-pressed="false" aria-describedby="env-cap-note"></button><span id="env-cap-note"></span></div>
      <div class="env-severity-controls"><label>Severity<select id="env-level"></select></label><label class="env-severity-slider">${esc(axis.title)}<input id="env-severity" type="range" min="0" step="1" aria-label="Perturbation severity"><output id="env-severity-value"></output></label><button id="env-nominal" type="button" class="text-button">Nominal ↺</button></div>
      <nav class="env-view-links" aria-label="Analyze this selection"><a id="env-open-curves">Return curves</a><a id="env-open-metrics">Advanced metrics</a><a id="env-cap-metrics">Compare caps</a><a id="env-figures">Figures</a><a id="env-seeds">Seeds</a></nav>
      <div class="env-plots"><section><div class="env-section-heading"><h3>Return curve</h3></div><div id="env-curve"></div><div id="env-legend" class="env-legend"></div></section><section><div class="env-section-heading"><h3 id="env-metric-title">Return reliability</h3></div><div id="env-reliability"></div><div id="env-metric-summary" class="env-metric-summary"></div></section></div>
      <div class="env-analysis-links"><a id="env-axis-metrics">Aggregate: this perturbation ↗</a><a id="env-suite-metrics">Aggregate: full suite ↗</a><a id="env-evidence">Robustness hierarchy ↗</a></div>
      <p id="env-plot-note" class="env-evidence-note"></p>
      <section class="env-media"><div class="env-section-heading"><h3>Policy video</h3><a id="env-open-replay">Rollout explorer ↗</a></div><p id="env-media-status" role="status"></p><div id="env-media-body"><div><div class="env-video-surface"><video id="env-video" playsinline muted controls preload="metadata" hidden aria-label="Same-cohort recorded policy"></video></div><label class="env-video-scrub" id="env-video-scrub" hidden>Episode<input id="env-video-frame" type="range" min="0" max="1" value="0" aria-label="Recorded episode frame"><output id="env-video-time"></output></label></div><div id="env-episode-trace"></div></div><p id="env-media-note" class="env-evidence-note"></p><details id="env-recording-details" hidden><summary>Recording details</summary><p id="env-recording-provenance" class="env-evidence-note"></p></details></section>
      <div class="env-artifacts"><a id="env-policies" download>Policy summaries CSV ↓</a>${cohort.archive?`<a href="${cohort.archive}" download>Overleaf package ↓</a>`:''}</div><details class="env-provenance"><summary>Data & interpretation</summary><p>${esc(data.note)}</p><p>Same setting across axes; sample SD, not a confidence interval. Return reliability is not physical task success. Failed runs receive no invented returns. Video coverage is cohort-specific.</p><p>${environment.taskIds.map(esc).join(' / ')}</p><code>${esc(data.id)}</code></details>`;
    $('env-setting').value=model;$('env-shift').value=axis.id;
    $('env-setting').onchange=()=>{selection='fixed';model=$('env-setting').value;renderComparison();};
    $('env-results').insertBefore($('env-results').querySelector('.env-media'),$('env-results').querySelector('.env-plots'));
    $('env-shift').onchange=()=>{axis=data.axes.find(a=>a.id===$('env-shift').value);conditionIndex=nearestPoint(axis.curves[data.baseline],axis.nominal);renderComparison();};
    $('env-best-cap').onclick=()=>{selection='best';renderComparison();};
    $('env-severity').oninput=e=>{conditionIndex=Number(e.target.value);renderComparison();};
    $('env-level').onchange=e=>{conditionIndex=Number(e.target.value);renderComparison();};
    $('env-nominal').onclick=()=>{conditionIndex=nearestPoint(axis.curves[data.baseline],axis.nominal);renderComparison();};
    renderComparison();
  }catch(e){if(job===ticket)$('env-results').innerHTML=`<p class="env-unavailable" role="alert">${esc(e.message)}</p>`;}
}
function renderComparison(){
  const best=bestModelOnAxis(data,axis);
  if(selection==='best'&&best)model=best;
  if(!best)selection='fixed';
  $('env-setting').value=model;
  $('env-best-cap').textContent=best?'Best cap: '+label(best):'No active cap';
  $('env-best-cap').disabled=!best;
  $('env-best-cap').setAttribute('aria-pressed',String(selection==='best'));
  $('env-best-cap').title='Select the active setting with the highest mean return over this perturbation grid; controls are excluded.';
  $('env-cap-note').textContent=selection==='best'?'Highest axis mean · ex post':'Best uses the full-axis mean · ex post';
  const levels=axis.curves[data.baseline],value=levels[conditionIndex].x;
  $('env-level').innerHTML=levels.map((p,i)=>`<option value="${i}">${p.x}${p.x===axis.nominal?' · nominal':''}</option>`).join('');$('env-level').value=conditionIndex;
  $('env-severity').parentElement.firstChild.textContent=axis.title;
  $('env-severity').max=levels.length-1;$('env-severity').value=conditionIndex;$('env-severity-value').textContent=axis.title+' = '+value;
  pause();remember();const models=[...new Set([data.baseline,model])];
  $('env-curve').innerHTML=previewChart(models.map(m=>({name:label(m),points:axis.curves[m].map(p=>({x:p.x,y:p.mean,sd:p.sd}))})),axisLabel(axis,data.environment),'Episode-mean return',{bands:true,nominal:axis.nominal,current:value});
  $('env-legend').innerHTML=models.map((m,i)=>`<span style="--series:${colors[i]}">${esc(label(m))}</span>`).join('');
  const summaries=models.map(m=>summarize(policy,m,data.baseline,'condition',axis.id,value));
  const normalized=summaries.every(s=>s.valid);
  const series=models.map(m=>({name:label(m),points:(normalized?normalizedSurvival(policy,m,data.baseline,'condition',axis.id,value):rawReliability(policy,m,data.baseline,'condition',axis.id,value)).points.map(([x,y])=>({x,y}))}));
  $('env-reliability').innerHTML=previewChart(series,normalized?'Retained-return threshold':'Native return threshold','Fraction of policies',{unit:true});
  $('env-metric-title').textContent=(normalized?'Return reliability':'Native-return survival')+' · '+value;
  $('env-metric-title').title='One measured severity only. Each observation is a trained policy’s episode-mean return, not a severity average.';
  $('env-metric-summary').innerHTML=summaries.map((s,i)=>`<div><span>${esc(label(models[i]))}</span><strong>${normalized?display(s.auc):display(s.raw)}</strong><small>${normalized?'<dfn title="Mean clip(R / R₀, 0, 1) across trained policies at this severity. R₀ is the fixed standard nominal median; not a confidence interval.">Reliability AUC</dfn>':'Mean condition return'}</small></div>`).join('');
  const counts=models.flatMap(m=>axis.curves[m].map(p=>p.n));
  $('env-plot-note').textContent=(axis.warning?axis.warning+' ':'')+`Reliability at ${axis.title} = ${value} only · ${summaries.map(s=>s.minN).join(' / ')} of ${cohort.intendedPolicies} policies. Bands: sample SD, not CI.`+(normalized?' Reference: standard nominal median.':' Nonpositive reference: native-return thresholds.');
  $('env-open-curves').href=href('returns');$('env-open-metrics').href=href('advanced',{scope:'condition',metric:normalized?'reliability':'raw'});
  $('env-axis-metrics').href=href('advanced',{scope:'axis',metric:normalized?'reliability':'raw'});$('env-suite-metrics').href=href('advanced',{scope:'suite',metric:normalized?'reliability':'raw'});$('env-cap-metrics').href=href('advanced',{metric:'aggregate'});
  $('env-evidence').href='?study='+data.id+'#robustness';
  $('env-policies').href='data/appendix/'+data.id+'.csv';$('env-figures').href=href('figures',{figureStudy:data.id});$('env-seeds').href=href('seeds',{scope:'condition'});
  recordings();
}
function recordings(){
  pause();const chosen=model,value=axis.curves[data.baseline][conditionIndex].x;
  $('env-open-replay').href=href('explore',{policy:chosen===data.baseline?'standard':'selected'});
  $('env-recording-details').hidden=true;
  const available=!!data.replays?.[chosen]?.[axis.id+'|'+value];$('env-media-body').hidden=!available;
  if(!available){$('env-media-status').textContent='No video for '+label(chosen)+' · '+axis.title+' = '+value+'.';$('env-media-note').textContent='Curves and metrics are available below.';return;}
  loadVideo();
}
async function loadVideo(){
  pause();const job=mediaTicket,chosen=model,value=axis.curves[data.baseline][conditionIndex].x;
  const relative=data.replays[chosen][axis.id+'|'+value];
  $('env-media-status').textContent='Loading matched recording...';$('env-media-note').textContent='';
  const video=$('env-video');video.hidden=true;$('env-video-scrub').hidden=true;$('env-video-frame').disabled=true;$('env-episode-trace').innerHTML='';
  try{
    const replay=await json(relative.startsWith('assets/replays/')?'https://arjunmahesh1.github.io/practical-drmdp/'+relative:relative);
    if(job!==mediaTicket||root.hidden)return;
    if(replay.study!==data.id||replay.model!==chosen||replay.axis!==axis.id||Number(replay.value)!==value)throw Error('Recording identity does not match the selected cohort.');
    if(replay.kind!=='video')throw Error('No video file is linked to this saved trajectory.');
    const {start,end}=segmentWindow(replay);
    const caption=`${label(chosen)} · training seed ${replay.trainingSeed} · episode seed ${replay.episodeSeed} · return ${display(replay.returnValue)}`;
    $('env-media-note').textContent='One saved-policy episode; not a cohort mean or task-success estimate.';
    $('env-recording-provenance').textContent=(replay.interpretation||'Illustrative saved-policy recording, not a cohort mean.')+' Exact cohort, policy and condition retained. Physical success is not inferred from playback.';
    $('env-recording-details').hidden=false;
    const source=segmentSource(replay);video.src=source.startsWith('assets/replays/')?'https://arjunmahesh1.github.io/practical-drmdp/'+source:source;
    let ready=false;
    const prepare=()=>{if(job!==mediaTicket||ready||video.readyState<1)return;ready=true;video.currentTime=start;};
    const sync=()=>{if(job!==mediaTicket)return;if(video.readyState>=2){video.hidden=false;$('env-video-frame').disabled=false;$('env-media-status').textContent=caption;}const frame=segmentFrame(replay,video.currentTime);$('env-video-frame').value=frame;$('env-video-time').textContent=fmt(replay.timeline[frame].time,2)+' / '+fmt(replay.timeline.at(-1).time,2)+' s';$('env-episode-trace').innerHTML=episodeTraceSVG(replay.timeline,frame,chosen===data.baseline?colors[0]:colors[1],true);};
    $('env-video-scrub').hidden=false;$('env-video-frame').max=replay.timeline.length-1;
    $('env-video-frame').oninput=e=>{video.pause();video.currentTime=segmentTime(replay,Number(e.target.value));sync();};
    const clamp=()=>{if(job!==mediaTicket)return;if(video.currentTime<start-.05||video.currentTime>=end){const playing=!video.paused;video.currentTime=start;if(playing)video.play().catch(()=>{});}sync();};
    const watch=()=>{if(job!==mediaTicket||video.paused)return;clamp();animation=requestAnimationFrame(watch);};
    video.onloadedmetadata=prepare;video.oncanplay=()=>{prepare();sync();};video.ontimeupdate=clamp;video.onseeking=clamp;video.onseeked=sync;
    video.onplay=()=>{cancelAnimationFrame(animation);watch();};video.onpause=()=>cancelAnimationFrame(animation);
    video.onended=()=>{video.currentTime=start;};
    video.onerror=()=>{if(job===mediaTicket){$('env-media-status').textContent='Matching video could not load.';$('env-media-note').textContent='No other cohort or recording has been substituted.';}};
    video.load();sync();
  }catch(e){if(job===mediaTicket){$('env-media-status').textContent=e.message;$('env-media-note').textContent='No other policy or cohort has been substituted.';}}
}
async function route(){
  const active=(location.hash||'#environments')==='#environments';root.hidden=!active;
  root.dataset.active=active?'1':'0';
  if(!active){pause();++ticket;return;}
  if(!location.hash){const u=new URL(location.href);u.hash='environments';history.replaceState(null,'',u);}
  try{const original=libraryRecordingCoverage(await json('data/environments.json'),await recordingOverlay());library={...original,entries:[...original.entries.map(e=>({...e,cohorts:e.cohorts.filter(visibleStudy)})),...suppliedEnvironments]};evidence=await json('data/evidence-summary.json');shell();const requested=query().get('cohort')||query().get('study');await selectEnvironment(query().get('environment')||library.entries.find(e=>e.cohorts.some(c=>c.id===requested))?.id||'walker',true);}
  catch(e){root.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}
}
if(root){
  window.addEventListener('message',e=>{
    const frame=root.querySelector('.env-supplied-report');
    if(root.hidden||!frame||e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='pendulum-context'||typeof e.data.search!=='string')return;
    const saved=new URLSearchParams(e.data.search);saved.delete('embed');
    const u=new URL(location.href);u.searchParams.set('reportState',saved.toString());history.replaceState(null,'',u);
    const report=new URL(frame.src);report.search=saved.toString();$('env-full-report').href=report.href;
  });
  window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
  window.addEventListener('results-context',e=>{
    if(e.detail.page==='environments'&&root.dataset.active!=='1')route();
    else if(e.detail.page!=='environments'&&root.dataset.active==='1'){root.dataset.active='0';pause();++ticket;}
  });
  if(location.hash==='#environments'||(!location.hash&&!query().has('study')))route();
}
