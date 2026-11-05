import {escape as esc,fmt,label,activeModel,axisLabel} from './model.mjs?v=20261104-library1';
import {summarize,rawReliability} from './appendix-metrics.mjs';
import {normalizedSurvival} from './browser-metrics.mjs';
import {segmentWindow,segmentSource,segmentFrame,segmentTime} from './video-segment.mjs';
import {episodeTraceSVG} from './replay-chart.mjs';

const root=typeof document==='undefined'?null:document.getElementById('environment-page'),$=id=>document.getElementById(id);
const cache=new Map(),colors=['#003087','#d94b24'];
let library,environment,cohort,data,policy,model,axis,ticket=0,mediaTicket=0,animation;
const query=()=>new URLSearchParams(location.search);
const display=x=>x===null?'N/A':fmt(x,Math.abs(x)<1?3:1);
export const belongsTo=(entry,text,source,scope)=>
  (entry.name+' '+entry.framework+' '+entry.simulator+' '+entry.taskIds.join(' ')).toLowerCase().includes(text.toLowerCase())&&
  (source==='all'||entry.simulator===source)&&(scope==='all'||entry.stage===scope);

export function previewChart(series,xlabel,ylabel,{unit=false,bands=false,nominal=null}={}){
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
  series.forEach((s,i)=>{
    if(bands)out+=`<path d="${s.points.map((p,j)=>(j?'L':'M')+x(p.x)+','+y(p.y+(p.sd||0))).join(' ')} ${s.points.toReversed().map(p=>'L'+x(p.x)+','+y(p.y-(p.sd||0))).join(' ')}Z" fill="${colors[i]}" opacity=".12"/>`;
    out+=`<path d="${s.points.map((p,j)=>(j?'L':'M')+x(p.x)+','+y(p.y)).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="2.3"><title>${esc(s.name)}</title></path>`;
  });
  return out+`<path d="M${L},${T}V${H-B}H${W-R}" fill="none" stroke="#9da8ae"/><text x="${(L+W-R)/2}" y="${H-10}" text-anchor="middle">${esc(xlabel)}</text><text transform="translate(18 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle">${esc(ylabel)}</text></svg>`;
}

function href(view,extra={}){
  const u=new URL(location.href);u.search=new URLSearchParams({study:cohort.id,setting:model,axis:axis?.id||'',...extra});u.hash=view;
  return u.pathname+u.search+u.hash;
}
function remember(){
  const u=new URL(location.href);u.search=new URLSearchParams({environment:environment.id});
  if(cohort)u.searchParams.set('cohort',cohort.id);
  if(model)u.searchParams.set('parameter',model);
  if(axis)u.searchParams.set('shift',axis.id);
  history.replaceState(null,'',u.pathname+u.search+'#environments');
}
async function json(path){if(!cache.has(path)){const r=await fetch(path);if(!r.ok)throw Error('Unavailable: '+path);cache.set(path,await r.json());}return cache.get(path);}
function pause(){++mediaTicket;cancelAnimationFrame(animation);const v=$('env-video');if(v){v.pause();v.removeAttribute('src');v.load();}}

