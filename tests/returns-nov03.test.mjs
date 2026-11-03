import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bestModelOnAxis,label} from '../assets/model.mjs';
import {summarize} from '../assets/appendix-metrics.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const ids=['td3_tv_halfcheetah','td3_kl_physical_halfcheetah','sac_tv_pickcube_20261028','td3_tv_pickcube_20261029'];
for(const id of ids)test(id+': thirty seeds and matching policy exports',()=>{
  const s=read('data/'+id+'.json'),a=read('data/appendix/'+id+'.json');
  assert.equal(s.baseline,'vanilla');assert.equal(s.playback,null);assert(!s.replays);
  assert.equal(a.axes.length,s.axes.length);
  for(const axis of s.axes){
    const policy=a.axes.find(x=>x.id===axis.id);
    assert.equal(bestModelOnAxis(s,axis),s.selection.best_per_axis[axis.id]);
    assert(!s.controls.includes(bestModelOnAxis(s,axis)));
    for(const m of s.models)for(const p of axis.curves[m]){
      const rows=policy.values[m].find(x=>x.x===p.x).seeds.map(x=>x[1]);
      assert.equal(rows.length,30);assert.equal(p.n,30);
      assert(Math.abs(rows.reduce((x,y)=>x+y,0)/30-p.mean)<1e-8);
    }
  }
  assert(summarize(a,s.models[1],'vanilla','suite').valid);
  if(id.includes('halfcheetah')){
    const gravity=s.axes.find(a=>a.id==='gravity');
    assert.equal(gravity.nominal,0);assert.equal(gravity.title,'Horizontal gravity');
    assert(gravity.xLabel.includes('m/s^2'));
    assert.equal(s.flatResponseAxes.length,12);
    for(const axis of s.axes.filter(a=>s.flatResponseAxes.includes(a.id)))assert(axis.warning.includes('unverified'));
  }
});
test('HalfCheetah cap 500 is active, not the historical Walker control',()=>{
  const study={baseline:'vanilla',controls:['vanilla','tv_c1100'],models:['vanilla','tv_c500','tv_c1100']};
  const axis={curves:{vanilla:[{mean:1}],tv_c500:[{mean:2}],tv_c1100:[{mean:100}]}};
  assert.equal(bestModelOnAxis(study,axis),'tv_c500');
  assert.equal(label('tv_c500'),'Cap 500');
});
