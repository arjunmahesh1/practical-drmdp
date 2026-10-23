import {baselineColor,robustColor,fmt,escape as esc,label,activeModel,nearestPoint,bounds,factorLabel,gridMean,bestModelOnAxis,axisLabel,recordingCount} from './model.mjs?v=20261023-morepolicies1';
import {episodeTraceSVG} from './replay-chart.mjs?v=20261023-replayaxes1';
import {environments,parameterNote} from './environments.mjs';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const build='20261023-morepolicies1';
const cache=new Map();
const state={catalog:null,study:null,axis:null,model:null,selection:'fixed',allSettings:params.get('all')==='1',index:0,page:location.hash.slice(1)||'explore',bands:true,replay:null,replayPolicy:params.get('policy')==='standard'?'standard':'selected',playbackWanted:true,playing:false,frame:0};
let pendingStudy=0, pendingReplay=0, lastFrame=0, animation;
const group=env=>env.split('-v')[0];
const points=()=>state.axis.curves[state.study.baseline];
const selectedPoint=()=>state.axis.curves[state.model][state.index];
const modelForAxis=axis=>state.selection==='best'?bestModelOnAxis(state.study,axis):state.model;
const chartLayout=mini=>mini?{W:400,H:280,L:76,R:22,T:16,B:66}:{W:600,H:365,L:82,R:22,T:22,B:60};
function curveColor(model,selected,all=false){
  if(model===state.study.baseline)return baselineColor;
  if(model===selected)return robustColor;
  const palette=['#36816c','#92569b','#ad7a20','#587bba','#b94d72','#666e4a'];
  return all?palette[state.study.models.indexOf(model)%palette.length]:'#8f9c96';
}

