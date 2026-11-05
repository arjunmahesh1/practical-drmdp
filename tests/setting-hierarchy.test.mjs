import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cumulativeResult,splitGate,matchesSetting,settingsCSV} from '../assets/setting-hierarchy.mjs';
const gate=status=>({status}),gates=(L1,L2,L3)=>({L1:gate(L1),L2:gate(L2),L3:gate(L3)});
test('higher-level evidence cannot bypass missing or failed nominal competence',()=>{
  assert.equal(cumulativeResult(gates('unassessed','pass','pass')).code,'unassessed');
  assert.equal(cumulativeResult(gates('borderline','pass','pass')).code,'borderline');
  assert.equal(cumulativeResult(gates('fail','pass','pass')).code,'none');
  assert.equal(cumulativeResult(gates('pass','unassessed','pass')).code,'L1');
  assert.equal(cumulativeResult(gates('pass','pass','pass')).code,'L3');
});
test('inconclusive evidence is not a pass, and untested evidence is not failure',()=>{
  assert.equal(cumulativeResult(gates('pass','pass','inconclusive')).code,'L2');
  assert.equal(cumulativeResult(gates('pass','unassessed','unassessed')).label,'At least L1');
  assert.equal(cumulativeResult(gates('unassessed','unassessed','unassessed')).code,'unassessed');
  assert.equal(cumulativeResult(gates('fail','fail','fail'),'reference').code,'reference');
  assert.equal(cumulativeResult(gates('fail','fail','fail'),'control').code,'control');
});
test('a saved side-of-axis test retains its exact two-sided return guardrail',()=>{
  const tests=[{axis:'friction',side:'low',n:30,L2:true,repair:true,no_harm:1,d_auc:[.09,.002,.17],d_axis_ret:[274,-55,601],margin:-84}];
  const before=JSON.stringify(tests),g=splitGate(tests,38);
  assert.equal(g.status,'pass');assert.equal(g.tested,1);assert.equal(g.declared,38);
  assert.equal(g.tests[0].side,'low');assert.equal(g.tests[0].margin,-84);assert.equal(JSON.stringify(tests),before);
});
test('unselected, incomplete and ineffective-perturbation tests cannot become negative or positive claims',()=>{
  assert.equal(splitGate([{axis:'a',n:30,L2:false}],2).status,'unassessed');
  assert.equal(splitGate([{axis:'a',n:30,L2:false}],1).status,'fail');
  assert.equal(splitGate([{axis:'a',n:29,L2:true}],1).status,'unassessed');
  assert.equal(splitGate([{axis:'a',n:30,L2:true}],1,['a']).status,'unassessed');
});
test('filters keep archived settings opt-in and exported unknowns explicit',()=>{
  const r={environment:'Test',algorithm:'PPO',family:'TV',branch:'main',model:'cap',settingLabel:'Cap',referenceLabel:'Standard',archived:true,result:{code:'unassessed',label:'Not assessed'},gates:gates('unassessed','unassessed','unassessed')};
  assert(!matchesSetting(r));assert(matchesSetting(r,{archive:true,search:'PPO'}));
  assert(settingsCSV([r]).includes('"unassessed","unassessed","unassessed"'));
});

test('inventory covers each published setting exactly once without pooling cohorts',()=>{
  const json=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
  const inventory=json('data/hierarchy/settings.json'),catalog=json('data/catalog.json');
  assert.equal(inventory.rows.length,249);assert.equal(new Set(inventory.rows.map(r=>r.id)).size,249);
  for(const s of catalog.studies)for(const m of s.models)assert.equal(inventory.rows.filter(r=>r.study===s.id&&r.model===m).length,1);
  assert.equal(inventory.rows.filter(r=>r.dataset).length,20);
  assert.equal(inventory.rows.filter(r=>!r.model).length,4);
  for(const r of inventory.rows)assert.deepEqual(r.result,cumulativeResult(r.gates,r.role));
});
test('reported L3 uses the author-approved Results and its exact inactive comparator',()=>{
  const inventory=JSON.parse(fs.readFileSync(new URL('../data/hierarchy/settings.json',import.meta.url)));
  const l3=inventory.rows.filter(r=>r.result.code==='L3');assert.equal(l3.length,1);
  assert.equal(l3[0].id,'td3_tv_walker|tvc400');assert.equal(l3[0].reference,'tvc500');
  assert.equal(l3[0].gates.L3.basis,'manuscript report');
  assert(l3[0].gates.L3.note.includes('OLD: Experiment Results is ignored'));
  const sac=inventory.rows.find(r=>r.id==='sac_kl_halfcheetah|klb85');
  assert.equal(sac.result.code,'L2');assert.equal(sac.gates.L3.status,'inconclusive');
});
test('qualitative L1 preserves borderlines, missing policies and unknown supplied algorithms',()=>{
  const inventory=JSON.parse(fs.readFileSync(new URL('../data/hierarchy/settings.json',import.meta.url)));
  const ppo=inventory.rows.find(r=>r.id==='ppo_tv_walker|a3p10');
  assert.equal(ppo.result.code,'borderline');assert.equal(ppo.gates.L2.passed,2);
  const short=inventory.rows.find(r=>r.id==='sac_kl_walker|klb50');
  assert.equal(short.nominal.policies,29);assert.equal(short.gates.L1.status,'unassessed');
  for(const r of inventory.rows.filter(r=>r.dataset)){assert.equal(r.algorithm,'Unconfirmed');assert.equal(r.gates.L1.status,'unassessed');}
  for(const r of inventory.rows.filter(r=>r.result.code==='none'))assert.equal(r.gates.L1.status,'fail');
});
