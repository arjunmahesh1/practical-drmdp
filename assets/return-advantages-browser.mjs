import {escape as esc} from './model.mjs';
import {previewChart} from './environment-library.mjs?v=20261106-advantages1';
import {ranges,matchingRows} from './return-advantages.mjs?v=20261106-upper1';

const root=typeof document==='undefined'?null:document.getElementById('advantages-page');
const $=id=>root.querySelector('#'+id),unique=a=>[...new Set(a)];
const number=v=>v===null?'Unavailable':v!==0&&Math.abs(v)<.0001?v.toExponential(2):v.toLocaleString('en-US',{maximumFractionDigits:6});
const returnNumber=v=>v===null?'Unavailable':v!==0&&Math.abs(v)<.0001?v.toExponential(2):v.toLocaleString('en-US',{maximumFractionDigits:Math.abs(v)<1?4:2});
const signed=v=>(v>0?'+':'')+returnNumber(v);
let data,loading=false,filter,page=0,selected=null;
const perPage=25;
export function resultLink(row,view,value){
  if(row.supplied)return row.report+'?'+new URLSearchParams({dataset:row.sourceId,view:view==='returns'?'returns':'reliability',mode:'fixed',setting:row.setting,axis:row.axis,value,scope:'condition',measure:'level'});
  return '?'+new URLSearchParams({study:row.sourceId,setting:row.setting,reference:row.reference,axis:row.axis,value,scope:'condition',metric:'raw'})+'#'+view;
}
export function filtersFromQuery(search){
  const p=new URLSearchParams(search);
  return {environment:p.get('environment')||'all',method:p.get('method')||'all',source:p.get('configuration')||p.get('study')||'all',
    screen:['upper','positive','all','separated'].includes(p.get('screen'))?p.get('screen'):'upper',selection:p.get('caps')==='best'?'best':'all',singles:p.get('single')==='1',search:p.get('find')||''};
}
export const filterQuery=filter=>new URLSearchParams(Object.fromEntries(Object.entries({environment:filter.environment,method:filter.method,configuration:filter.source,screen:filter.screen,caps:filter.selection,single:filter.singles?'1':'',find:filter.search}).filter(([k,v])=>v&&(v!=='all'||k==='screen'))));
function save(){
  const u=new URL(location.href);u.search=filterQuery(filter);
  u.hash='advantages';history.replaceState(null,'',u);
}
function options(id,values,value){$(id).innerHTML='<option value="all">All</option>'+values.map(([v,name])=>`<option value="${esc(v)}">${esc(name)}</option>`).join('');$(id).value=values.some(([v])=>v===value)?value:'all';}
function shell(){
  root.innerHTML=`<header class="adv-heading"><h1>Return advantages</h1><p>Compare the upper edges of the robust and standard SD bands, without an L1/L2/L3 requirement.</p></header>
    <div class="adv-counts"><span><strong>${data.summary.settingRecords}</strong> settings checked</span><span><strong>${data.summary.axes}</strong> perturbation grids</span><span><strong>${data.summary.upper.settings}</strong> with higher upper-edge ranges</span><a href="?screen=positive#advantages"><strong>${data.summary.positive.settings}</strong> with higher-mean ranges ↗</a></div>
    <div class="adv-filters"><label>Environment<select id="adv-environment"></select></label><label>Method<select id="adv-method"></select></label><label>Configuration<select id="adv-source"></select></label><label>Criterion<select id="adv-screen"><option value="upper">Higher upper SD edge</option><option value="positive">Higher mean return</option><option value="separated">Non-overlapping SD bands</option><option value="all">Every comparison</option></select></label></div>
    <div class="adv-options"><div class="segmented" role="group" aria-label="Settings to include"><button id="adv-all" type="button">All settings</button><button id="adv-best" type="button">Best per curve</button></div><label><input id="adv-single" type="checkbox"> Include single severities</label><label class="adv-search">Find a setting or perturbation<input id="adv-search" type="search" placeholder="Mass, action delay, cap..."></label></div>
    <p id="adv-explanation" class="adv-note"></p>
    <div class="adv-toolbar"><p id="adv-count" role="status"></p><a href="data/advantages/settings.csv" download>Settings summary ↓</a><a href="data/advantages/ranges.csv" download>Ranges CSV ↓</a><a href="data/advantages/all-points.csv" download>All comparisons CSV ↓</a></div>
    <div class="adv-layout"><div><div id="adv-results"></div><nav id="adv-pages" class="adv-pagination" aria-label="Results pages"></nav></div><section id="adv-detail" class="adv-detail" aria-label="Selected return curve"></section></div>
    <details class="adv-definitions"><summary>Scope & interpretation</summary><p>Each range uses one fixed setting and the same ordinary standard policy. Only adjacent measured shifted levels count; nominal and nonqualifying levels break ranges. Connecting lines do not prove an advantage between measurements.</p><p>Higher upper SD edge means robust mean + one sample SD &gt; standard mean + one sample SD. The bands can overlap. A larger robust SD can satisfy this rule even with a lower mean; the mean difference is shown separately. The optional non-overlapping screen instead requires robust mean − SD &gt; standard mean + SD. Neither is a significance test; SD is not a confidence interval. Best per curve selects the highest full-grid mean ex post, not a pointwise envelope.</p><p>Default highlights require all 30 intended policies for both methods. Incomplete cohorts and perturbations with unverified effects remain in Every comparison and the CSV. A higher upper edge does not establish a higher expected return, nominal competence, task success or suite-wide robustness. Flat saved curves do not establish perturbation sensitivity. Supplied Pendulum evaluation sets stay separate; reused policies are not extra seeds.</p><a href="data/advantages/protocol.md">Audit protocol</a><div id="adv-coverage"></div></details>`;
  options('adv-environment',unique(data.rows.map(r=>r.environmentId)).map(id=>[id,data.rows.find(r=>r.environmentId===id).environment]),filter.environment);
  filter.environment=$('adv-environment').value;
  $('adv-screen').value=filter.screen;$('adv-single').checked=filter.singles;$('adv-search').value=filter.search;
  $('adv-environment').onchange=()=>{filter.environment=$('adv-environment').value;filter.method='all';filter.source='all';updateChoices();change();};
  $('adv-method').onchange=()=>{filter.method=$('adv-method').value;filter.source='all';updateChoices();change();};
  $('adv-source').onchange=()=>{filter.source=$('adv-source').value;change();};
  $('adv-screen').onchange=()=>{filter.screen=$('adv-screen').value;change();};
  $('adv-single').onchange=()=>{filter.singles=$('adv-single').checked;change();};
  $('adv-search').oninput=()=>{filter.search=$('adv-search').value;change();};
  for(const selection of ['all','best'])$('adv-'+selection).onclick=()=>{filter.selection=selection;change();};
  $('adv-coverage').innerHTML=`<table><caption>All configurations scanned</caption><thead><tr><th>Environment / configuration</th><th>Axes</th><th>Active settings</th></tr></thead><tbody>${data.coverage.map(c=>`<tr><td>${esc(c.environment)}<code>${esc(c.sourceId)}</code></td><td>${c.axes}</td><td>${c.settings}</td></tr>`).join('')}</tbody></table>`;
  updateChoices();render();
}
function updateChoices(){
  const rows=data.rows.filter(r=>filter.environment==='all'||r.environmentId===filter.environment);
  options('adv-method',unique(rows.map(r=>r.method)).sort().map(m=>[m,m]),filter.method);filter.method=$('adv-method').value;
  const subset=rows.filter(r=>filter.method==='all'||r.method===filter.method);
  options('adv-source',unique(subset.map(r=>r.sourceId)).map(id=>{const r=subset.find(x=>x.sourceId===id);return[id,r.environment+' / '+r.method+' / '+r.configuration];}),filter.source);filter.source=$('adv-source').value;
}
function change(){page=0;selected=null;save();render();}
function rowRanges(row){return ranges(row,filter.screen==='all'?'upper':filter.screen,filter.singles);}
function render(){
  const rows=matchingRows(data.rows,filter).filter(r=>filter.source==='all'||r.sourceId===filter.source);
  const last=Math.max(0,Math.ceil(rows.length/perPage)-1);page=Math.min(page,last);
  const slice=rows.slice(page*perPage,(page+1)*perPage);
  for(const s of ['all','best'])$('adv-'+s).setAttribute('aria-pressed',String(filter.selection===s));
  $('adv-single').disabled=filter.screen==='all';
  $('adv-explanation').textContent=filter.screen==='upper'?'Robust mean + SD exceeds standard mean + SD. Bands may overlap; a larger spread can qualify even with a lower mean. Descriptive, not statistical significance.':filter.screen==='separated'?'Robust mean − SD exceeds standard mean + SD at each highlighted level. Descriptive separation, not statistical significance.':filter.screen==='positive'?'Higher observed means, even where SD bands overlap. Small or noisy differences remain visible; no significance claim.':'Includes losses, ties, incomplete policies and unverified perturbations. No comparison is silently dropped.';
  $('adv-count').textContent=`${rows.length} curves · ${new Set(rows.map(r=>r.sourceId+'|'+r.setting)).size} settings · ${filter.screen==='all'?'all comparisons':filter.singles?'single or adjacent levels':'at least 2 adjacent levels'}${filter.selection==='best'?' · ex-post best per curve':''}`;
  if(!selected||!slice.some(r=>r.id===selected))selected=slice[0]?.id;
  const upperScreen=['upper','all'].includes(filter.screen);
  $('adv-results').innerHTML=slice.length?`<table class="adv-table"><thead><tr><th>Setting / perturbation</th><th>Measured range</th><th>${upperScreen?'Upper-edge gap':'Mean difference'}</th></tr></thead><tbody>${slice.map(r=>{
    const spans=rowRanges(r),warning=r.warning||(!r.points.every(p=>p.complete)?'Incomplete policy coverage':'');
    return `<tr class="${r.id===selected?'selected':''}"><td><button type="button" data-adv-row="${esc(r.id)}" aria-pressed="${r.id===selected}"><strong>${esc(r.environment)} / ${esc(r.method)}</strong><span>${esc(r.settingLabel)} · ${esc(r.axisTitle)}</span></button><small>${esc(r.configuration)}${r.best?' · best full-grid mean':''}</small>${warning?`<small class="adv-warning">${esc(warning)}</small>`:''}</td><td>${spans.length?spans.map(s=>`<div title="Measured levels: ${esc(s.values.join(', '))}">${number(s.from)}${s.to===s.from?'':' to '+number(s.to)} <small>(${s.count})</small></div>`).join(''):'None'}</td><td>${spans.length?spans.map(s=>{const lo=upperScreen?s.minUpperGap:s.minDelta,hi=upperScreen?s.maxUpperGap:s.maxDelta;return `<div>${signed(lo)}${hi===lo?'':' to '+signed(hi)}</div>`;}).join(''):'—'}</td></tr>`;
  }).join('')}</tbody></table>`:'<p class="adv-empty">No qualifying curve for these filters. Try Higher mean return, single severities, or Every comparison.</p>';
  root.querySelectorAll('[data-adv-row]').forEach(b=>b.onclick=()=>{selected=b.dataset.advRow;render();if(matchMedia('(max-width:1000px)').matches)$('adv-detail').scrollIntoView({behavior:'smooth',block:'start'});});
  $('adv-pages').innerHTML=`<button id="adv-prev" type="button" ${page===0?'disabled':''} aria-label="Previous results page">←</button><span>${rows.length?page+1:0} / ${rows.length?last+1:0}</span><button id="adv-next" type="button" ${page===last?'disabled':''} aria-label="Next results page">→</button>`;
  $('adv-prev').onclick=()=>{page--;selected=null;render();};$('adv-next').onclick=()=>{page++;selected=null;render();};
  detail(data.rows.find(r=>r.id===selected));
}
function detail(row){
  if(!row){$('adv-detail').innerHTML='<p>Select a comparison to inspect its full curve.</p>';return;}
  const spans=rowRanges(row),first=spans[0]?.from??row.points.find(p=>!p.nominal)?.x??row.points[0].x;
  $('adv-detail').innerHTML=`<header><h2>${esc(row.environment)} / ${esc(row.method)}</h2><p>${esc(row.settingLabel)} vs Standard · ${esc(row.axisTitle)}</p><small>${esc(row.task)} / ${esc(row.configuration)}</small></header>
    ${row.warning?`<p class="adv-warning">${esc(row.warning)}</p>`:''}${row.background?`<p>${esc(row.background)}</p>`:''}
    ${row.nominalStandard!==null&&row.nominalRobust!==null?`<p class="adv-note">Nominal mean: Standard ${returnNumber(row.nominalStandard)} / ${esc(row.settingLabel)} ${returnNumber(row.nominalRobust)}.</p>`:''}
    ${row.flat?'<p class="adv-note">Both saved mean curves are flat across this grid; no perturbation sensitivity is established.</p>':''}
    <div id="adv-chart"></div><div class="env-legend"><span style="--series:#003087">Standard</span><span style="--series:#d94b24">${esc(row.settingLabel)}</span></div>
    <p class="adv-note">Bands: sample SD, not CI. Green: qualifying sampled range. ${row.nominal===null?'No unperturbed nominal on this axis.':'Dashed gray: nominal.'}</p>
    <label class="adv-level-label">Measured severity<select id="adv-level">${row.points.map(p=>`<option value="${p.x}">${esc(number(p.x))}${p.nominal?' · nominal':''}</option>`).join('')}</select></label><input id="adv-severity" type="range" min="0" max="${row.points.length-1}" step="1" aria-label="Measured severity">
    <div id="adv-values" class="adv-values"></div><nav id="adv-links" class="adv-links" aria-label="Analyze this result"></nav>
    <details><summary>Sampled values</summary><div class="table-scroll"><table><thead><tr><th>Severity</th><th>Standard mean</th><th>${esc(row.settingLabel)} mean</th><th>Mean difference</th><th>Upper-edge gap</th><th>Policies</th></tr></thead><tbody>${row.points.map(p=>`<tr><td title="${p.x}">${esc(number(p.x))}${p.nominal?' (nominal)':''}</td><td title="${p.standard}">${returnNumber(p.standard)}</td><td title="${p.robust}">${returnNumber(p.robust)}</td><td title="${p.delta}">${p.delta===null?'—':signed(p.delta)}</td><td title="${p.upperGap}">${p.upperGap===null?'—':signed(p.upperGap)}</td><td>${p.robustN} / ${p.standardN}</td></tr>`).join('')}</tbody></table></div></details>`;
  const paint=i=>{
    const p=row.points[i];$('adv-level').value=p.x;$('adv-severity').value=i;
    $('adv-chart').innerHTML=previewChart([
      {name:'Standard',points:row.points.filter(v=>Number.isFinite(v.standard)).map(v=>({x:v.x,y:v.standard,sd:v.standardSD}))},
      {name:row.settingLabel,points:row.points.filter(v=>Number.isFinite(v.robust)).map(v=>({x:v.x,y:v.robust,sd:v.robustSD}))}
    ],row.xLabel,'Mean return',{bands:true,nominal:row.nominal,current:p.x,highlights:spans});
    $('adv-values').innerHTML=`<div>Standard mean<strong>${returnNumber(p.standard)}</strong></div><div>${esc(row.settingLabel)} mean<strong>${returnNumber(p.robust)}</strong></div><div>Mean difference<strong>${p.delta===null?'—':signed(p.delta)}</strong></div><div>Upper-edge gap<strong>${p.upperGap===null?'—':signed(p.upperGap)}</strong></div><p>${p.robustN} robust / ${p.standardN} standard policies · ${p.nominal?'nominal':!p.complete?'incomplete':p.upper?'higher robust upper edge'+(p.positive?' · higher mean':' · mean not higher'):'no upper-edge advantage'}</p>`;
    $('adv-links').innerHTML=`<a href="${esc(resultLink(row,'returns',p.x))}">Return curves ↗</a><a href="${esc(resultLink(row,'advanced',p.x))}">Metrics at this severity ↗</a>`;
  };
  $('adv-level').onchange=()=>paint(row.points.findIndex(p=>p.x===Number($('adv-level').value)));
  $('adv-severity').oninput=()=>paint(Number($('adv-severity').value));paint(row.points.findIndex(p=>p.x===first));
}
async function route(){
  if(!root||location.hash!=='#advantages')return;
  if(loading)return;
  filter=filtersFromQuery(location.search);page=0;selected=null;
  if(data){shell();return;}
  loading=true;root.innerHTML='<p role="status">Loading curve audit...</p>';
  try{const response=await fetch('data/advantages/index.json?v=20261106-upper1');if(!response.ok)throw Error('Curve audit unavailable');data=await response.json();if(location.hash==='#advantages')shell();}
  catch(e){root.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}finally{loading=false;}
}
if(root){window.addEventListener('hashchange',route);window.addEventListener('popstate',route);window.addEventListener('results-context',e=>{if(e.detail.page==='advantages')route();});route();}
