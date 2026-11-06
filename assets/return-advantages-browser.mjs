import {escape as esc} from './model.mjs';
import {previewChart} from './environment-library.mjs?v=20261106-advantages1';
import {matchingRows,rankAdvantage,prioritizeRows} from './return-advantages.mjs?v=20261106-ranked1';

const root=typeof document==='undefined'?null:document.getElementById('advantages-page');
const $=id=>root.querySelector('#'+id),unique=a=>[...new Set(a)];
const number=v=>v===null?'Unavailable':v!==0&&Math.abs(v)<.0001?v.toExponential(2):v.toLocaleString('en-US',{maximumFractionDigits:6});
const returnNumber=v=>v===null?'Unavailable':v!==0&&Math.abs(v)<.0001?v.toExponential(2):v.toLocaleString('en-US',{maximumFractionDigits:Math.abs(v)<1?4:2});
const signed=v=>(v>0?'+':'')+returnNumber(v);
let data,loading=false,filter,page=0,selected=null,ranks=new Map();
const perPage=25;
const tiers={noticeable:'Noticeable gains',small:'Small differences',spread:'Spread-led',all:'All matches'};
export function resultLink(row,view,value){
  if(row.supplied)return row.report+'?'+new URLSearchParams({dataset:row.sourceId,view:view==='returns'?'returns':'reliability',mode:'fixed',setting:row.setting,axis:row.axis,value,scope:'condition',measure:'level'});
  return '?'+new URLSearchParams({study:row.sourceId,setting:row.setting,reference:row.reference,axis:row.axis,value,scope:'condition',metric:'raw'})+'#'+view;
}
export function filtersFromQuery(search){
  const p=new URLSearchParams(search);
  const screen=['upper','positive','all','separated'].includes(p.get('screen'))?p.get('screen'):'upper';
  return {environment:p.get('environment')||'all',method:p.get('method')||'all',source:p.get('configuration')||p.get('study')||'all',
    screen,selection:p.get('caps')==='best'?'best':'all',singles:p.get('single')==='1',search:p.get('find')||'',
    tier:screen==='all'?'all':Object.hasOwn(tiers,p.get('view'))?p.get('view'):screen==='upper'?'noticeable':'all',
    threshold:['2','5','10'].includes(p.get('cutoff'))?Number(p.get('cutoff'))/100:.05};
}
export const filterQuery=filter=>new URLSearchParams(Object.fromEntries(Object.entries({environment:filter.environment,method:filter.method,configuration:filter.source,screen:filter.screen,caps:filter.selection,single:filter.singles?'1':'',find:filter.search,view:filter.tier,cutoff:String(Math.round((filter.threshold??.05)*100))}).filter(([k,v])=>v&&(v!=='all'||['screen','view'].includes(k)))));
function save(){
  const u=new URL(location.href);u.search=filterQuery(filter);
  u.hash='advantages';history.replaceState(null,'',u);
}
function options(id,values,value){$(id).innerHTML='<option value="all">All</option>'+values.map(([v,name])=>`<option value="${esc(v)}">${esc(name)}</option>`).join('');$(id).value=values.some(([v])=>v===value)?value:'all';}
function shell(){
  root.innerHTML=`<header class="adv-heading"><h1>Return advantages</h1><p>Inspect the largest sustained differences first, then explore smaller and spread-led matches.</p></header>
    <div class="adv-counts"><span><strong>${data.summary.settingRecords}</strong> settings checked</span><span><strong>${data.summary.axes}</strong> perturbation grids</span><span><strong>${data.summary.upper.settings}</strong> settings with any upper-edge match</span><span id="adv-prominent-count"></span></div>
    <div class="adv-filters"><label>Environment<select id="adv-environment"></select></label><label>Method<select id="adv-method"></select></label><label>Configuration<select id="adv-source"></select></label><label>Criterion<select id="adv-screen"><option value="upper">Upper SD edge</option><option value="positive">Mean return</option><option value="separated">Separate SD bands</option><option value="all">Every comparison</option></select></label></div>
    <div class="adv-options"><div class="segmented" role="group" aria-label="Settings to include"><button id="adv-all" type="button">All settings</button><button id="adv-best" type="button">Best per curve</button></div><label><input id="adv-single" type="checkbox"> Include single severities</label><label class="adv-search">Find a setting or perturbation<input id="adv-search" type="search" placeholder="Mass, action delay, cap..."></label></div>
    <div class="adv-priority"><div class="segmented" role="group" aria-label="Gain size">${Object.entries(tiers).map(([key,label])=>`<button id="adv-tier-${key}" type="button">${label} <span></span></button>`).join('')}</div><label>Display cutoff<select id="adv-cutoff"><option value="2">2% of return range</option><option value="5">5% of return range</option><option value="10">10% of return range</option></select></label></div>
    <p id="adv-explanation" class="adv-note"></p>
    <div class="adv-toolbar"><p id="adv-count" role="status"></p><a href="data/advantages/settings.csv" download>Settings summary ↓</a><a href="data/advantages/ranges.csv" download>Ranges CSV ↓</a><a href="data/advantages/all-points.csv" download>All comparisons CSV ↓</a></div>
    <div class="adv-layout"><div><div id="adv-results"></div><nav id="adv-pages" class="adv-pagination" aria-label="Results pages"></nav></div><section id="adv-detail" class="adv-detail" aria-label="Selected return curve"></section></div>
    <details class="adv-definitions"><summary>Scope & interpretation</summary><p>Each comparison is one fixed setting versus the same ordinary standard on one perturbation axis. Only adjacent measured shifted levels count; nominal and nonqualifying levels break ranges. Connecting lines do not prove an advantage between measurements.</p><p>Higher upper SD edge means robust mean + one sample SD &gt; standard mean + one sample SD. The bands can overlap. A larger robust SD can satisfy this rule even with a lower mean; the mean difference is shown separately. The optional non-overlapping screen instead requires robust mean − SD &gt; standard mean + SD. Neither is a significance test; SD is not a confidence interval. Best per curve selects the highest full-grid mean ex post, not a pointwise envelope.</p><p>Noticeable gains are a display filter, not a new scientific claim. For the upper-edge criterion, both the mean difference and upper-edge gap must reach the cutoff at each highlighted level. The return range spans the lowest mean − SD to the highest mean + SD across both complete full curves, including nominal. The default cutoff is 5%; 2% and 10% are also available. Small differences have adjacent higher means but do not clear this cutoff. Spread-led matches have no adjacent qualifying higher-mean range. Rankings use the strongest range's average normalized gain multiplied by its fraction of complete shifted measurements, favoring larger and more persistent differences. No interpolation or physical-interval weighting is used.</p><p>Default highlights require all 30 intended policies for both methods. Incomplete cohorts and perturbations with unverified effects remain in Every comparison and the CSV. A higher upper edge does not establish a higher expected return, nominal competence, task success or suite-wide robustness. Flat saved curves do not establish perturbation sensitivity. Supplied Pendulum evaluation sets stay separate; reused policies are not extra seeds. CSV downloads retain all original matches, not only the displayed filter.</p><a href="data/advantages/protocol.md">Audit protocol</a><div id="adv-coverage"></div></details>`;
  options('adv-environment',unique(data.rows.map(r=>r.environmentId)).map(id=>[id,data.rows.find(r=>r.environmentId===id).environment]),filter.environment);
  filter.environment=$('adv-environment').value;
  $('adv-screen').value=filter.screen;$('adv-single').checked=filter.singles;$('adv-search').value=filter.search;
  $('adv-cutoff').value=String(Math.round(filter.threshold*100));
  $('adv-environment').onchange=()=>{filter.environment=$('adv-environment').value;filter.method='all';filter.source='all';updateChoices();change();};
  $('adv-method').onchange=()=>{filter.method=$('adv-method').value;filter.source='all';updateChoices();change();};
  $('adv-source').onchange=()=>{filter.source=$('adv-source').value;change();};
  $('adv-screen').onchange=()=>{filter.screen=$('adv-screen').value;filter.tier='all';change();};
  $('adv-cutoff').onchange=()=>{filter.threshold=Number($('adv-cutoff').value)/100;change();};
  for(const tier of Object.keys(tiers))$('adv-tier-'+tier).onclick=()=>{filter.tier=tier;change();};
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
function rowRanges(row){const rank=ranks.get(row.id)||rankAdvantage(row,filter);return filter.tier==='noticeable'?rank.spans:rank.allSpans;}
function render(){
  const candidates=matchingRows(data.rows,filter).filter(r=>filter.source==='all'||r.sourceId===filter.source);
  const ranked=prioritizeRows(candidates,filter);ranks=new Map(ranked.map(item=>[item.row.id,item.rank]));
  const counts=Object.fromEntries(Object.keys(tiers).map(tier=>[tier,tier==='all'?ranked.length:ranked.filter(item=>item.rank.tier===tier).length]));
  const rows=ranked.filter(item=>filter.tier==='all'||item.rank.tier===filter.tier).map(item=>item.row);
  for(const tier of Object.keys(tiers)){const b=$('adv-tier-'+tier);b.setAttribute('aria-pressed',String(filter.tier===tier));b.querySelector('span').textContent=counts[tier];b.disabled=filter.screen==='all'&&tier!=='all';}
  $('adv-prominent-count').innerHTML=`<strong>${new Set(ranked.filter(item=>item.rank.tier==='noticeable').map(item=>item.row.sourceId+'|'+item.row.setting)).size}</strong> settings above the ${Math.round(filter.threshold*100)}% display cutoff`;
  const last=Math.max(0,Math.ceil(rows.length/perPage)-1);page=Math.min(page,last);
  const slice=rows.slice(page*perPage,(page+1)*perPage);
  for(const s of ['all','best'])$('adv-'+s).setAttribute('aria-pressed',String(filter.selection===s));
  $('adv-single').disabled=filter.screen==='all';
  const definition=filter.screen==='upper'?'Robust mean + SD exceeds standard mean + SD. Bands may overlap.':filter.screen==='separated'?'Robust mean − SD exceeds standard mean + SD.':filter.screen==='positive'?'Robust mean exceeds standard mean.':'Includes losses, ties, incomplete policies and unverified perturbations.';
  const view=filter.tier==='noticeable'?`Both the mean gain and ${filter.screen==='upper'?'upper-edge gap':'criterion gap'} reach ${Math.round(filter.threshold*100)}% of the full return range at adjacent levels. Ranked by gain size and persistence.`:filter.tier==='spread'?'Upper-edge matches without an adjacent higher-mean range. A larger spread can qualify despite lower means.':filter.tier==='small'?'Higher-mean ranges below the display cutoff. These may be difficult to distinguish visually.':'All original matches, ranked by gain size and persistence.';
  $('adv-explanation').textContent=definition+' '+(filter.screen==='all'?'':view+' ')+'Descriptive only, not statistical significance.';
  $('adv-count').textContent=`${rows.length} comparisons · ${new Set(rows.map(r=>r.sourceId+'|'+r.setting)).size} settings · ${filter.screen==='all'?'all comparisons':filter.singles?'single or adjacent levels':'at least 2 adjacent levels'}${filter.selection==='best'?' · ex-post best per curve':''}`;
  if(!selected||!slice.some(r=>r.id===selected))selected=slice[0]?.id;
  const upperScreen=['upper','all'].includes(filter.screen);
  $('adv-results').innerHTML=slice.length?`<table class="adv-table"><thead><tr><th>Setting / perturbation</th><th>Measured range</th><th>${upperScreen?'Upper-edge gap':'Mean difference'}</th></tr></thead><tbody>${slice.map(r=>{
    const spans=rowRanges(r),rank=ranks.get(r.id),warning=r.warning||(!r.points.every(p=>p.complete)?'Incomplete policy coverage':'');
    return `<tr class="${r.id===selected?'selected':''}"><td><button type="button" data-adv-row="${esc(r.id)}" aria-pressed="${r.id===selected}"><strong>${esc(r.environment)} / ${esc(r.method)}</strong><span>${esc(r.settingLabel)} · ${esc(r.axisTitle)}</span></button><small>${esc(r.configuration)}${r.best?' · best full-grid mean':''}</small>${rank.tier!=='none'?`<small class="adv-tier-label">${tiers[rank.tier]}${rank.tier!=='spread'?' · '+(rank.average*100).toFixed(1)+'% average gain · '+rank.count+'/'+rank.total+' levels':''}</small>`:''}${warning?`<small class="adv-warning">${esc(warning)}</small>`:''}</td><td>${spans.length?spans.map(s=>`<div title="Measured levels: ${esc(s.values.join(', '))}">${number(s.from)}${s.to===s.from?'':' to '+number(s.to)} <small>(${s.count})</small></div>`).join(''):'None'}</td><td>${spans.length?spans.map(s=>{const lo=upperScreen?s.minUpperGap:s.minDelta,hi=upperScreen?s.maxUpperGap:s.maxDelta;return `<div>${signed(lo)}${hi===lo?'':' to '+signed(hi)}</div>`;}).join(''):'—'}</td></tr>`;
  }).join('')}</tbody></table>`:'<p class="adv-empty">No comparison in this view. Try All matches or a lower display cutoff.</p>';
  root.querySelectorAll('[data-adv-row]').forEach(b=>b.onclick=()=>{selected=b.dataset.advRow;render();if(matchMedia('(max-width:1000px)').matches)$('adv-detail').scrollIntoView({behavior:'smooth',block:'start'});});
  $('adv-pages').innerHTML=`<button id="adv-prev" type="button" ${page===0?'disabled':''} aria-label="Previous results page">←</button><span>${rows.length?page+1:0} / ${rows.length?last+1:0}</span><button id="adv-next" type="button" ${page===last?'disabled':''} aria-label="Next results page">→</button>`;
  $('adv-prev').onclick=()=>{page--;selected=null;render();};$('adv-next').onclick=()=>{page++;selected=null;render();};
  detail(data.rows.find(r=>r.id===selected));
}
function detail(row){
  if(!row){$('adv-detail').innerHTML='<p>Select a comparison to inspect its full curve.</p>';return;}
  const rank=ranks.get(row.id),spans=rowRanges(row),first=spans[0]?.from??row.points.find(p=>!p.nominal)?.x??row.points[0].x;
  $('adv-detail').innerHTML=`<header><h2>${esc(row.environment)} / ${esc(row.method)}</h2><p>${esc(row.settingLabel)} vs Standard · ${esc(row.axisTitle)}</p><small>${esc(row.task)} / ${esc(row.configuration)}</small></header>
    ${row.warning?`<p class="adv-warning">${esc(row.warning)}</p>`:''}${row.background?`<p>${esc(row.background)}</p>`:''}
    ${row.nominalStandard!==null&&row.nominalRobust!==null?`<p class="adv-note">Nominal mean: Standard ${returnNumber(row.nominalStandard)} / ${esc(row.settingLabel)} ${returnNumber(row.nominalRobust)}.</p>`:''}
    ${rank.tier!=='none'?`<p class="adv-ranking-note">${tiers[rank.tier]}${rank.tier==='spread'?' · no adjacent qualifying higher-mean range':` · strongest range: ${(rank.average*100).toFixed(1)}% average gain across ${rank.count}/${rank.total} shifted levels`}. ${rank.tier==='noticeable'?'Both mean and criterion gaps clear the display cutoff.':'Not a claim of a clear visual benefit.'}</p>`:''}
    ${row.flat?'<p class="adv-note">Both saved mean curves are flat across this grid; no perturbation sensitivity is established.</p>':''}
    <div id="adv-chart"></div><div class="env-legend"><span style="--series:#003087">Standard</span><span style="--series:#d94b24">${esc(row.settingLabel)}</span></div>
    <p class="adv-note">Bands: sample SD, not CI. Green: ${filter.tier==='noticeable'?'above-cutoff':'qualifying'} sampled range. ${row.nominal===null?'No unperturbed nominal on this axis.':'Dashed gray: nominal.'}</p>
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
