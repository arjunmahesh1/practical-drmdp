import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeOutcomes} from '../assets/new-cell-outcomes.mjs';
import {klOffContrast,auditLink} from '../assets/new-cell-audit.mjs';
import {summarize} from '../assets/appendix-metrics.mjs';
import {recordedOutcomes} from '../assets/browser-metrics.mjs';
import {label,bestModelOnAxis} from '../assets/model.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url)));
const audit=read('new-cells/audit.json'),overlay=read('new-cells/outcomes.json');
test('all four new cohorts have complete finite policy grids and axis-specific nominal references',()=>{
  for(const id of ['drawer_sac_tv30','drawer_td3_tv30','pickcube_td3_kl30','pusher_td3_kl_delta30']){
    const curve=read(id+'.json'),policy=read('appendix/'+id+'.json');
    assert(curve.models.includes('vanilla'));assert.equal(policy.intendedPolicies,30);
    for(const axis of policy.axes)for(const model of policy.models){
      const nominal=axis.values[model].find(p=>p.x===axis.nominal);
      assert.deepEqual(axis.nominalSeeds[model],nominal.seeds);
      for(const point of axis.values[model]){assert.equal(point.seeds.length,30);assert.equal(new Set(point.seeds.map(s=>s[0])).size,30);assert(point.seeds.every(s=>Number.isFinite(s[1])));}
    }
    assert(!curve.replays);assert.equal(curve.playback,null);
  }
});
test('Drawer SAC supplied wins and adverse caps remain intact',()=>{
  const c=audit.cells.find(c=>c.study==='drawer_sac_tv30');
  for(const m of ['tv_c20','tv_c24']){assert(c.settings[m].L3);assert.equal(c.settings[m].L2_pass.length,12);}
  assert.equal(c.settings.tv_c20.suite_d_rel[0],.15613426133961264);
  assert.equal(c.settings.tv_c24.nominal_success,.965);
  for(const m of ['tv_c10','tv_c12','tv_c16']){assert(c.settings[m].nominal_success<.4);assert(!c.settings[m].L3);}
});
test('KL-off control is explicit and cannot be selected as best active cap',()=>{
  assert.equal(label('kl_bypass'),'KL off');
  const c=audit.cells.find(c=>c.study==='pickcube_td3_kl30'),curve=read(c.study+'.json');
  assert(c.settings.kl_bypass.L3);assert.equal(c.settings['kl_b0.3'].nominal_success,.002);
  assert(Math.abs(klOffContrast(c,c.settings.kl_b3).reliability-.007279382)<1e-6);
  for(const axis of curve.axes)assert.notEqual(bestModelOnAxis(curve,axis),'kl_bypass');
  assert(audit.profile.includes('Pairing design not confirmed'));
});
test('negative Pusher returns never acquire normalized AUC or invented native success',()=>{
  const c=audit.cells.find(c=>c.study==='pusher_td3_kl_delta30'),s=read('appendix/'+c.study+'.json');
  assert.equal(c.reliability,'success rate');assert.equal(c.settings.kl_b300.L2_pass.length,1);assert.equal(c.settings.kl_bypass.L2_pass.length,3);
  assert(Object.values(c.settings).every(s=>!s.L3));
  assert.deepEqual(c.unverifiedAxes,['friction']);
  assert.equal(summarize(s,'kl_b300','vanilla','suite').auc,null);
  assert(recordedOutcomes(s,'kl_b300','vanilla','suite').success_once>0);
});
test('incomplete PickCube settings retain all eight failed slots without averaged returns',()=>{
  const partial=audit.cells.flatMap(c=>c.incompleteSettings||[]);
  assert.equal(partial.length,4);assert.equal(partial.reduce((n,s)=>n+s.failed,0),8);
  for(const s of partial){assert.equal(s.completed+s.failed,30);assert.equal(s.failedReturns,null);assert.equal(s.exported,false);}
  assert.equal(read('pickcube_td3_kl30.json').gridComplete,false);
});
test('outcome overlay enriches existing exports without mutation, including nominal scope',()=>{
  const s=read('appendix/drawer_ppo_tv30.json'),before=JSON.stringify(s),next=mergeOutcomes(s,overlay);
  assert.equal(JSON.stringify(s),before);assert.deepEqual(next.axes[0].values.vanilla[0].seeds,s.axes[0].values.vanilla[0].seeds);
  assert(Number.isFinite(recordedOutcomes(next,'vanilla','vanilla','nominal',next.axes[0].id).success_at_end));
  assert.equal(mergeOutcomes(s,{}),s);
});
test('return guardrail failures, negative comparisons and exact links are retained',()=>{
  const td3=audit.cells.find(c=>c.study==='drawer_td3_tv30');assert(td3.settings.tv_c12.suite_d_rel[1]>0);assert(td3.settings.tv_c12.suite_d_ret[1]<td3.settings.tv_c12.suite_margin);assert(!td3.settings.tv_c12.L3);
  const sac=audit.cells.find(c=>c.study==='pickcube_sac_kl30');assert(sac.settings.kl_b1.suite_d_rel[0]<-.02);
  const link=new URL(auditLink(sac,'kl_b1','returns',{axis:'cube_mass'}),'http://localhost');
  assert.equal(link.searchParams.get('reference'),'vanilla');assert.equal(link.searchParams.get('axis'),'cube_mass');assert.equal(link.hash,'#returns');
});