function shell(){
  root.innerHTML=`<div class="library-heading"><div><span class="library-eyebrow">PRACTICAL DR-MDP</span><h1>Environments</h1><p class="library-subtitle">Simulation sources, return curves and recorded policies.</p></div><span class="review-status">November 4, 2026 release</span></div>
    <div class="env-counts"><span><strong>${library.entries.filter(e=>e.cohorts.length).length}</strong> with curves & metrics</span><span><strong>${library.entries.filter(e=>e.videoSelections).length}</strong> with linked recordings</span><span><strong>${library.entries.flatMap(e=>e.cohorts).length}</strong> separate cohorts</span></div>
    <div class="env-filters"><label>Find an environment<input id="env-search" type="search" placeholder="Task or simulator..."></label><label>Simulator<select id="env-source"><option value="all">All simulators</option>${[...new Set(library.entries.map(e=>e.simulator))].map(s=>`<option>${esc(s)}</option>`).join('')}</select></label><label>Study scope<select id="env-scope"><option value="all">All studies</option><option value="main">Main campaign</option><option value="pilot">Pilot</option><option value="development">Earlier development</option></select></label></div>
    <div class="env-layout"><aside class="env-directory" aria-label="Environment directory"><p id="env-matches" class="small"></p><div id="env-list"></div></aside><div id="env-detail" aria-live="polite"></div></div>
    <section class="env-incoming"><h2>Incoming datasets</h2><div><strong>Dataset A / Dataset B</strong><p>Pendulum / DoublePendulum attribution remains unconfirmed. Algorithm, simulator and row identities pending; not counted as independent 30-seed cohorts.</p><a href="reports/return-reliability/index.html">Return curves & advanced metrics ↗</a></div></section>`;
  $('env-search').oninput=directory;$('env-source').onchange=directory;$('env-scope').onchange=directory;
  directory();
}
function directory(){
  const entries=library.entries.filter(e=>belongsTo(e,$('env-search').value,$('env-source').value,$('env-scope').value));
  $('env-matches').textContent=entries.length+' task implementations';
  $('env-list').innerHTML=entries.map(e=>`<button class="env-entry" data-env="${e.id}" aria-pressed="${e===environment}"><strong>${esc(e.name)}</strong><span>${esc(e.simulator)}</span><small>${e.cohorts.length?e.cohorts.length+' cohorts':e.stage==='pilot'?'Pilot only':'Development only'} · ${e.videoSelections?'Recordings linked':e.recordingPending?'Recording pending':'No linked recordings'}</small></button>`).join('')||'<p class="env-unavailable">No matching environment.</p>';
  $('env-list').querySelectorAll('[data-env]').forEach(b=>b.onclick=()=>selectEnvironment(b.dataset.env));
  if(environment&&entries.length&&!entries.includes(environment))selectEnvironment(entries[0].id);
  if(!entries.length){pause();++ticket;$('env-detail').innerHTML='<p class="env-unavailable">No environment matches these filters.</p>';}
}
async function selectEnvironment(id,initial=false){
  pause();environment=library.entries.find(e=>e.id===id)||library.entries[0];cohort=null;axis=null;model=null;directory();
  const entry=environment;
  $('env-detail').innerHTML=`<header class="env-title"><div><h2>${esc(entry.name)}</h2><p>${esc(entry.framework)} <span aria-hidden="true">/</span> ${esc(entry.simulator)}</p></div><span class="env-stage">${entry.stage==='main'?'Main campaign':entry.stage==='pilot'?'Pilot':'Earlier development'}</span></header>
    <p class="env-task-id">${entry.taskIds.map(esc).join(' / ')}</p>
    ${entry.cohorts.length?`<div class="env-cohort-control"><label>Cohort<select id="env-cohort">${entry.cohorts.map(s=>`<option value="${s.id}">${esc(s.algorithm+'-'+s.family+' / '+s.environment+' / '+s.branch)}</option>`).join('')}</select></label><span id="env-coverage"></span></div><div id="env-results" role="status">Loading saved results...</div>`:
      `<div class="env-empty"><h3>${entry.stage==='pilot'?'Pilot, not a full-30 result':'No completed return export'}</h3><p>${esc(entry.note)}</p><dl><div><dt>Return curves</dt><dd>Not available in the validated library</dd></div><div><dt>Advanced metrics</dt><dd>No eligible policy-level export</dd></div><div><dt>Policy video</dt><dd>${entry.recordingPending?'Recording pending':'No linked recording'}</dd></div></dl></div>`}`;
  if(!entry.cohorts.length){++ticket;remember();return;}
  const requested=initial?query().get('cohort'):null;
  $('env-cohort').value=entry.cohorts.some(c=>c.id===requested)?requested:entry.preferred||entry.cohorts[0].id;
  $('env-cohort').onchange=()=>selectCohort($('env-cohort').value);
  await selectCohort($('env-cohort').value,initial);
}
async function selectCohort(id,initial=false){
  const job=++ticket;pause();cohort=environment.cohorts.find(s=>s.id===id);
  $('env-results').innerHTML='<p class="small" role="status">Loading saved results...</p>';
  try{
    const nextData=await json('data/'+cohort.id+'.json');
    const nextPolicy=await json('data/appendix/'+cohort.id+'.json');
    if(job!==ticket||location.hash!=='#environments')return;
    data=nextData;policy=nextPolicy;
    model=initial&&data.models.includes(query().get('parameter'))?query().get('parameter'):activeModel(data.models)||data.baseline;
    axis=data.axes.find(a=>a.id===(initial?query().get('shift'):null))||data.axes[0];
    $('env-coverage').textContent=`${cohort.models.length} settings · ${cohort.axisCount} axes · ${cohort.intendedPolicies} intended policies / setting${cohort.gridComplete===false?' · grid incomplete':''}`;
    $('env-results').innerHTML=`<div class="env-comparison-controls"><label>Setting<select id="env-setting">${data.models.map(m=>`<option value="${esc(m)}">${esc(label(m))}</option>`).join('')}</select></label><label>Perturbation<select id="env-shift">${data.axes.map(a=>`<option value="${a.id}">${esc(a.title)}</option>`).join('')}</select></label></div>
      <div class="env-plots"><section><div class="env-section-heading"><h3>Return curve</h3><a id="env-open-curves">All curves ↗</a></div><div id="env-curve"></div><div id="env-legend" class="env-legend"></div></section><section><div class="env-section-heading"><h3 id="env-metric-title">Return reliability</h3><a id="env-open-metrics">All metrics ↗</a></div><div id="env-reliability"></div><div id="env-metric-summary" class="env-metric-summary"></div></section></div>
      <p id="env-plot-note" class="env-evidence-note"></p>
      <section class="env-media"><div class="env-section-heading"><h3>Policy rollout</h3><a id="env-open-replay">Full rollout explorer ↗</a></div><div class="env-media-controls"><label>Recorded policy<select id="env-replay-model"></select></label><label>Recorded condition<select id="env-replay-point"></select></label></div><p id="env-media-status" role="status"></p><div id="env-media-body"><div><video id="env-video" playsinline muted controls preload="metadata" hidden aria-label="Same-cohort recorded policy"></video><label class="env-video-scrub" id="env-video-scrub" hidden>Episode<input id="env-video-frame" type="range" min="0" max="1" value="0" aria-label="Recorded episode frame"><output id="env-video-time"></output></label></div><div id="env-episode-trace"></div></div><p id="env-media-note" class="env-evidence-note"></p></section>
      <div class="env-artifacts"><a id="env-policies" download>Policy summaries CSV ↓</a><a id="env-figures">Saved PDF figures ↗</a>${cohort.archive?`<a href="${cohort.archive}" download>Overleaf package ↓</a>`:''}<a id="env-seeds">Training seeds ↗</a></div><details class="env-provenance"><summary>Cohort and interpretation</summary><p>${esc(data.note)}</p><p>Same setting across axes; sample SD, not a confidence interval. Return reliability is not physical task success. Failed runs receive no invented returns. Video coverage is cohort-specific.</p><code>${esc(data.id)}</code></details>`;
    $('env-setting').value=model;$('env-shift').value=axis.id;
    $('env-setting').onchange=()=>{model=$('env-setting').value;renderComparison();};
    $('env-shift').onchange=()=>{axis=data.axes.find(a=>a.id===$('env-shift').value);renderComparison();};
    renderComparison();
  }catch(e){if(job===ticket)$('env-results').innerHTML=`<p class="env-unavailable" role="alert">${esc(e.message)}</p>`;}
}
function renderComparison(){
  pause();remember();const models=[...new Set([data.baseline,model])];
  $('env-curve').innerHTML=previewChart(models.map(m=>({name:label(m),points:axis.curves[m].map(p=>({x:p.x,y:p.mean,sd:p.sd}))})),axisLabel(axis,data.environment),'Episode-mean return',{bands:true,nominal:axis.nominal});
  $('env-legend').innerHTML=models.map((m,i)=>`<span style="--series:${colors[i]}">${esc(label(m))}</span>`).join('');
  const summaries=models.map(m=>summarize(policy,m,data.baseline,'axis',axis.id));
  const normalized=summaries.every(s=>s.valid);
  const series=models.map(m=>({name:label(m),points:(normalized?normalizedSurvival(policy,m,data.baseline,'axis',axis.id):rawReliability(policy,m,data.baseline,'axis',axis.id)).points.map(([x,y])=>({x,y}))}));
  $('env-reliability').innerHTML=previewChart(series,normalized?'Retained-return threshold':'Native return threshold','Fraction of policies',{unit:true});
  $('env-metric-title').textContent=normalized?'Return reliability':'Native-return survival';
  $('env-metric-summary').innerHTML=summaries.map((s,i)=>`<div><span>${esc(label(models[i]))}</span><strong>${normalized?display(s.auc):display(s.raw)}</strong><small>${normalized?'Reliability AUC':'Mean shifted return'}</small></div>`).join('');
  const counts=models.flatMap(m=>axis.curves[m].map(p=>p.n));
  $('env-plot-note').textContent=(axis.warning?axis.warning+' ':'')+`Means and sample SD across policies (${Math.min(...counts)}–${Math.max(...counts)} measured per point; ${cohort.intendedPolicies} intended). Reliability weights shifted levels equally; nominal is excluded.`+(normalized?' Shared standard nominal reference.':' Normalized AUC is undefined for a nonpositive nominal reference; no offset is added.');
  $('env-open-curves').href=href('returns');$('env-open-metrics').href=href('advanced',normalized?{}:{metric:'raw'});
  $('env-policies').href='data/appendix/'+data.id+'.csv';$('env-figures').href=href('figures',{figureStudy:data.id});$('env-seeds').href=href('seeds');
  const recordedModels=[...new Set([model,data.baseline])];
  $('env-replay-model').innerHTML=recordedModels.map(m=>`<option value="${esc(m)}">${esc(label(m))} / same cohort</option>`).join('');
  $('env-replay-model').value=model;
  $('env-replay-model').onchange=recordings;
  recordings();
}
function recordings(){
  pause();const chosen=$('env-replay-model').value,points=axis.curves[chosen].filter(p=>data.replays?.[chosen]?.[axis.id+'|'+p.x]);
  $('env-open-replay').href=href('explore',{policy:chosen===data.baseline?'standard':'selected'});
  const chooser=$('env-replay-point');chooser.disabled=!points.length;
  chooser.innerHTML=points.length?points.map(p=>`<option value="${p.x}">${p.x}${p.x===axis.nominal?' / nominal':''}</option>`).join(''):'<option>No linked condition</option>';
  $('env-media-body').hidden=!points.length;
  if(!points.length){$('env-media-status').textContent='No matching recording for this policy and perturbation.';$('env-media-note').textContent=(cohort.videoSelections?'Other recorded selections exist in this cohort.':cohort.recordingPending?'Recording pending for this new cohort.':'No recorded rollout is linked to this cohort.')+' No different cohort, task-reference animation or synthetic policy video is substituted.';return;}
  if(points.some(p=>p.x===axis.nominal))chooser.value=String(axis.nominal);
  chooser.onchange=loadVideo;loadVideo();
}
async function loadVideo(){
  pause();const job=mediaTicket,chosen=$('env-replay-model').value,value=Number($('env-replay-point').value);
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
    $('env-media-note').textContent=(replay.interpretation||'Illustrative saved-policy recording, not a cohort mean.')+' Exact cohort, policy and condition retained. Physical success is not inferred from playback.';
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
  try{library=await json('data/environments.json');shell();await selectEnvironment(query().get('environment')||'walker',true);}
  catch(e){root.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}
}
if(root){
  window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
  window.addEventListener('results-context',e=>{
    if(e.detail.page==='environments'&&root.dataset.active!=='1')route();
    else if(e.detail.page!=='environments'&&root.dataset.active==='1'){root.dataset.active='0';pause();++ticket;}
  });
  if(location.hash==='#environments'||(!location.hash&&!query().has('study')))route();
}
