import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedSurvival,returnDistribution,capSummaries,bestFixedSetting,recordedOutcomes} from '../assets/browser-metrics.mjs';
import {summarize} from '../assets/appendix-metrics.mjs';

const fixture={baseline:'vanilla',models:['vanilla','a1e9','a2p85','a3p00'],intendedPolicies:2,axes:[
  {id:'mass',title:'Mass',nominal:1,nominalSource:'mass',nominalSeeds:{vanilla:[[1,10],[2,10]],a1e9:[[1,10],[2,10]],a2p85:[[1,10],[2,2]],a3p00:[[1,8],[2,8]]},values:{vanilla:[{x:0,seeds:[[1,0],[2,10]]},{x:1,seeds:[[1,10],[2,10]]}],a1e9:[{x:0,seeds:[[1,30],[2,30]]}],a2p85:[{x:0,seeds:[[1,5],[2,15]],outcomes:{crash_fraction:.25}}],a3p00:[{x:0,seeds:[[1,8],[2,8]],outcomes:{crash_fraction:.5}}]}},
  {id:'friction',title:'Friction',nominal:1,nominalSource:'friction',nominalSeeds:{vanilla:[[1,10],[2,10]],a1e9:[[1,10],[2,10]],a2p85:[[1,10],[2,2]],a3p00:[[1,8],[2,8]]},values:{vanilla:[{x:0,seeds:[[1,10],[2,10]]},{x:2,seeds:[[1,10],[2,10]]}],a1e9:[{x:0,seeds:[[1,30],[2,30]]}],a2p85:[{x:0,seeds:[[1,0],[2,0]]},{x:2,seeds:[[1,0],[2,0]]}],a3p00:[{x:0,seeds:[[1,8],[2,8]]}]}}
]};

test('normalized gallery survival reproduces scope summaries at boundaries',()=>{
  for(const scope of ['suite','axis','condition','nominal']){
    const {points,summary}=normalizedSurvival(fixture,'a2p85','vanilla',scope,'mass',0);
    assert.equal(summary.auc,summarize(fixture,'a2p85','vanilla',scope,'mass',0).auc);
    assert.equal(points[0][1],summary.reliability(0));assert.equal(points.at(-1)[1],summary.reliability(1));
    for(let i=1;i<points.length;i++){assert(points[i][0]>=points[i-1][0]);assert(points[i][1]<=points[i-1][1]+1e-12);}
  }
});
test('conditional population remains method-specific',()=>{
  const {summary}=normalizedSurvival(fixture,'a2p85','vanilla','axis','mass',0,true);
  assert.equal(summary.minN,1);assert.equal(summary.auc,.5);
});
test('nonpositive reference has no manufactured normalized curve',()=>{
  const s=structuredClone(fixture);s.axes[0].nominalSeeds.vanilla=[[1,-10],[2,-10]];
  assert.deepEqual(normalizedSurvival(s,'a2p85','vanilla','axis','mass').points,[]);
  assert(returnDistribution(s,'a2p85','vanilla','axis','mass').length>0);
});
test('return CDF is increasing, including tied values',()=>{
  const points=returnDistribution(fixture,'a3p00','vanilla','suite');
  assert.deepEqual(points,[[8,0],[8,1]]);
});
test('cap summary weights axes equally rather than counting grid points',()=>{
  const rows=capSummaries(fixture,'vanilla');
  assert.equal(rows.find(r=>r.model==='a2p85').suite.raw,5);
  assert.equal(rows.find(r=>r.model==='a3p00').suite.raw,8);
});
test('best fixed setting excludes inactive controls despite their higher score',()=>{
  assert.equal(bestFixedSetting(fixture,'vanilla'),'a3p00');
});
test('missing policies are retained as missing counts, not imputed',()=>{
  const s=structuredClone(fixture);s.axes[0].values.a3p00[0].seeds=[[1,8]];
  const row=capSummaries(s,'vanilla').find(r=>r.model==='a3p00');
  assert.equal(row.suite.minN,1);assert.equal(row.suite.maxN,2);assert.equal(row.suite.raw,8);
});
test('outcome fields are not inferred from returns or incomplete conditions',()=>{
  assert.deepEqual(recordedOutcomes(fixture,'vanilla','vanilla','suite'),{});
  assert.equal(recordedOutcomes(fixture,'a2p85','vanilla','condition','mass',0).crash_fraction,.25);
  assert.equal(recordedOutcomes(fixture,'a2p85','vanilla','suite').crash_fraction,null);
});
