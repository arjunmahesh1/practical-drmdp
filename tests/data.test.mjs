import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {label,activeModel,nearestPoint,bounds,factorLabel,gridMean,bestModelOnAxis,axisLabel,recordingCount} from '../assets/model.mjs';
const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const catalog=await json('data/catalog.json');

test('catalog keeps environment versions and unique studies',()=>{
  assert.equal(new Set(catalog.studies.map(s=>s.id)).size,catalog.studies.length);
  assert(catalog.studies.some(s=>s.environment==='Walker2d-v4'));
  assert(catalog.studies.some(s=>s.environment==='Walker2d-v5'));
});
for(const meta of catalog.studies){
  test(meta.id+': finite, aligned measured grids and separate standard',async()=>{
    const s=await json('data/'+meta.file);
    assert(s.models.includes(s.baseline));assert.equal(s.baseline,'vanilla');
    assert(s.models.includes(activeModel(s.models)));
    assert.equal(s.axes.length,meta.axisCount);
    for(const axis of s.axes){
      const grid=axis.curves[s.baseline].map(p=>p.x);
      assert.equal(new Set(grid).size,grid.length);
      assert.deepEqual(grid,[...grid].sort((a,b)=>a-b));
      assert(Number.isFinite(axis.nominal));
      for(const model of s.models){
        assert.deepEqual(axis.curves[model].map(p=>p.x),grid);
        for(const p of axis.curves[model]){
          assert([p.x,p.mean,p.sd,p.n].every(Number.isFinite));
          assert(p.sd>=0);assert(Number.isInteger(p.n)&&p.n>0);
        }
      }
      const [lo,hi]=bounds(axis);assert(lo<hi);
    }
  });
}
test('every delivered PDF exists and has a PDF signature',async()=>{
  for(const panel of catalog.gallery){
    const bytes=await readFile(new URL(panel.pdf,root));
    assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  }
});
test('public data contain no local absolute paths or credentials',async()=>{
  for(const name of ['catalog.json',...catalog.studies.map(s=>s.file)]){
    const text=await readFile(new URL('data/'+name,root),'utf8');
    assert(!/\/Users\/|\/home\/users\/|ghp_[A-Za-z0-9]+|github_pat_|BEGIN (?:RSA|OPENSSH) PRIVATE/.test(text),name);
  }
});
test('labels distinguish inactive controls and negative value caps',()=>{
  assert.equal(label('tv_c-2.5'),'Cap -2.5');
  assert.notEqual(label('tvc1e9'),label('vanilla'));
  assert.equal(label('kl_beta10'),'β = 10');
  assert.equal(factorLabel({id:'translation_replacement'},.2,'PickCube-v1'),'20%');
  assert.equal(nearestPoint([{x:.5},{x:1},{x:2}],1.2),1);
});
test('unmeasured nominal noise point is not invented',async()=>{
  const s=await json('data/ppo_tv_walker.json');
  const a=s.axes.find(a=>a.id==='action_noise');
  assert.equal(a.nominal,0);assert(!a.curves.vanilla.some(p=>p.x===0));
});
test('best means highest full-grid mean, not the best single severity or an inactive control',()=>{
  const study={baseline:'vanilla',models:['vanilla','tvc1e9','tvc3','tvc10']};
  const axis={curves:{vanilla:[{mean:100},{mean:100}],tvc1e9:[{mean:999},{mean:999}],tvc3:[{mean:20},{mean:-30}],tvc10:[{mean:0},{mean:0}]}};
  assert.equal(bestModelOnAxis(study,axis),'tvc10');
  assert.equal(gridMean(axis.curves.tvc3),-5);
});
test('paper six-cell ex-post choices are preserved',async()=>{
  const expected={ppo_tv_pickcube:'tv_c3',ppo_tv_pusher:'tv_c-1',td3_tv_pickcube:'tv_c20',td3_kl_pickcube:'kl_beta10'};
  for(const [cell,model] of Object.entries(expected)){
    const s=await json('data/'+cell+'.json');
    for(const a of s.axes)assert.equal(bestModelOnAxis(s,a),model,cell+' '+a.id);
  }
  const s=await json('data/sac_tv_pusher.json');
  assert.equal(bestModelOnAxis(s,s.axes.find(a=>a.id==='goal_distance')),'tv_c-2.5');
  assert.equal(bestModelOnAxis(s,s.axes.find(a=>a.id==='object_mass')),'tv_c-1.5');
});
test('axis labels distinguish scales, action probabilities and dimensional gravity',()=>{
  assert.equal(axisLabel({id:'mass'},'Walker2d-v5'),'Parameter scale (×)');
  assert.equal(axisLabel({id:'action_replacement'},'Pusher-v5'),'Replacement probability');
  assert.equal(axisLabel({id:'gravity'},'LunarLander-v3'),'Gravity (m/s²)');
});
test('recording counts require exact model, axis and severity',()=>{
  const axis={id:'mass',curves:{vanilla:[{x:1},{x:2}],tvc60:[{x:1},{x:2}]}};
  const study={replays:{vanilla:{'mass|1':'one.json','friction|2':'other.json'},tvc60:{'mass|1':'cap.json','mass|2':'two.json'}}};
  assert.equal(recordingCount(study,axis,'vanilla'),1);
  assert.equal(recordingCount(study,axis,'tvc60'),2);
  assert.equal(recordingCount({},axis,'vanilla'),0);
});
test('linked recordings are exact study/model/axis/value selections, not fabricated aggregate episodes',async()=>{
  for(const meta of catalog.studies){
    const s=await json('data/'+meta.file);
    for(const [model,entries] of Object.entries(s.replays||{}))for(const [key,path] of Object.entries(entries)){
      const r=await json(path);assert.equal(r.study,s.id);assert.equal(r.model,model);
      assert.equal(key,r.axis+'|'+r.value);assert.equal(r.kind,'video');
      assert(r.deterministic);
      if(r.normalizationMode==='none'){
        assert.equal(r.loader,'td3');assert.equal(r.normalizationSha256,null);
        assert.equal(r.observationNormalizationFrozen,false);
      }else assert(r.observationNormalizationFrozen);
      assert(r.timeline.length>1);
      assert(r.steps<=({'Pusher-v5':100,'PickCube-v1':50,'LunarLander-v3':1000,'Walker2d-v4':1000,'Walker2d-v5':1000,'HalfCheetah-v4':1000}[r.environment]));
      assert.equal(r.timeline.at(-1).step,r.steps);
      assert.equal(r.timeline.at(-1).reward,r.returnValue);
      assert(r.timeline.every(p=>[p.step,p.time,p.reward].every(Number.isFinite)));
      if(r.video.startsWith('https:')){
        assert(r.video.startsWith('https://github.com/arjunmahesh1/practical-drmdp/releases/download/'));
        assert.match(r.videoSha256,/^[a-f0-9]{64}$/);assert(r.releaseAssetId>0);
      }
      if(!r.video.startsWith('https:')){
        const bytes=await readFile(new URL(r.video,root));assert(bytes.length>1000);
        assert.equal(bytes.subarray(4,8).toString(),'ftyp');
      }
    }
  }
});
