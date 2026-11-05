import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {supportedLevel,strongestComparison,auditRows} from '../assets/hierarchy-audit.mjs';
const json=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const metadata=json('data/hierarchy/settings.json'),audit=json('data/hierarchy/assessments.json');
const gates=(L1,L2,L3)=>({L1:{status:L1},L2:{status:L2},L3:{status:L3}});
test('only cumulative evidence supports a level, never a deployment component alone',()=>{
 assert.equal(supportedLevel(gates('fail','pass','pass')).code,'none');
 assert.equal(supportedLevel(gates('borderline','pass','pass')).code,'borderline');
 assert.equal(supportedLevel(gates('blocked','pass','pass')).code,'unassessed');
 assert.equal(supportedLevel(gates('pass','inconclusive','pass')).label,'L1 only');
 assert.equal(supportedLevel(gates('pass','pass','inconclusive')).code,'L2');
 assert.equal(supportedLevel(gates('pass','pass','pass')).code,'L3');
});
test('largest observed AUC cannot override failed prerequisites',()=>{
 const weak={reference:'weak',gates:gates('fail','pass','pass')};weak.gates.L3.d_auc=[.5,.4,.6];
 const valid={reference:'valid',gates:gates('pass','pass','inconclusive')};valid.gates.L3.d_auc=[.02,-.01,.04];
 assert.equal(strongestComparison([weak,valid]).reference,'valid');
});
test('complete all-setting coverage includes every named comparator without replacing originals',()=>{
 assert.equal(Object.keys(audit.comparisons).length,177);
 assert.equal(Object.values(audit.comparisons).flat().length,235);
 assert.equal(audit.cachedValidation.saved_tests_reproduced,428);
 assert(audit.cachedValidation.max_absolute_interval_error<1e-8);
 const before=JSON.stringify(metadata),rows=auditRows(metadata.rows,audit,'all');
 assert.equal(JSON.stringify(metadata),before);
 for(const [id,cs]of Object.entries(audit.comparisons))for(const c of cs)assert(rows.some(r=>r.id===id&&r.reference===c.reference));
});
test('new L3 candidates are fixed ANYmal caps and the exact Walker cap400/control pair',()=>{
 const rows=auditRows(metadata.rows.filter(r=>!r.archived&&r.model),audit);
 assert.deepEqual(rows.filter(r=>r.result.code==='L3').map(r=>[r.id,r.reference]),[
  ['td3_tv_walker|tvc400','tvc500'],['anymal_ppo_tv30|tv_c1.5','vanilla'],['anymal_ppo_tv30|tv_c2','vanilla']]);
 assert.equal(rows.filter(r=>r.result.code==='L2').length,16);
});
test('negative-return references, missing policies and unverified axes retain concrete limitations',()=>{
 assert.equal(audit.comparisons['pusher_ppo_tv30|tv_c-2'][0].gates.L2.status,'blocked');
 assert(audit.comparisons['pusher_ppo_tv30|tv_c-2'][0].invalidAxes[0].includes('not positive'));
 assert.equal(audit.comparisons['sac_kl_walker|klb50'][0].gates.L2.status,'blocked');
 assert.equal(audit.comparisons['td3_tv_halfcheetah|tv_c900'][0].gates.L3.status,'blocked');
});
test('vanilla, original-paper and all-reference modes keep their comparator explicit',()=>{
 const rows=metadata.rows.filter(r=>r.id==='td3_tv_walker|tvc400');
 assert.equal(auditRows(rows,audit,'standard')[0].reference,'vanilla');
 assert.equal(auditRows(rows,audit,'paper')[0].reference,'tvc500');
 assert.equal(auditRows(rows,audit,'all').length,3);
 const fixed=auditRows(metadata.rows,audit,'reference:tvc500');
 assert(fixed.length>1);assert(fixed.every(r=>r.study==='td3_tv_walker'));
});
test('explicit human policy confirmation enables inference without inventing cross-method pairing',()=>{
 const results=[];
 for(const r of auditRows(metadata.rows.filter(r=>r.dataset&&r.role==='robust'),audit)){
  assert(r.audit);assert.equal(r.resampling,'Independent whole policies');assert.notEqual(r.gates.L3.status,'blocked');
  if(r.result.code==='L2')results.push(r.id);
 }
 assert.deepEqual(results,['supplied-json|KL-80','supplied-json|KL-100','supplied-json|KL-110','supplied-json 2|KL-110']);
 assert.equal(audit.pendulumAddendum.sourceScalarsVerified,42600);
 const standard=auditRows(metadata.rows.filter(r=>r.dataset&&r.role==='robust'),audit,'standard');
 assert.equal(standard.length,18);assert(standard.every(r=>r.reference==='non-robust'));
 const failed=auditRows(metadata.rows.filter(r=>r.id==='supplied-json|KL-90'),audit)[0];
 assert.equal(failed.result.code,'none');assert.equal(failed.gates.L2.status,'pass');
 assert.equal(auditRows(metadata.rows.filter(r=>r.id==='supplied-json 2|TV-85'),audit)[0].result.code,'borderline');
});
test('new data retain strict interval decisions without a hidden multiple-testing certificate',()=>{
 for(const c of Object.values(audit.comparisons).flat()){
  for(const t of c.gates.L2.tests)if(t.eligible)assert.equal(t.L2,t.d_auc[1]>0&&t.d_axis_ret[1]>=t.margin);
  if(c.gates.L3.d_auc)assert.equal(c.gates.L3.status==='pass',c.gates.L3.d_auc[1]>0&&c.gates.L3.d_mean[1]>=c.gates.L3.margin);
 }
 assert(audit.inference.includes('unadjusted'));assert(audit.selection.includes('ex post'));
});
