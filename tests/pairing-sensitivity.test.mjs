import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditView} from '../assets/pairing-audit.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/new-cells/'+p,import.meta.url)));
const original=read('audit.json'),sensitivity=read('sensitivity.json');
test('the six-cell audit uses design-correct methods, with explicit cross-batch exceptions',()=>{
 assert.equal(sensitivity.summary.comparisons,33);assert.equal(sensitivity.summary.pairedPrimary,23);assert.equal(sensitivity.summary.independentPrimary,10);
 for(const c of sensitivity.cells)assert.equal(c.primary,c.study.startsWith('pickcube_')?'independent':'paired');
 assert(sensitivity.exceptions.some(e=>e.includes('HalfCheetah')));assert(sensitivity.exceptions.some(e=>e.includes('Duke versus DeltaAI')));
});
test('all original paired numbers stay reproducible and all intervals retain the same point estimate',()=>{
 for(const c of sensitivity.cells){const saved=original.cells.find(x=>x.study===c.study);
  for(const [model,s] of Object.entries(c.settings)){
   assert(Math.abs(s.suite.paired.d_rel[0]-saved.settings[model].suite_d_rel[0])<1e-12);
   assert.equal(s.suite.paired.passes,Boolean(saved.settings[model].L3));
   for(const t of [s.suite,...s.shifts])for(const m of ['paired','independent']){
    assert.equal(t[m].d_rel[0],t.paired.d_rel[0]);assert.equal(t[m].d_ret[0],t.paired.d_ret[0]);
    assert.equal(t[m].passes,t[m].repair&&t[m].no_harm);
    assert(t[m].d_rel.every(Number.isFinite)&&t[m].d_ret.every(Number.isFinite));
   }
  }
 }
});
test('headline suite verdicts survive, but three eligible local verdicts change',()=>{
 assert.equal(sensitivity.summary.changedSuiteVerdicts,0);assert.equal(sensitivity.summary.changedShiftVerdicts,5);assert.equal(sensitivity.summary.changedEligibleShiftVerdicts,3);
 const changed=sensitivity.changes.filter(c=>c.eligible&&c.components.includes('passes')).map(c=>c.study+'|'+c.model+'|'+c.scope).sort();
 assert.deepEqual(changed,['drawer_sac_tv30|tv_c24|arm_strength/low','pickcube_sac_kl30|kl_b10|arm_command_gain/high','pusher_td3_kl_delta30|kl_b300|goal_distance/high'].sort());
});
test('the current view uses independent PickCube intervals and does not mutate the original import',()=>{
 const c=original.cells.find(c=>c.study==='pickcube_sac_kl30'),before=JSON.stringify(c),row=auditView(c,'kl_b10',sensitivity);
 assert.equal(row.method,'independent');assert.equal(row.L2_pass.length,1);assert.equal(c.settings.kl_b10.L2_pass.length,0);assert.equal(JSON.stringify(c),before);
 assert.equal(row.L3,false);
});
test('unverified Pusher friction tests cannot become eligible repairs',()=>{
 const c=original.cells.find(c=>c.study==='pusher_td3_kl_delta30'),row=auditView(c,'kl_bypass',sensitivity);
 assert.equal(row.L2_pass.length,3);assert.equal(row.eligibleRepairs.length,1);
 assert(row.shifts.filter(s=>s.shift.startsWith('friction/')).every(s=>!s.eligible));
});
test('both Drawer SAC suite wins remain under both methods',()=>{
 const c=sensitivity.cells.find(c=>c.study==='drawer_sac_tv30');
 for(const m of ['tv_c20','tv_c24'])for(const method of ['paired','independent'])assert(c.settings[m].suite[method].passes);
 assert.equal(c.settings.tv_c24.pairedRepairs.length,12);assert.equal(c.settings.tv_c24.independentRepairs.length,11);
});
