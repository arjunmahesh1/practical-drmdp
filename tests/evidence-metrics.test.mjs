import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {activeSettings,compareSetting,evidenceRows} from '../assets/evidence-metrics.mjs';
import {archivedStudies,visibleStudy,suppliedEnvironments} from '../assets/results-policy.mjs';
import {normalizedSurvival} from '../assets/browser-metrics.mjs';
const seeds=values=>values.map((v,i)=>[i+1,v]);
const point=(x,values)=>({x,seeds:seeds(values)});
const axis=(id,values)=>({id,title:id,nominal:1,nominalSeeds:{vanilla:seeds([10,10]),cap:seeds([10,10]),noop:seeds([10,10])},values});
const policy={id:'test',baseline:'vanilla',models:['vanilla','cap','noop'],intendedPolicies:2,axes:[axis('a',{vanilla:[point(0,[2,2]),point(1,[10,10]),point(2,[2,2])],cap:[point(0,[8,8]),point(1,[10,10]),point(2,[0,0])],noop:[point(0,[10,10])]}),axis('b',{vanilla:[point(0,[2,2])],cap:[point(0,[8,8])],noop:[point(0,[10,10])]})]};
const curve={...policy,environment:'Test',algorithm:'PPO',family:'TV',controls:['vanilla','noop'],axes:policy.axes.map(a=>({id:a.id,title:a.title,nominal:1,curves:Object.fromEntries(Object.entries(a.values).map(([m,ps])=>[m,ps.map(p=>({x:p.x,mean:p.seeds.reduce((n,s)=>n+s[1],0)/p.seeds.length}))]))}))};
test('single-severity reliability is not an axis aggregate',()=>{
 const single=compareSetting(curve,policy,'cap','condition','a',0),aggregate=compareSetting(curve,policy,'cap','axis','a');
 assert.equal(single.selectedAuc,.8);assert.equal(aggregate.selectedAuc,.4);
 assert.equal(normalizedSurvival(policy,'cap','vanilla','condition','a',0).summary.reliability(.5),1);
 assert.equal(normalizedSurvival(policy,'cap','vanilla','axis','a').summary.reliability(.5),.5);
});
test('suite gives each axis equal weight and never chooses caps per condition',()=>{
 const row=compareSetting(curve,policy,'cap','suite');assert(Math.abs(row.selectedAuc-.6)<1e-12);assert.equal(row.selectedMean,6);assert.equal(row.model,'cap');
 assert.deepEqual(activeSettings(curve),['cap']);assert(evidenceRows(curve,policy).every(r=>r.model==='cap'));
});
test('missing policies and flagged perturbations cannot receive gain badges',()=>{
 const short=structuredClone(policy);short.axes[0].values.cap[0].seeds.pop();assert.equal(compareSetting(curve,short,'cap','condition','a',0).favorable,false);
 const warning=structuredClone(curve);warning.axes[0].warning='Perturbation effectiveness unverified';assert.equal(compareSetting(warning,policy,'cap','condition','a',0).status,'Perturbation unverified');
});
test('nonpositive references stay native, and ties are not positive gains',()=>{
 const negative=structuredClone(policy);negative.axes[0].nominalSeeds.vanilla=seeds([-10,-10]);const row=compareSetting(curve,negative,'cap','condition','a',0);assert.equal(row.selectedAuc,null);assert.equal(row.favorable,false);
 assert.equal(compareSetting(curve,policy,'cap','nominal','a').favorable,false);
});
test('only the three old custom-support/context TD3-KL cohorts are archived',()=>{
 assert.equal(archivedStudies.size,3);assert(!visibleStudy('td3_kl_physical_halfcheetah'));assert(visibleStudy('td3_kl_pickcube'));assert(visibleStudy('td3_kl_lunar'));
 assert.equal(suppliedEnvironments[0].dataset,'json');assert.equal(suppliedEnvironments[1].dataset,'json 2');assert(suppliedEnvironments.every(e=>e.cohorts.length===0));
});
test('derived index binds unchanged sources and discloses inactive paper comparator',()=>{
 const root=new URL('../',import.meta.url),index=JSON.parse(fs.readFileSync(new URL('data/evidence-index.json',root)));
 assert.equal(index.sources.length,72);
 for(const source of index.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(source.file,root))).digest('hex'),source.sha256);
 assert(index.rows.every(r=>visibleStudy(r.study)));
 const paper=index.rows.find(r=>r.paperLabel==='fig:level3-td3-full-suite');assert.equal(paper.reference,'tvc500');assert.equal(paper.referenceIsStandard,false);
 assert(index.rows.some(r=>r.status==='Incomplete policies'));assert(index.rows.some(r=>r.status==='Native returns only'));
});
