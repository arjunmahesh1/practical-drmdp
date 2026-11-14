import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dimensions,metricKey,levelOf,scopeLabel,evidenceBound,pentagon} from '../assets/profile-metrics.mjs';
const data=JSON.parse(readFileSync(new URL('../data/profiles/index.json',import.meta.url)));
const find=(study,model,reference='vanilla')=>data.rows.find(r=>r.study===study&&r.model===model&&r.reference===reference);
test('five independent axes and explicit band selection',()=>{
 assert.equal(dimensions.length,5);assert.equal(metricKey('band','degraded'),'degraded');
 assert.equal(scopeLabel(null),'Unavailable');assert.equal(scopeLabel(0),'Not established');
});
test('reliability does not inherit a failing return guardrail',()=>{
 const r=find('drawer_td3_tv30','tv_c12');assert.equal(levelOf(r,'mean'),0);assert.equal(levelOf(r,'reliability'),3);
 assert.ok(r.suite.tests.mean.paired.interval[2]<0);
});
test('band profiles are not a best-band envelope',()=>{
 const r=find('drawer_sac_tv30','tv_c24');assert.equal(levelOf(r,'band','failure'),0);assert.equal(levelOf(r,'band','degraded'),3);
});
test('signed native tasks retain mean, not ratio-based claims',()=>{
 const r=find('pusher_td3_kl_delta30','kl_b30');assert.notEqual(levelOf(r,'mean'),null);
 for(const d of dimensions.slice(1))assert.equal(levelOf(r,d),null);
 const svg=pentagon(r);assert.match(svg,/Unavailable/);assert.doesNotMatch(svg,/NaN|Infinity/);
});
test('ineligible suite cannot rise to L3',()=>{
 const r=find('td3_tv_halfcheetah','tv_c700');assert.ok(r.unverifiedAxes.length);
 for(const d of dimensions)assert.notEqual(levelOf(r,d),3);
 assert.equal(evidenceBound(r.suite.tests.mean,'mean',r.primary),-Infinity);
});
test('ordinary standard and bypass references remain separate',()=>{
 const a=find('pickcube_td3_kl30','kl_b3'),b=find('pickcube_td3_kl30','kl_b3','kl_bypass');
 assert.equal(a.primary,'independent');assert.equal(b.primary,'paired');assert.notEqual(a.comparisonId,b.comparisonId);
 assert.equal(levelOf(a,'consistency'),3);assert.notEqual(levelOf(b,'consistency'),3);
});
test('full-30 completeness does not impute failed policies',()=>{
 const r=find('sac_kl_walker','klb50');assert.equal(levelOf(r,'mean'),null);
 assert.match(r.suite.reason,/29\/30/);
});
test('pentagon contains explicit scopes and no nonfinite coordinates',()=>{
 const r=find('anymal_ppo_tv30','tv_c1.5'),svg=pentagon(r);
 assert.match(svg,/Mean return: L3/);assert.doesNotMatch(svg,/NaN|Infinity/);assert.equal((svg.match(/<circle/g)||[]).length,5);
});
