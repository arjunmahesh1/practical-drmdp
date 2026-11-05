import fs from 'node:fs';
import crypto from 'node:crypto';
import {evidenceRows,compareSetting} from '../assets/evidence-metrics.mjs';
import {visibleStudy} from '../assets/results-policy.mjs';
const root=new URL('../',import.meta.url);
const read=relative=>JSON.parse(fs.readFileSync(new URL(relative,root)));
const catalog=read('data/catalog.json'),index=read('data/appendix/index.json');
const rows=[],sources=[],media=[];
let measuredConditions=0,favorableConditions=0;
for(const meta of catalog.studies.filter(visibleStudy)){
  const curve=read('data/'+meta.id+'.json'),policy=read('data/appendix/'+meta.id+'.json');
  const comparisons=evidenceRows(curve,policy);
  rows.push(...comparisons.filter(r=>r.level!=='condition'));
  const conditionRows=comparisons.filter(r=>r.level==='condition');
  measuredConditions+=conditionRows.length;favorableConditions+=conditionRows.filter(r=>r.favorable).length;
  const groups=new Map();
  for(const row of conditionRows){
    const key=row.model+'|'+row.axis,previous=groups.get(key);
    if(!previous||Number(row.favorable)>Number(previous.favorable)||row.favorable===previous.favorable&&(row.deltaAuc??-Infinity)>(previous.deltaAuc??-Infinity))groups.set(key,row);
  }
  rows.push(...groups.values());
  for(const directory of ['data/','data/appendix/']){
    const file=directory+meta.id+'.json';sources.push({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex')});
  }
  for(const model of curve.models){
    const conditions=curve.axes.flatMap(a=>a.curves[model].map(p=>({axis:a.id,value:p.x,recorded:!!curve.replays?.[model]?.[a.id+'|'+p.x]})));
    media.push({study:curve.id,environment:curve.environment,model,conditions:conditions.length,recorded:conditions.filter(c=>c.recorded).length,missing:conditions.filter(c=>!c.recorded).map(({axis,value})=>({axis,value}))});
  }
}
const paper=[
  ['L2','ppo_tv_walker','a2p95','vanilla','mass',null,'fig:walker-ppo-l2-l3-matched','Paper: fixed cap across mass shifts'],
  ['condition','ppo_tv_walker','a2p95','vanilla','mass',.5,'fig:walker-ppo-mass-reliability','Paper: mass scale 0.5'],
  ['L3','td3_tv_walker','tvc400','tvc500',null,null,'fig:level3-td3-full-suite','Paper: inactive-cap comparator']
];
for(const [level,id,model,reference,axis,value,paperLabel,paperTitle] of paper){
 const curve=read('data/'+id+'.json'),policy=read('data/appendix/'+id+'.json');
 const scope=level==='L3'?'suite':level==='condition'?'condition':'axis';
 const row=compareSetting(curve,policy,model,scope,axis,value,reference);
 rows.push({...row,level,axisTitle:curve.axes.find(a=>a.id===axis)?.title,paperLabel,paperTitle,paperPdf:index.figures.find(f=>f.paperLabel===paperLabel)?.pdf||null});
}
const summary=Object.fromEntries(catalog.studies.filter(visibleStudy).map(s=>[s.id,{
  suiteGains:rows.filter(r=>r.study===s.id&&r.level==='L3'&&r.favorable&&r.referenceIsStandard&&!r.paperLabel).length,
  axisGains:rows.filter(r=>r.study===s.id&&r.level==='L2'&&r.favorable&&r.referenceIsStandard&&!r.paperLabel).length
}]));
const paperExamples=rows.filter(r=>r.paperLabel).map(r=>({...r,url:'?'+new URLSearchParams({study:r.study,setting:r.model,reference:r.reference,scope:r.scope,axis:r.axis||'mass',...r.value!==null?{value:r.value}:{}})+'#advanced'}));
for(const [study,model,scope,paperLabel,paperTitle,conditional] of [
 ['rsc_sac_walker','rsc','nominal','fig:rsc-sac-final-nominal-main','Paper: nominal learning and failure',false],
 ['ppo_tv_walker','a2p95','suite','fig:walker-ppo-l2-l3-matched','Paper: does the same local cap generalize?',false],
 ['sac_kl_halfcheetah','klb85','suite','fig:level3-sac-kl-conditional','Paper: method-specific nominal-survivor population',true]
])paperExamples.push({model,reference:'vanilla',paperLabel,paperTitle,paperPdf:index.figures.find(f=>f.paperLabel===paperLabel)?.pdf||null,
 url:'?'+new URLSearchParams({study,setting:model,reference:'vanilla',scope,metric:'reliability',...(conditional?{conditional:'1'}:{})})+'#advanced',
 note:conditional?'Conditional on each method’s own nominally competent policies; not the all-policy comparison.':''});
const payload={version:'20261104-flow1',interpretation:'Descriptive comparisons over measured policy summaries, not hierarchy certification. Same fixed setting throughout each scope; no bootstrap, paired inference or task-success claim.',
criteria:'Favorable = positive mean-return and normalized-AUC differences, complete intended policy counts, and no flagged perturbation-effect warning. Missing or nonpositive-reference comparisons are not promoted.',
sources,rows,summary,paperExamples,mediaCoverage:media.map(({missing,...row})=>row),measuredConditions,favorableConditions,conditionSelection:'One strongest measured condition per setting/axis, ranked by joint gain then AUC difference; ex post. All condition values remain inspectable in the condition slider.'};
fs.writeFileSync(new URL('data/evidence-index.json',root),JSON.stringify(payload)+'\n');
fs.writeFileSync(new URL('data/evidence-summary.json',root),JSON.stringify({summary})+'\n');
fs.writeFileSync(new URL('data/video-coverage.json',root),JSON.stringify({note:'Exact study/model/axis/value coverage. Missing entries are a recording backlog, not a request to launch jobs.',settings:media})+'\n');
console.log(JSON.stringify({studies:sources.length/2,comparisons:rows.length,levels:Object.fromEntries(['L1','L2','L3','condition'].map(l=>[l,rows.filter(r=>r.level===l).length])),favorableSuite:rows.filter(r=>r.level==='L3'&&r.favorable&&!r.paperLabel).length,mediaSettings:media.length}));
