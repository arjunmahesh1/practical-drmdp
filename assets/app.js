import {baselineColor,robustColor,fmt,escape as esc,label,activeModel,nearestPoint,bounds,factorLabel} from './model.mjs';
import {environments,parameterNote} from './environments.mjs';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const cache=new Map();
const state={catalog:null,study:null,axis:null,model:null,index:0,page:location.hash.slice(1)||'explore',bands:true,replay:null,playing:false,frame:0};
let pendingStudy=0, pendingReplay=0, lastFrame=0, animation;
const group=env=>env.split('-v')[0];
const points=()=>state.axis.curves[state.study.baseline];
const selectedPoint=()=>state.axis.curves[state.model][state.index];

function options(id, entries, value) {
  $(id).replaceChildren(...entries.map(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;return o;}));
  $(id).value=value;
}
function unique(values){return [...new Set(values)];}
function candidates(filters){return state.catalog.studies.filter(s=>Object.entries(filters).every(([k,v])=>s[k]===v));}
function updateControls() {
  const s=state.study;
  const sameEnvGroup=state.catalog.studies.filter(x=>group(x.environment)===group(s.environment));
  options('version',unique(sameEnvGroup.map(x=>x.environment)).map(v=>[v,v]),s.environment);
  options('algorithm',unique(candidates({environment:s.environment}).map(x=>x.algorithm)).map(v=>[v,v]),s.algorithm);
  options('family',unique(candidates({environment:s.environment,algorithm:s.algorithm}).map(x=>x.family)).map(v=>[v,v==='TV'?'TV · total variation':'KL · relative entropy']),s.family);
  const branches=candidates({environment:s.environment,algorithm:s.algorithm,family:s.family});
  options('branch',branches.map(v=>[v.id,v.branch]),s.id);
  $('branch-label').hidden=branches.length===1;
  options('variant',s.models.filter(m=>m!==s.baseline).map(m=>[m,label(m)]),state.model);
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
    if(!cache.has(id)){const r=await fetch('data/'+id+'.json');if(!r.ok)throw Error('Could not load '+id);cache.set(id,await r.json());}
    if(ticket!==pendingStudy)return;
    const previous=state.axis?.id;
    state.study=cache.get(id);
    state.model=initial&&state.study.models.includes(params.get('setting'))?params.get('setting'):activeModel(state.study.models);
    state.axis=state.study.axes.find(a=>a.id===(initial?params.get('axis'):previous))||state.study.axes[0];
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
  state.model=model;$('variant').value=model;renderAll();
}
function syncURL() {
  const u=new URL(location.href);
  u.search=new URLSearchParams({study:state.study.id,axis:state.axis.id,setting:state.model,point:state.index}).toString();u.hash=state.page;
  history.replaceState(null,'',u);
}
function showPage(){
  if(!['explore','returns','methods'].includes(state.page))state.page='explore';
  for(const p of ['explore','returns','methods'])$(p+'-page').hidden=p!==state.page||!state.study;
  document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('active',a.dataset.page===state.page);if(a.dataset.page===state.page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(state.study)syncURL();
}
function renderAll(){
  renderChart();renderLegend();renderPoint();renderGallery();renderTable();
  $('study-note').textContent=state.study.note;
  $('source-note').textContent=state.study.statistic+' Source: '+state.study.source;
  $('scene-title').textContent=state.study.environment;
  $('parameter-note').textContent=parameterNote(state.study.environment,state.axis.id);
  syncURL();loadReplay();
}
function svgChart(axis,mini=false){
  const W=600,H=mini?235:365,L=mini?46:62,R=15,T=mini?15:22,B=mini?37:51;
  const grid=axis.curves[state.study.baseline],xmin=grid[0].x,xmax=grid.at(-1).x,[ymin,ymax]=bounds(axis,mini?false:state.bands);
  const x=v=>L+(v-xmin)/(xmax-xmin||1)*(W-L-R),y=v=>H-B-(v-ymin)/(ymax-ymin)*(H-B-T);
  const pos=axis.id===state.axis.id?state.index:nearestPoint(grid,axis.nominal);
  let parts=[`<svg class="curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(axis.title)}: measured evaluation returns"><title>${esc(axis.title)} · blue standard, orange ${esc(label(state.model))}</title>`];
  for(let i=0;i<4;i++){const v=ymin+(ymax-ymin)*i/3,yy=y(v);parts.push(`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#e7eae3"/>`);if(!mini)parts.push(`<text x="${L-9}" y="${yy+4}" text-anchor="end" fill="#6b746d" font-size="16" font-family="Roboto,Arial">${fmt(v,0)}</text>`);}
  const nominalX=x(axis.nominal);
  if(axis.nominal>=xmin&&axis.nominal<=xmax){parts.push(`<line x1="${nominalX}" x2="${nominalX}" y1="${T}" y2="${H-B}" stroke="#9caaa0" stroke-dasharray="4 4"/>`);if(!mini)parts.push(`<text x="${Math.min(nominalX+5,W-70)}" y="${T-7}" fill="#7c887f" font-size="10">nominal</text>`);}
  const models=state.study.models.filter(m=>m!==state.study.baseline&&m!==state.model).concat(state.study.baseline,state.model);
  for(const model of models){
    const ps=axis.curves[model],chosen=model===state.study.baseline||model===state.model,color=model===state.study.baseline?baselineColor:model===state.model?robustColor:'#8f9c96';
    if(!mini&&state.bands&&chosen){const d=ps.map(p=>[x(p.x),y(p.mean+p.sd)]).concat([...ps].reverse().map(p=>[x(p.x),y(p.mean-p.sd)])).map(p=>p.join(',')).join(' ');parts.push(`<polygon points="${d}" fill="${color}" opacity=".08"/>`);}
    parts.push(`<path data-model="${esc(model)}" d="${ps.map((p,i)=>(i?'L':'M')+x(p.x)+','+y(p.mean)).join(' ')}" fill="none" stroke="${color}" stroke-width="${chosen?(mini?2.5:3):1.3}" opacity="${chosen?1:.19}" stroke-linejoin="round"/>`);
    if(chosen&&!mini){for(const p of ps)parts.push(`<circle cx="${x(p.x)}" cy="${y(p.mean)}" r="3" fill="${color}"><title>${esc(label(model))} · ${p.x}: ${fmt(p.mean)} ± ${fmt(p.sd)} SD; n=${p.n}</title></circle>`);const p=ps[pos];parts.push(`<circle data-marker="${esc(model)}" cx="${x(p.x)}" cy="${y(p.mean)}" r="6.1" fill="${color}" stroke="white" stroke-width="2.5"/>`);}
  }
  if(!mini){const xx=x(grid[pos].x);parts.push(`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${H-B}" stroke="#607168" opacity=".4" stroke-dasharray="2 4"/>`);}
  const ticks=grid.length<=7?grid: grid.filter((p,i)=>i===0||i===grid.length-1||i===Math.floor(grid.length/2));
  if(!mini)for(const p of ticks)parts.push(`<text x="${x(p.x)}" y="${H-B+21}" text-anchor="middle" fill="#6b746d" font-size="16">${fmt(p.x,2)}</text>`);
  if(!mini)parts.push(`<text x="${(L+W-R)/2}" y="${H-6}" text-anchor="middle" fill="#7b837e" font-size="15">${esc(/replace|bernoulli/.test(axis.id)?'Replacement probability':axis.id==='gravity'&&state.study.environment.startsWith('Lunar')?'Gravity (m/s²)':/noise|wind|turbulence/.test(axis.id)?'Disturbance amplitude':'Parameter scale')}</text>`);
  parts.push('</svg>');return parts.join('');
}
function renderChart(){
  $('chart').innerHTML=svgChart(state.axis);
  const svg=$('chart').querySelector('svg');
  svg.onclick=e=>{const rect=svg.getBoundingClientRect(),v=(e.clientX-rect.left)/rect.width*600;const grid=points(),x=grid[0].x+(v-62)/(600-62-15)*(grid.at(-1).x-grid[0].x);setPoint(nearestPoint(grid,x));};
}
function renderLegend(){
  $('legend').replaceChildren(...state.study.models.map(model=>{const b=document.createElement('button');b.textContent=label(model);b.className=model===state.study.baseline?'fixed':model===state.model?'active':'';b.setAttribute('aria-pressed',String(model===state.model||model===state.study.baseline));b.onclick=()=>chooseModel(model);return b;}));
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
  $('axis-count').textContent=state.study.axes.length+' axes · all saved settings';
  $('axis-gallery').replaceChildren(...state.study.axes.map(axis=>{const b=document.createElement('button');b.className='mini-axis'+(axis.id===state.axis.id?' active':'');b.innerHTML='<h3>'+esc(axis.title)+'</h3>'+svgChart(axis,true);b.setAttribute('aria-label','View '+axis.title);b.onclick=()=>{chooseAxis(axis.id);$('axis').focus();};return b;}));
  const query=$('search').value.toLowerCase();
  $('returns-gallery').replaceChildren(...state.study.axes.filter(a=>(a.title+' '+a.id).toLowerCase().includes(query)).map(axis=>{const item=document.createElement('article');item.className='return-axis';item.innerHTML='<h3>'+esc(axis.title)+'</h3>'+svgChart(axis)+'<p class="small">'+esc(label(state.model))+' versus standard · '+axis.curves[state.model][0].n+' measured policies at the first grid point</p>';return item;}));
}
function renderTable(){
  const query=$('search').value.toLowerCase(),fragment=document.createDocumentFragment();
  for(const a of state.study.axes){if(!a.title.toLowerCase().includes(query)&&!a.id.toLowerCase().includes(query))continue;const bs=a.curves[state.study.baseline],rs=a.curves[state.model];
    for(let i=0;i<bs.length;i++){const b=bs[i],r=rs[i],tr=document.createElement('tr'),values=[a.title,factorLabel(a,b.x,state.study.environment),fmt(b.mean),fmt(r.mean),(r.mean-b.mean>=0?'+':'')+fmt(r.mean-b.mean),b.n+' / '+r.n];for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}tr.tabIndex=0;tr.setAttribute('aria-label',a.title+' '+b.x+'; open comparison');const open=()=>{state.page='explore';chooseAxis(a.id);setPoint(i);showPage();$('severity').focus();};tr.onclick=open;tr.onkeydown=e=>{if(e.key==='Enter')open();};fragment.append(tr);}}
  $('returns-table').querySelector('tbody').replaceChildren(fragment);
}
function renderPaper(){
  const query=$('paper-search').value.toLowerCase();$('paper-count').textContent='· '+state.catalog.gallery.length+' panels';
  $('paper-gallery').replaceChildren(...state.catalog.gallery.filter(p=>(p.section+' '+p.title+' '+p.source).toLowerCase().includes(query)).map(p=>{const a=document.createElement('a');a.href=p.pdf;a.target='_blank';a.rel='noopener';a.className='paper-link';const title=document.createElement('strong');title.textContent=p.title;const sub=document.createElement('small');sub.textContent=p.section+' · PDF ↗';a.append(title,sub);return a;}));
}
function stopReplay(){state.playing=false;cancelAnimationFrame(animation);$('play').textContent='▶';$('play').setAttribute('aria-label','Play recorded-policy replay');}
async function loadReplay(){
  const ticket=++pendingReplay;stopReplay();state.replay=null;state.frame=0;
  const factor=points()[state.index].x,key=state.axis.id+'|'+factor;
  const entry=state.study.replays?.[state.model]?.[key];
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
$('severity').oninput=e=>setPoint(e.target.value);$('nominal').onclick=()=>setPoint(nearestPoint(points(),state.axis.nominal));$('bands').onchange=e=>{state.bands=e.target.checked;renderChart();renderGallery();};
$('search').oninput=()=>{renderTable();renderGallery();};$('paper-search').oninput=renderPaper;
$('play').onclick=()=>{if(state.playing)stopReplay();else{state.playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause recorded-policy replay');lastFrame=0;animation=requestAnimationFrame(animate);}};
$('frame').oninput=e=>{stopReplay();state.frame=Number(e.target.value);drawScene();};
window.addEventListener('hashchange',()=>{state.page=location.hash.slice(1);showPage();});
document.querySelectorAll('[data-page]').forEach(a=>a.onclick=()=>{state.page=a.dataset.page;showPage();});
$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('toast').textContent='Comparison link copied';$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),2000);}catch{$('toast').textContent='Copy the current address to share this comparison';$('toast').classList.add('visible');}};
$('download').onclick=()=>{const rows=[['study','environment','algorithm','family','setting','axis','value','mean_return','sample_sd','measured_policies']];for(const [model,ps] of Object.entries(state.axis.curves))for(const p of ps)rows.push([state.study.id,state.study.environment,state.study.algorithm,state.study.family,model,state.axis.id,p.x,p.mean,p.sd,p.n]);const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=u;a.download=state.study.id+'-'+state.axis.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),200);};

try{
  const r=await fetch('data/catalog.json');if(!r.ok)throw Error('Could not load the saved result catalog');state.catalog=await r.json();
  $('catalog-summary').textContent=`${state.catalog.studies.length} saved study groups · ${state.catalog.studies.reduce((n,s)=>n+s.axisCount,0)} perturbation axes · exported ${state.catalog.updated}.`;
  $('sources').replaceChildren(...state.catalog.sources.map(source=>{const row=document.createElement('div');row.className='source-row';row.textContent=source.path;const hash=document.createElement('span');hash.textContent='SHA256 '+source.sha256;row.append(hash);return row;}));
  renderPaper();const initial=state.catalog.studies.find(s=>s.id===params.get('study'))?.id||'ppo_tv_pickcube';await chooseStudy(initial,true);
}catch(error){$('loading').textContent='Results could not be loaded. '+error.message;console.error(error);}
