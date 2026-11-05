import test from 'node:test';
import assert from 'node:assert/strict';
import {bestModelOnAxis} from '../assets/model.mjs';

const points=(...returns)=>returns.map((mean,x)=>({x,mean}));
test('best cap uses full-grid mean, excludes the standard and inactive controls',()=>{
  const study={baseline:'vanilla',models:['vanilla','kl_bypass','cap1','cap2'],controls:['kl_bypass']};
  const axis={curves:{vanilla:points(100,100),kl_bypass:points(500,500),cap1:points(50,0),cap2:points(30,30)}};
  const before=JSON.stringify(axis);
  assert.equal(bestModelOnAxis(study,axis),'cap2');
  assert.equal(JSON.stringify(axis),before);
});
test('best active cap can change with the axis and preserves deterministic ties',()=>{
  const study={baseline:'vanilla',models:['vanilla','cap1','cap2'],controls:[]};
  assert.equal(bestModelOnAxis(study,{curves:{cap1:points(1,4),cap2:points(2,2)}}),'cap1');
  assert.equal(bestModelOnAxis(study,{curves:{cap1:points(1,1),cap2:points(2,2)}}),'cap2');
  assert.equal(bestModelOnAxis(study,{curves:{cap1:points(2,2),cap2:points(2,2)}}),'cap1');
});
test('no eligible active settings leaves the command unavailable',()=>{
  assert.equal(bestModelOnAxis({baseline:'vanilla',models:['vanilla','kl_bypass'],controls:['kl_bypass']},
    {curves:{vanilla:points(1),kl_bypass:points(2)}}),null);
});
