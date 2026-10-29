import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mean,median,summarize,severity,rawReliability} from '../assets/appendix-metrics.mjs';
const json=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const index=await json('data/appendix/index.json');
const fixture={baseline:'vanilla',models:['vanilla','cap'],axes:[
  {id:'a',title:'A',nominal:1,nominalSource:'a',nominalSeeds:{vanilla:[[1,10],[2,10]],cap:[[1,10],[2,2]]},values:{vanilla:[{x:0,seeds:[[1,0],[2,10]]},{x:1,seeds:[[1,10],[2,10]]}],cap:[{x:0,seeds:[[1,5],[2,15]]},{x:1,seeds:[[1,10],[2,2]]}]}},
  {id:'b',title:'B',nominal:1,nominalSource:'b',nominalSeeds:{vanilla:[[1,10],[2,10]],cap:[[1,10],[2,2]]},values:{vanilla:[{x:0,seeds:[[1,10],[2,10]]},{x:1,seeds:[[1,10],[2,10]]},{x:2,seeds:[[1,10],[2,10]]}],cap:[{x:0,seeds:[[1,0],[2,0]]},{x:1,seeds:[[1,10],[2,2]]},{x:2,seeds:[[1,0],[2,0]]}]}}
]};
test('median and mean preserve zero rather than missingness',()=>{assert.equal(mean([0,10]),5);assert.equal(median([1,3,2,4]),2.5);assert.equal(mean([]),null);});
test('suite gives equal axis weights despite unequal condition counts',()=>{
  const s=summarize(fixture,'cap','vanilla');assert.equal(s.raw,5);assert.equal(s.auc,.375);assert.equal(s.reliability(.5),.5);assert.equal(s.catastrophe,.5);assert.equal(s.conditionCount,3);
});
test('condition uses >= and analytic clipping, including returns over the nominal median',()=>{
  const s=summarize(fixture,'cap','vanilla','condition','a',0);assert.equal(s.auc,.75);assert.equal(s.reliability(.5),1);assert.equal(s.reliability(.5001),.5);
});
test('conditional excludes only the method own nominal failures; empty populations undefined',()=>{
  const s=summarize(fixture,'cap','vanilla','axis','a',null,true);assert.equal(s.minN,1);assert.equal(s.auc,.5);
  const f=structuredClone(fixture);f.axes[0].nominalSeeds.cap=[[1,0],[2,0]];assert.equal(summarize(f,'cap','vanilla','axis','a',null,true).auc,null);
});
test('negative references do not manufacture retained-performance metrics',()=>{
  const f=structuredClone(fixture);f.axes[0].nominalSeeds.vanilla=[[1,-10],[2,-5]];const s=summarize(f,'cap','vanilla','axis','a');assert.equal(s.auc,null);assert.equal(s.raw,10);assert.equal(severity(f,'vanilla')[0].value,null);
});
test('seed summaries retain equal-axis weights',()=>{const s=summarize(fixture,'cap','vanilla');assert.equal(s.seeds.find(s=>s.seed===1).raw,2.5);assert.equal(s.seeds.find(s=>s.seed===2).raw,7.5);});
test('native-return reliability preserves thresholds and equal-axis weighting',()=>{const s=rawReliability(fixture,'cap','vanilla','suite');assert.equal(s.survival(5),.5);assert.equal(s.survival(5.01),.25);assert.equal(s.survival(16),0);assert.equal(s.survival(-1),1);});
test('all 25 current cohorts have validated policy summaries and all published points are reproduced',async()=>{
  assert.equal(index.studies.length,25);const receipt=await json('data/appendix/export-receipt.json');assert.equal(receipt.comparedCurvePoints,28800);assert.deepEqual(receipt.gaps,[]);
  for(const meta of index.studies){assert(meta.validated);const a=await json(meta.file),s=await json('data/'+meta.id+'.json');for(const axis of a.axes)for(const model of a.models){for(const point of axis.values[model]){const published=s.axes.find(x=>x.id===axis.id).curves[model].find(p=>p.x===point.x);assert.equal(new Set(point.seeds.map(r=>r[0])).size,point.seeds.length);assert.equal(point.seeds.length,published.n);assert(Math.abs(mean(point.seeds.map(r=>r[1]))-published.mean)<1e-7);const sd=Math.sqrt(point.seeds.reduce((n,r)=>n+(r[1]-published.mean)**2,0)/(point.seeds.length-1));assert(Math.abs(sd-published.sd)<1e-7);}}}
});
test('all original 20 study files remain byte-identical',async()=>{const r=await json('data/appendix/export-receipt.json');assert.equal(Object.keys(r.preservedStudies).length,20);for(const [file,sha] of Object.entries(r.preservedStudies)){assert.equal(createHash('sha256').update(await readFile(new URL('../data/'+file,import.meta.url))).digest('hex'),sha);}});
test('paper SAC-KL all-policy metric reproduces the manuscript within displayed precision',async()=>{const s=await json('data/appendix/sac_kl_halfcheetah.json');assert(Math.abs(summarize(s,'klb85','vanilla').auc-.7718)<.00005);assert(Math.abs(summarize(s,'vanilla','vanilla').auc-.7298)<.00005);});
test('TD3 same-cohort comparator reproduces the paper without substituting ordinary TD3',async()=>{const s=await json('data/appendix/td3_tv_walker.json');assert(Math.abs(summarize(s,'tvc400','tvc500').auc-.7266)<.00005);assert(Math.abs(summarize(s,'tvc500','tvc500').auc-.6781)<.00005);assert(Math.abs(summarize(s,'tvc400','vanilla').auc-.7266)>.001);});
test('recorded outcomes remain separate from policy reliability',async()=>{const s=await json('data/appendix/lunar_sac_tv.json');const p=s.axes[0].values.vanilla[0];assert(p.outcomes);for(const v of Object.values(p.outcomes))assert(v>=0&&v<=1);const pick=await json('data/appendix/ppo_tv_pickcube_20261028.json');assert(!pick.axes[0].values.vanilla[0].outcomes);});
test('failed final counts remain measured-only, with no invented rows',async()=>{const s=await json('data/appendix/sac_kl_walker.json');const a=summarize(s,'klb50','vanilla');assert.equal(a.minN,29);assert.equal(a.maxN,29);assert.equal(s.intendedPolicies,30);const l=await json('data/appendix/lunar_sac_kl.json');assert.equal(summarize(l,'kl_beta10','vanilla').minN,26);});
test('all indexed advanced PDFs and image previews exist; source hashes retained',async()=>{for(const f of index.figures){const b=await readFile(new URL('../'+f.pdf,import.meta.url));assert.equal(b.subarray(0,5).toString(),'%PDF-');if(f.sha256)assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);if(f.preview){const p=await readFile(new URL('../'+f.preview,import.meta.url));assert(p.length>1000);}}});
test('public appendix contains only allowlisted summaries, not credentials or local checkpoint paths',async()=>{for(const path of ['data/appendix/index.json',...index.studies.map(s=>s.file)]){const s=await readFile(new URL('../'+path,import.meta.url),'utf8');assert(!/\/Users\/|\/home\/users\/|github_pat_|ghp_|BEGIN .*PRIVATE KEY|model_path|norm_stats_path/.test(s),path);}});
