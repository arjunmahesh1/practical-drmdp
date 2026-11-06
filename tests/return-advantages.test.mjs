import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moments,classify,ranges,matchingRows} from '../assets/return-advantages.mjs';
import {resultLink,filterQuery,filtersFromQuery} from '../assets/return-advantages-browser.mjs';
const point=(x,r=8,extra={})=>classify({x,standard:2,robust:r,standardSD:1,robustSD:1,complete:true,nominal:false,...extra});
test('native negative returns and sample SD are preserved',()=>{
  assert.deepEqual(moments([-3,-2,-1]),{mean:-2,sd:1,n:3});
  assert.equal(classify({standard:-10,robust:-5,standardSD:1,robustSD:1}).separated,true);
  assert.equal(moments([1,NaN]),null);
});
test('higher means do not imply separated SD bands',()=>{
  const p=point(0,3);assert.equal(p.positive,true);assert.equal(p.separated,false);
  assert.equal(point(0,2+1e-12).positive,false);
  assert.equal(point(0,4).separated,false);
  assert.equal(point(0,null).valid,false);
});
test('ranges break at nominal, a loss, or missing/incomplete observations',()=>{
  const r={nominal:1,points:[point(.2),point(.4),point(1,8,{nominal:true}),point(2),point(3,1),point(4),point(5),point(6,8,{complete:false}),point(7),point(8,null)]};
  assert.deepEqual(ranges(r).map(s=>s.values),[[.2,.4],[4,5]]);
  assert.deepEqual(ranges(r,'separated',true).map(s=>s.values),[[.2,.4],[2],[4,5],[7]]);
  assert.deepEqual(ranges({...r,warning:'Unverified'}),[]);
  assert.deepEqual(ranges({nominal:1,points:[point(.5),point(2)]}),[]);
});
test('single severities and non-best fixed settings remain selectable',()=>{
  const rows=[{id:'a',best:false,environmentId:'a',method:'PPO-TV',nominal:1,points:[point(2),point(3)]},{id:'b',best:true,environmentId:'a',method:'PPO-TV',nominal:1,points:[point(2)]}];
  assert.equal(matchingRows(rows,{selection:'all'}).length,1);
  assert.equal(matchingRows(rows,{selection:'all',singles:true}).length,2);
  assert.equal(matchingRows(rows,{selection:'best'}).length,0);
  assert.equal(matchingRows(rows,{selection:'all',screen:'all'}).length,2);
});
test('links preserve setting, reference, axis and measured severity',()=>{
  const r={sourceId:'example',setting:'cap',reference:'vanilla',axis:'mass'};
  const u=new URL(resultLink(r,'advanced',.5),'http://localhost/');
  for(const [key,value] of Object.entries({study:'example',setting:'cap',reference:'vanilla',axis:'mass',value:'0.5',scope:'condition'}))assert.equal(u.searchParams.get(key),value);
  assert.equal(u.hash,'#advanced');
  const supplied=new URL(resultLink({...r,supplied:true,sourceId:'json7',report:'reports/pendulum-additions/index.html'},'advanced',0),'http://localhost/');
  assert.equal(supplied.searchParams.get('dataset'),'json7');assert.equal(supplied.searchParams.get('view'),'reliability');assert.equal(supplied.searchParams.get('value'),'0');
});
test('all-comparison mode survives query round trips and browser Back',()=>{
  for(const screen of ['all','positive','separated']){
    const f={environment:'pendulum',method:'all',source:'json6',screen,selection:'all',singles:false,search:''};
    assert.deepEqual(filtersFromQuery(filterQuery(f).toString()),f);
  }
});
test('published scan covers every axis, controls excluded, ordinary reference fixed',()=>{
  const d=JSON.parse(fs.readFileSync(new URL('../data/advantages/index.json',import.meta.url)));
  assert.equal(d.coverage.length,40);assert.equal(d.coverage.reduce((s,c)=>s+c.axes,0),470);
  assert.equal(d.rows.length,2397);assert.equal(new Set(d.rows.map(r=>r.id)).size,2397);
  for(const r of d.rows){
    assert.ok(['vanilla','standard','non-robust'].includes(r.reference));
    assert.ok(!['a1e9','tvc500','tvc1e9','kl_bypass','tv_c1100'].includes(r.setting));
    assert.ok(r.points.every((p,i)=>!i||p.x>r.points[i-1].x));
    for(const p of r.points)assert.deepEqual(p,classify(p));
  }
  assert.equal(d.rows.filter(r=>ranges(r).length).length,6);
  assert.equal(new Set(d.rows.filter(r=>ranges(r).length).map(r=>r.sourceId+'|'+r.setting)).size,4);
  assert.ok(d.rows.filter(r=>r.warning).every(r=>ranges(r,'positive',true).length===0));
});