function options(id, entries, value) {
  $(id).replaceChildren(...entries.map(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;return o;}));
  $(id).value=value;
}
function unique(values){return [...new Set(values)];}
function candidates(filters){return state.catalog.studies.filter(s=>Object.entries(filters).every(([k,v])=>s[k]===v));}
function updateVariantControl(){
  const best=bestModelOnAxis(state.study,state.axis);
  const entries=state.study.models.filter(m=>m!==state.study.baseline).map(m=>[m,label(m)+(m===best?' · best on this axis':'')]);
  if(best)entries.unshift(['best','Best on this axis · '+label(best)]);
  options('variant',entries,state.selection==='best'?'best':state.model);
}
function updateControls() {
  const s=state.study;
  const sameEnvGroup=state.catalog.studies.filter(x=>group(x.environment)===group(s.environment));
  options('version',unique(sameEnvGroup.map(x=>x.environment)).map(v=>[v,v]),s.environment);
  options('algorithm',unique(candidates({environment:s.environment}).map(x=>x.algorithm)).map(v=>[v,v]),s.algorithm);
  options('family',unique(candidates({environment:s.environment,algorithm:s.algorithm}).map(x=>x.family)).map(v=>[v,v==='TV'?'TV · total variation':'KL · relative entropy']),s.family);
  const branches=candidates({environment:s.environment,algorithm:s.algorithm,family:s.family});
  options('branch',branches.map(v=>[v.id,v.branch]),s.id);
  $('branch-label').hidden=branches.length===1;
  updateVariantControl();
  options('axis',s.axes.map(a=>[a.id,a.title]),state.axis.id);
  $('env-tabs').replaceChildren(...unique(state.catalog.studies.map(s=>group(s.environment))).map(name=>{
    const b=document.createElement('button');b.textContent=name;b.className=name===group(s.environment)?'active':'';b.setAttribute('aria-pressed',String(name===group(s.environment)));
    b.onclick=()=>{const next=state.catalog.studies.filter(x=>group(x.environment)===name);chooseStudy((next.find(x=>x.algorithm===s.algorithm&&x.family===s.family)||next[0]).id);};return b;
  }));
}
async function chooseStudy(id, initial=false) {
  const ticket=++pendingStudy;
  $('loading').hidden=false;
  try {
    if(!cache.has(id)){const r=await fetch('data/'+id+'.json?v='+build);if(!r.ok)throw Error('Could not load '+id);cache.set(id,await r.json());}
    if(ticket!==pendingStudy)return;
    const previous=state.axis?.id;
    state.study=cache.get(id);
    state.model=initial&&state.study.models.includes(params.get('setting'))?params.get('setting'):activeModel(state.study.models);
    state.axis=state.study.axes.find(a=>a.id===(initial?params.get('axis'):previous))||state.study.axes[0];
    if(initial)state.selection=params.get('setting')==='best'?'best':'fixed';
    if(state.selection==='best')state.model=bestModelOnAxis(state.study,state.axis);
    const n=Number(params.get('point'));
    state.index=initial&&params.has('point')&&Number.isInteger(n)?Math.max(0,Math.min(n,points().length-1)):nearestPoint(points(),state.axis.nominal);
    updateControls();$('loading').hidden=true;showPage();renderAll();
  }catch(error){$('loading').textContent=error.message;console.error(error);}
}
function chooseAxis(id) {
  state.axis=state.study.axes.find(a=>a.id===id);state.index=nearestPoint(points(),state.axis.nominal);
  $('axis').value=id;renderAll();
}
function chooseModel(model) {
  if(model===state.study.baseline)return;
  state.selection=model==='best'?'best':'fixed';
  state.model=model==='best'?bestModelOnAxis(state.study,state.axis):model;renderAll();
}
function syncURL() {
  const u=new URL(location.href);
  u.search=new URLSearchParams({study:state.study.id,axis:state.axis.id,setting:state.selection==='best'?'best':state.model,point:state.index}).toString();u.hash=state.page;
  if(state.allSettings)u.searchParams.set('all','1');
  if(state.replayPolicy==='standard')u.searchParams.set('policy','standard');
  history.replaceState(null,'',u);
}
function showPage(){
  if(!['explore','returns','methods'].includes(state.page))state.page='explore';
  for(const p of ['explore','returns','methods'])$(p+'-page').hidden=p!==state.page||!state.study;
  document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('active',a.dataset.page===state.page);if(a.dataset.page===state.page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(state.study)syncURL();
  if(state.page!=='explore')stopReplay();
  else if(state.replay?.kind==='video'&&state.playbackWanted)$('rollout-video').play().catch(()=>{});
}
function renderAll(){
  if(state.selection==='best')state.model=bestModelOnAxis(state.study,state.axis);
  updateVariantControl();
  options('axis',state.study.axes.map(a=>[a.id,a.title]),state.axis.id);
  const replayModel=state.replayPolicy==='standard'?state.study.baseline:state.model;
  $('axis-playback-label').textContent='Perturbation · '+recordingCount(state.study,state.axis,replayModel)+'/'+state.axis.curves[replayModel].length+' recorded';
  renderChart();renderLegend();renderPoint();renderGallery();renderTable();
  const best=bestModelOnAxis(state.study,state.axis);
  $('select-best').textContent=best?'Select best: '+label(best):'No active setting';$('select-best').disabled=!best;$('select-best').setAttribute('aria-pressed',String(state.selection==='best'));
  $('selection-note').textContent=best?'Best on this axis: '+label(best)+' · mean over displayed grid '+fmt(gridMean(state.axis.curves[best]),2)+'. Selected ex post from active settings, not held-out evidence.':'';
  $('all-settings').checked=state.allSettings;
  $('returns-description').textContent=state.allSettings?'All evaluated settings, with mean ±1 across-policy SD. The table below retains the selected comparison.':state.selection==='best'?'Each axis uses its own ex-post best active setting, named in the panel and table. This is not one fixed policy across all perturbations. Bands show ±1 across-policy SD where enabled.':'Mean episode return across trained policies, with ±1 SD bands where enabled. The same selected setting is held fixed across these axes.';
  $('study-note').textContent=state.study.note;
  $('source-note').textContent=state.study.statistic+' Source: '+state.study.source;
  $('scene-title').textContent=state.study.environment;
  $('replay-policy').options[0].textContent=label(state.model);
  $('replay-policy').value=state.replayPolicy;
  $('parameter-note').textContent=parameterNote(state.study.environment,state.axis.id);
  syncURL();loadReplay();
}
function svgChart(axis,mini=false,all=false){
  const {W,H,L,R,T,B}=chartLayout(mini),selected=modelForAxis(axis);
  const grid=axis.curves[state.study.baseline],xmin=grid[0].x,xmax=grid.at(-1).x,[ymin,ymax]=bounds(axis,mini?false:all||state.bands);
  const x=v=>L+(v-xmin)/(xmax-xmin||1)*(W-L-R),y=v=>H-B-(v-ymin)/(ymax-ymin)*(H-B-T);
  const pos=axis.id===state.axis.id?state.index:nearestPoint(grid,axis.nominal);
  let parts=[`<svg class="curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(axis.title)}: measured evaluation returns"><title>${esc(axis.title)} · blue standard, orange ${esc(label(selected))}</title>`];
  const tickCount=mini?3:4;
  for(let i=0;i<tickCount;i++){const v=ymin+(ymax-ymin)*i/(tickCount-1),yy=y(v);parts.push(`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#e7eae3"/><text x="${L-8}" y="${yy+5}" text-anchor="end" fill="#6b746d" font-size="16" font-family="Roboto,Arial">${fmt(v,ymax-ymin<3?2:0)}</text>`);}
  parts.push(`<path class="axis-spine" d="M${L},${T}V${H-B}H${W-R}" fill="none" stroke="#929d9f" stroke-width="1"/>`);
  const nominalX=x(axis.nominal);
  if(axis.nominal>=xmin&&axis.nominal<=xmax){parts.push(`<line x1="${nominalX}" x2="${nominalX}" y1="${T}" y2="${H-B}" stroke="#9caaa0" stroke-dasharray="4 4"/>`);if(!mini)parts.push(`<text x="${Math.min(nominalX+5,W-70)}" y="${T-7}" fill="#7c887f" font-size="10">nominal</text>`);}
  const models=state.study.models.filter(m=>m!==state.study.baseline&&m!==selected).concat(state.study.baseline,selected);
  for(const model of models){
    const ps=axis.curves[model],chosen=all||model===state.study.baseline||model===selected,color=curveColor(model,selected,all);
    if(!mini&&(all||state.bands)&&chosen){const d=ps.map(p=>[x(p.x),y(p.mean+p.sd)]).concat([...ps].reverse().map(p=>[x(p.x),y(p.mean-p.sd)])).map(p=>p.join(',')).join(' ');parts.push(`<polygon data-band="${esc(model)}" points="${d}" fill="${color}" opacity=".08"/>`);}
    parts.push(`<path data-model="${esc(model)}" d="${ps.map((p,i)=>(i?'L':'M')+x(p.x)+','+y(p.mean)).join(' ')}" fill="none" stroke="${color}" stroke-width="${chosen?(mini?2.5:3):1.3}" opacity="${chosen?1:.19}" stroke-linejoin="round"/>`);
    if(chosen&&!mini){for(const p of ps)parts.push(`<circle cx="${x(p.x)}" cy="${y(p.mean)}" r="3" fill="${color}"><title>${esc(label(model))} · ${p.x}: ${fmt(p.mean)} ± ${fmt(p.sd)} SD; n=${p.n}</title></circle>`);const p=ps[pos];parts.push(`<circle data-marker="${esc(model)}" cx="${x(p.x)}" cy="${y(p.mean)}" r="6.1" fill="${color}" stroke="white" stroke-width="2.5"/>`);}
  }
  if(!mini){const xx=x(grid[pos].x);parts.push(`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${H-B}" stroke="#607168" opacity=".4" stroke-dasharray="2 4"/>`);}
  const ticks=!mini&&grid.length<=7?grid:grid.filter((p,i)=>i===0||i===grid.length-1||i===Math.floor(grid.length/2));
  for(const p of ticks)parts.push(`<text x="${x(p.x)}" y="${H-B+23}" text-anchor="middle" fill="#6b746d" font-size="16">${fmt(p.x,2)}</text>`);
  parts.push(`<text class="x-axis-label" x="${(L+W-R)/2}" y="${H-12}" text-anchor="middle" fill="#56656b" font-size="16">${esc(axisLabel(axis,state.study.environment))}</text>`);
  parts.push(`<text class="y-axis-label" transform="translate(18 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle" fill="#56656b" font-size="16">Evaluation return</text>`);
  parts.push('</svg>');return parts.join('');
}
function renderChart(){
  $('chart').innerHTML=svgChart(state.axis);
  const svg=$('chart').querySelector('svg');
  svg.onclick=e=>{const {W,L,R}=chartLayout(false),rect=svg.getBoundingClientRect(),v=(e.clientX-rect.left)/rect.width*W;const grid=points(),x=grid[0].x+(v-L)/(W-L-R)*(grid.at(-1).x-grid[0].x);setPoint(nearestPoint(grid,x));};
}
function renderLegend(){
  const best=bestModelOnAxis(state.study,state.axis);
  $('legend').replaceChildren(...state.study.models.map(model=>{const b=document.createElement('button');b.textContent=label(model)+(model===best?' · best':'');b.title=model===best?'Highest mean return over this axis’s full displayed grid (ex post)':label(model);b.className=model===state.study.baseline?'fixed':model===state.model?'active':'';b.setAttribute('aria-pressed',String(model===state.model||model===state.study.baseline));b.onclick=()=>chooseModel(model);return b;}));
}
function renderPoint(){
  const a=state.axis,b=points()[state.index],r=selectedPoint();
  $('severity').max=points().length-1;$('severity').value=state.index;$('severity').setAttribute('aria-valuetext',a.title+' '+factorLabel(a,b.x,state.study.environment));
  $('factor').textContent=factorLabel(a,b.x,state.study.environment);$('factor-label').textContent=b.x===a.nominal?'Nominal condition':'Measured condition';
  $('range-min').textContent=factorLabel(a,points()[0].x,state.study.environment);$('range-max').textContent=factorLabel(a,points().at(-1).x,state.study.environment);
  $('nominal').disabled=!points().some(p=>p.x===a.nominal);
  $('nominal').textContent=$('nominal').disabled?'Nominal not measured':'Nominal ↺';
  $('standard-return').textContent=fmt(b.mean);$('robust-return').textContent=fmt(r.mean);$('selected-label').textContent=label(state.model);
  const d=r.mean-b.mean;$('difference').textContent=(d>=0?'+':'−')+fmt(Math.abs(d));
  $('sample-note').textContent=`${b.n} standard policies · ${r.n} selected policies at this point. Bands describe policy variability.`+(Math.min(b.n,r.n)<30?' Measured finals only; failed seeds are not imputed.':'');
}
function setPoint(i){
  state.index=Math.max(0,Math.min(Number(i),points().length-1));renderChart();renderPoint();syncURL();loadReplay();
}
function renderGallery(){
  const available=state.study.axes.reduce((n,a)=>n+recordingCount(state.study,a,modelForAxis(a)),0),total=state.study.axes.reduce((n,a)=>n+a.curves[modelForAxis(a)].length,0);
  $('axis-count').textContent=state.study.axes.length+' axes · '+available+'/'+total+' recordings for '+(state.selection==='best'?'axis-specific best settings':label(state.model));
  $('axis-gallery').replaceChildren(...state.study.axes.map(axis=>{const b=document.createElement('button');b.className='mini-axis'+(axis.id===state.axis.id?' active':'');b.innerHTML='<h3>'+esc(axis.title)+'</h3>'+svgChart(axis,true)+'<p class="mini-setting">'+esc(label(modelForAxis(axis)))+(state.selection==='best'?' · best on this axis':'')+'</p>';b.setAttribute('aria-label','View '+axis.title);b.onclick=()=>{chooseAxis(axis.id);$('axis').focus();};return b;}));
  const query=$('search').value.toLowerCase();
  $('returns-gallery').replaceChildren(...state.study.axes.filter(a=>(a.title+' '+a.id).toLowerCase().includes(query)).map(axis=>{const model=modelForAxis(axis),item=document.createElement('article');item.className='return-axis';const legend=state.allSettings?'<div class="return-legend">'+state.study.models.map(m=>'<span style="color:'+curveColor(m,model,true)+'">'+esc(label(m))+'</span>').join('')+'</div>':'';item.innerHTML='<h3>'+esc(axis.title)+'</h3>'+svgChart(axis,false,state.allSettings)+legend+'<p class="small">'+(state.allSettings?'All settings · mean ±1 across-policy SD':esc(label(model))+' versus standard'+(state.selection==='best'?' · best on this axis (ex post)':'')+' · '+axis.curves[model][0].n+' measured policies at the first grid point')+'</p>';return item;}));
}
function renderTable(){
  const query=$('search').value.toLowerCase(),fragment=document.createDocumentFragment();
  for(const a of state.study.axes){if(!a.title.toLowerCase().includes(query)&&!a.id.toLowerCase().includes(query))continue;const model=modelForAxis(a),bs=a.curves[state.study.baseline],rs=a.curves[model];
    for(let i=0;i<bs.length;i++){const b=bs[i],r=rs[i],tr=document.createElement('tr'),values=[a.title,factorLabel(a,b.x,state.study.environment),label(model),fmt(b.mean),fmt(r.mean),(r.mean-b.mean>=0?'+':'')+fmt(r.mean-b.mean),b.n+' / '+r.n];for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}tr.tabIndex=0;tr.setAttribute('aria-label',a.title+' '+b.x+'; open comparison');const open=()=>{state.page='explore';chooseAxis(a.id);setPoint(i);showPage();$('severity').focus();};tr.onclick=open;tr.onkeydown=e=>{if(e.key==='Enter')open();};fragment.append(tr);}}
  $('returns-table').querySelector('tbody').replaceChildren(fragment);
}
function renderPaper(){
  const query=$('paper-search').value.toLowerCase();$('paper-count').textContent='· '+state.catalog.gallery.length+' panels';
  $('paper-gallery').replaceChildren(...state.catalog.gallery.filter(p=>(p.section+' '+p.title+' '+p.source).toLowerCase().includes(query)).map(p=>{const a=document.createElement('a');a.href=p.pdf;a.target='_blank';a.rel='noopener';a.className='paper-link';const title=document.createElement('strong');title.textContent=p.title;const sub=document.createElement('small');sub.textContent=p.section+' · PDF ↗';a.append(title,sub);return a;}));
}
function stopReplay(){state.playing=false;cancelAnimationFrame(animation);$('rollout-video').pause();$('play').textContent='▶';$('play').setAttribute('aria-label','Play recorded-policy replay');}
function syncVideo(){
  const r=state.replay;if(r?.kind!=='video')return;
  state.frame=Math.min(r.timeline.length-1,Math.floor($('rollout-video').currentTime*r.fps));
  $('frame').value=state.frame;
  const f=r.timeline[state.frame];$('frame-label').textContent=fmt(f.time,1)+' s · episode R '+fmt(f.reward,1);
  const color=state.replayPolicy==='standard'?baselineColor:robustColor;
  $('episode-trace').innerHTML=episodeTraceSVG(r.timeline,state.frame,color,$('episode-trace').clientWidth<460);
}
window.addEventListener('resize',syncVideo);
async function loadReplay(){
  const ticket=++pendingReplay;stopReplay();state.replay=null;state.frame=0;
  const video=$('rollout-video');video.onerror=null;video.onloadedmetadata=null;video.hidden=true;video.removeAttribute('src');video.load();$('episode-trace').hidden=true;
  const factor=points()[state.index].x,key=state.axis.id+'|'+factor;
  const replayModel=state.replayPolicy==='standard'?state.study.baseline:state.model;
  const entry=state.study.replays?.[replayModel]?.[key];
  $('play').disabled=true;$('frame').disabled=true;$('frame').value=0;
  const media=environments[group(state.study.environment)];
  $('task-image').hidden=Boolean(entry)||!media;
  $('replay-canvas').hidden=!entry&&Boolean(media);
  $('task-credit').hidden=Boolean(entry)||!media;
  if(media){if($('task-image').getAttribute('src')!==media.image)$('task-image').src=media.image;$('task-image').alt=state.study.environment+' task reference from official documentation, not our evaluated policy';$('task-credit').textContent=media.credit+' ↗';$('task-credit').href=media.url;}
  if(!entry){
    $('playback-status').textContent='Task reference · no linked rollout';$('scene-tag').textContent=state.study.environment+' · '+state.axis.title;
    $('scene-explanation').textContent='Reference image only. Not our policy and not a preview of the selected perturbation.';
    $('scene-note').textContent='Return markers use the saved evaluation data. Matching episode trajectories or videos have not been linked; the task reference does not change with severity.';
    $('frame-label').textContent='No linked trajectory';drawScene();return;
  }
  $('playback-status').textContent='Loading checkpoint replay…';
  try{const r=await fetch(entry);if(!r.ok)throw Error('Replay unavailable');const replay=await r.json();if(ticket!==pendingReplay)return;state.replay=replay;
    if(replay.kind==='video'){
      video.hidden=false;$('replay-canvas').hidden=true;$('task-image').hidden=true;
      $('playback-status').textContent='Recorded paper checkpoint';$('scene-tag').textContent=label(replayModel)+' · training seed '+replay.trainingSeed;
      $('scene-explanation').textContent='Episode seed '+replay.episodeSeed+' · return '+fmt(replay.returnValue)+'. '+state.axis.title+' '+factorLabel(state.axis,factor,state.study.environment)+'.';
      $('scene-note').textContent='New deterministic replay of the selected trained checkpoint, '+(replay.normalizationMode==='none'?'with raw observations as in its original evaluation.':'with frozen normalization.')+' One fixed training/episode seed, not the cohort mean. '+(replay.referenceMatched?'Archived episode return reproduced within tolerance.':replay.referenceEpisodeAvailable?'The replay return differs from the archived episode; it does not replace the saved result.':'The original episode-level return was not available for exact comparison.')+' The main graph retains the original evaluation means.';
      $('play').disabled=false;$('frame').disabled=false;$('frame').max=replay.timeline.length-1;$('episode-trace').hidden=false;
      video.onloadedmetadata=()=>{if(ticket!==pendingReplay)return;syncVideo();if(state.playbackWanted&&state.page==='explore')video.play().catch(()=>{});};
      video.onerror=()=>{if(ticket!==pendingReplay)return;stopReplay();$('play').disabled=true;$('frame').disabled=true;$('playback-status').textContent='Recording could not load';$('scene-note').textContent='The matching video could not be loaded. No other policy or severity has been substituted.';};
      video.src=replay.video;video.load();return;
    }
    $('playback-status').textContent='Saved-policy replay';$('scene-tag').textContent=label(state.model)+' · training seed '+replay.trainingSeed;
    $('scene-explanation').textContent='Episode '+replay.episodeSeed+' · return '+fmt(replay.return)+'. A checkpoint illustration; the plot uses the original evaluation cohort.';
    $('scene-note').textContent='Re-rendered from the saved checkpoint with frozen normalization and the recorded perturbation. Playback is one illustrative episode, not the policy-average curve. '+(replay.referenceMatched?'Episode return reproduced the archived evaluation within tolerance.':'This local replay is not certified identical to the archived episode.');
    $('play').disabled=false;$('frame').disabled=false;$('frame').max=replay.frames.length-1;drawScene();
  }catch(error){if(ticket===pendingReplay){$('playback-status').textContent='Replay unavailable';$('scene-note').textContent=error.message;drawScene();}}
}
function drawScene(){
  const canvas=$('replay-canvas'),ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#edf0e8';ctx.fillRect(0,0,W,H);
  if(state.replay){const r=state.replay,f=r.frames[state.frame];ctx.save();ctx.translate(0,H);ctx.scale(W/20,-H/(400/30));
    ctx.fillStyle='#d0d7c5';ctx.beginPath();r.terrain.forEach((p,i)=>{if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.lineTo(20,0);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
    const colors=[state.model===state.study.baseline?baselineColor:robustColor,'#65705d','#65705d'];
    f.bodies.forEach((poly,j)=>{ctx.beginPath();poly.forEach((p,i)=>{if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.closePath();ctx.fillStyle=colors[j%3];ctx.fill();ctx.strokeStyle='#303c32';ctx.lineWidth=.025;ctx.stroke();});
    ctx.restore();ctx.fillStyle='#637361';ctx.font='15px Roboto,Arial';ctx.fillText('H',W*.5-5,H-r.padY/(400/30)*H-10);
    $('frame-label').textContent=fmt(f.step/50,1)+' s · R '+fmt(f.reward,0);
  }else{drawSchematic(ctx,W,H);}
}
function drawSchematic(ctx,W,H){
  ctx.strokeStyle='#d8dfd0';ctx.lineWidth=1;for(let x=0;x<W;x+=45){ctx.beginPath();ctx.moveTo(x,H*.57);ctx.lineTo(x+W*.3,H);ctx.stroke();}for(let y=H*.65;y<H;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  const env=state.study.environment;ctx.lineCap='round';ctx.lineJoin='round';
  if(env.startsWith('Walker')||env.startsWith('HalfCheetah')){
    const line=(p,c,w)=>{ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(W*x,H*y):ctx.moveTo(W*x,H*y));ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();};
    if(env.startsWith('Walker')){line([[.47,.25],[.49,.46]],baselineColor,23);line([[.49,.46],[.42,.63],[.43,.8],[.38,.8]],'#778b74',15);line([[.49,.46],[.56,.64],[.55,.8],[.61,.8]],baselineColor,15);}
    else{line([[.31,.4],[.62,.4],[.69,.29]],baselineColor,23);line([[.34,.42],[.27,.59],[.32,.72],[.25,.74]],'#778b74',14);line([[.59,.41],[.67,.55],[.64,.72],[.72,.74]],baselineColor,14);}
  }else if(env.startsWith('PickCube')||env.startsWith('Pusher')){
    ctx.fillStyle='#d9dfce';ctx.fillRect(W*.2,H*.58,W*.6,H*.2);ctx.strokeStyle=baselineColor;ctx.lineWidth=24;ctx.beginPath();ctx.moveTo(W*.3,H*.62);ctx.lineTo(W*.37,H*.25);ctx.lineTo(W*.57,H*.42);ctx.lineTo(W*.58,H*.56);ctx.stroke();ctx.fillStyle=robustColor;ctx.fillRect(W*.57,H*.56,W*.055,H*.07);ctx.strokeStyle='#8ca378';ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.strokeRect(W*.69,H*.48,W*.07,H*.1);ctx.setLineDash([]);
  }else{ctx.save();ctx.translate(W*.52,H*.42);ctx.fillStyle=baselineColor;ctx.beginPath();ctx.moveTo(-30,-25);ctx.lineTo(30,-25);ctx.lineTo(42,20);ctx.lineTo(-42,20);ctx.closePath();ctx.fill();ctx.strokeStyle=baselineColor;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-30,10);ctx.lineTo(-55,45);ctx.moveTo(30,10);ctx.lineTo(55,45);ctx.stroke();ctx.restore();}
  ctx.fillStyle='#899784';ctx.font='14px Roboto,Arial';ctx.textAlign='center';ctx.fillText('TASK SCHEMATIC · NOT A POLICY TRAJECTORY',W*.5,H*.9);ctx.textAlign='left';
}
function animate(timestamp){if(!state.playing||!state.replay)return;if(timestamp-lastFrame>=80){state.frame=(state.frame+1)%state.replay.frames.length;$('frame').value=state.frame;drawScene();lastFrame=timestamp;}animation=requestAnimationFrame(animate);}

$('version').onchange=e=>chooseStudy((candidates({environment:e.target.value}).find(s=>s.algorithm===state.study.algorithm&&s.family===state.study.family)||candidates({environment:e.target.value})[0]).id);
$('algorithm').onchange=e=>chooseStudy((candidates({environment:state.study.environment,algorithm:e.target.value}).find(s=>s.family===state.study.family)||candidates({environment:state.study.environment,algorithm:e.target.value})[0]).id);
$('family').onchange=e=>chooseStudy(candidates({environment:state.study.environment,algorithm:state.study.algorithm,family:e.target.value})[0].id);
$('branch').onchange=e=>chooseStudy(e.target.value);$('variant').onchange=e=>chooseModel(e.target.value);$('axis').onchange=e=>chooseAxis(e.target.value);
$('select-best').onclick=()=>chooseModel('best');$('all-settings').onchange=e=>{state.allSettings=e.target.checked;renderAll();};
$('severity').oninput=e=>setPoint(e.target.value);$('nominal').onclick=()=>setPoint(nearestPoint(points(),state.axis.nominal));$('bands').onchange=e=>{state.bands=e.target.checked;renderChart();renderGallery();};
$('search').oninput=()=>{renderTable();renderGallery();};$('paper-search').oninput=renderPaper;
$('play').onclick=()=>{if(state.replay?.kind==='video'){const v=$('rollout-video');state.playbackWanted=v.paused;if(v.paused)v.play().catch(()=>{});else v.pause();return;}if(state.playing)stopReplay();else{state.playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause recorded-policy replay');lastFrame=0;animation=requestAnimationFrame(animate);}};
$('frame').oninput=e=>{stopReplay();state.playbackWanted=false;state.frame=Number(e.target.value);if(state.replay?.kind==='video'){$('rollout-video').currentTime=state.frame/state.replay.fps;syncVideo();}else drawScene();};
$('replay-policy').onchange=e=>{state.replayPolicy=e.target.value;renderAll();};
$('rollout-video').ontimeupdate=syncVideo;$('rollout-video').onseeked=syncVideo;
$('rollout-video').onplay=()=>{state.playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause recorded-policy replay');};
$('rollout-video').onpause=()=>{state.playing=false;$('play').textContent='▶';$('play').setAttribute('aria-label','Play recorded-policy replay');};
window.addEventListener('hashchange',()=>{state.page=location.hash.slice(1);showPage();});
document.querySelectorAll('[data-page]').forEach(a=>a.onclick=()=>{state.page=a.dataset.page;showPage();});
$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('toast').textContent='Comparison link copied';$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),2000);}catch{$('toast').textContent='Copy the current address to share this comparison';$('toast').classList.add('visible');}};
$('download').onclick=()=>{const rows=[['study','environment','algorithm','family','setting','axis','value','mean_return','sample_sd','measured_policies']];for(const [model,ps] of Object.entries(state.axis.curves))for(const p of ps)rows.push([state.study.id,state.study.environment,state.study.algorithm,state.study.family,model,state.axis.id,p.x,p.mean,p.sd,p.n]);const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=u;a.download=state.study.id+'-'+state.axis.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),200);};

try{
  const r=await fetch('data/catalog.json?v='+build);if(!r.ok)throw Error('Could not load the saved result catalog');state.catalog=await r.json();
  $('catalog-summary').textContent=`${state.catalog.studies.length} saved study groups · ${state.catalog.studies.reduce((n,s)=>n+s.axisCount,0)} perturbation axes · exported ${state.catalog.updated}.`;
  $('sources').replaceChildren(...state.catalog.sources.map(source=>{const row=document.createElement('div');row.className='source-row';row.textContent=source.path;const hash=document.createElement('span');hash.textContent='SHA256 '+source.sha256;row.append(hash);return row;}));
  renderPaper();const initial=state.catalog.studies.find(s=>s.id===params.get('study'))?.id||'ppo_tv_pickcube';await chooseStudy(initial,true);
}catch(error){$('loading').textContent='Results could not be loaded. '+error.message;console.error(error);}
