import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {label,activeModel,nearestPoint,bounds,factorLabel} from '../assets/model.mjs';
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
