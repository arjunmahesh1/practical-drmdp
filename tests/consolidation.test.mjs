import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bestModelOnAxis,activeModel,label} from '../assets/model.mjs';
import {summarize} from '../assets/appendix-metrics.mjs';
const root=new URL('../',import.meta.url),json=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const catalog=json('data/catalog.json'),index=json('data/appendix/index.json');

test('39 cohorts retain the historical 29 plus ten distinct November 4 cohorts',()=>{
  assert.equal(catalog.studies.length,39);assert.equal(index.studies.length,39);
  assert.equal(index.studies.filter(s=>s.newInRelease).length,10);
  assert.equal(new Set(catalog.studies.map(s=>s.id)).size,39);
  assert.equal(index.figures.length,552);
});
test('full and incomplete Isaac grids retain exact measured setting counts',()=>{
  for(const [id,n,complete] of [['humanoid_ppo_tv30',7,true],['ant_ppo_tv30',2,false],
    ['anymal_ppo_tv30',8,true],['ant_td3_tv30',7,true],['drawer_ppo_tv30',7,true]]){
    const s=json('data/'+id+'.json');assert.equal(s.models.length,n);assert.equal(s.gridComplete,complete);
    for(const a of s.axes)for(const ps of Object.values(a.curves))for(const p of ps)assert.equal(p.n,30);
  }
});
test('KL bypass cannot win an active setting search',()=>{
  const s=json('data/pickcube_sac_kl30.json');assert(s.controls.includes('kl_bypass'));
  assert.equal(s.models.length,6);assert(!s.models.includes('kl_b0.1'));assert(!s.models.includes('kl_b0.3'));
  for(const a of s.axes)assert.notEqual(bestModelOnAxis(s,a),'kl_bypass');
  assert.notEqual(activeModel(s.models),'kl_bypass');assert.equal(label('kl_b1'),'β = 1');
});
test('Pusher negative returns do not acquire arbitrary normalized reliability',()=>{
  const s=json('data/appendix/pusher_td3_tv30.json');
  assert.equal(summarize(s,s.baseline,s.baseline,'suite').auc,null);
  assert(s.note.includes('unverified'));
});
test('report artifacts stay repository-relative and metadata-pending rows stay out of training cohorts',()=>{
  assert.equal(index.deliveries.length,5);
  assert(!catalog.studies.some(s=>s.id.includes('pendulum')));
  for(const d of index.deliveries)for(const key of ['url','pdf','archive','csv','clarification']){
    if(!d[key]||d[key].startsWith('?'))continue;
    assert(fs.existsSync(new URL(d[key],root)),d[key]);
    assert(!d[key].startsWith('http'));
  }
});
test('new policy data contain exact training seeds without weights or private paths',()=>{
  for(const meta of catalog.studies.filter(s=>s.newInRelease)){
    const file='data/appendix/'+meta.id+'.json',s=json(file);
    assert(!/\/Users\/|\/home\/users\/|checkpoint_sha256|model_path/.test(fs.readFileSync(new URL(file,root),'utf8')));
    for(const a of s.axes)for(const ps of Object.values(a.values))for(const p of ps){
      assert.deepEqual(p.seeds.map(r=>r[0]),Array.from({length:30},(_,i)=>1000+i));
      assert(p.seeds.every(r=>Number.isFinite(r[1])));
    }
  }
});
