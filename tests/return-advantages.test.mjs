import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moments,classify,ranges,matchingRows,rankAdvantage,prioritizeRows} from '../assets/return-advantages.mjs';
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
test('corrected default compares upper SD edges and allows overlapping bands',()=>{
  const overlapping=point(.2,3);
  assert.equal(overlapping.upper,true);assert.equal(overlapping.separated,false);
  const lowerMean=point(.3,1,{robustSD:4});
  assert.equal(lowerMean.positive,false);assert.equal(lowerMean.upper,true);
  assert.equal(lowerMean.upperGap,2);
  assert.equal(point(.4,3,{standardSD:10}).upper,false);
  assert.equal(point(.5,1,{robustSD:2}).upper,false);
  const row={nominal:1,points:[overlapping,lowerMean]};
  assert.equal(ranges(row).length,1);assert.equal(ranges(row,'separated').length,0);
  assert.equal(filtersFromQuery('').screen,'upper');
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
  for(const screen of ['upper','all','positive','separated']){
    const f={environment:'pendulum',method:'all',source:'json6',screen,selection:'all',singles:false,search:'',tier:'all',threshold:.05};
    assert.deepEqual(filtersFromQuery(filterQuery(f).toString()),f);
  }
});
test('display tiers separate small differences and spread-led matches without rewriting evidence',()=>{
  const row={id:'a',nominal:1,points:[point(.2,3),point(.4,3),point(1,100,{nominal:true})]};
  assert.equal(rankAdvantage(row).tier,'small');
  assert.equal(ranges(row).length,1);
  const spread={...row,points:[point(.2,1,{robustSD:4}),point(.4,1,{robustSD:4})]};
  assert.equal(rankAdvantage(spread).tier,'spread');
  assert.equal(rankAdvantage(spread).allSpans.length,1);
  assert.equal(rankAdvantage({...row,points:[point(.2),point(.4)]}).tier,'noticeable');
  assert.equal(filtersFromQuery('').tier,'noticeable');
  for(const tier of ['noticeable','small','spread','all'])for(const threshold of [.02,.05,.1]){
    const f={...filtersFromQuery(''),tier,threshold};assert.deepEqual(filtersFromQuery(filterQuery(f).toString()),f);
  }
  assert.equal(filtersFromQuery('screen=all&view=noticeable').tier,'all');
});
test('magnitude normalization is stable under positive rescaling and offsets, including negative returns',()=>{
  const row={nominal:1,points:[point(.2),point(.4),point(1,2,{nominal:true})]};
  const a=rankAdvantage(row);
  const shifted={...row,points:row.points.map(p=>classify({...p,standard:p.standard*20-1000,robust:p.robust*20-1000,standardSD:p.standardSD*20,robustSD:p.robustSD*20}))};
  const b=rankAdvantage(shifted);
  assert.equal(a.tier,b.tier);assert.equal(a.score,b.score);assert.equal(a.average,b.average);
  assert.equal(b.scale,a.scale*20);
  assert.equal(rankAdvantage({...row,points:[point(.2,2),point(.4,2)]}).tier,'none');
});
test('noticeable ranges require both gains at every adjacent measured level',()=>{
  const row={id:'a',nominal:1,points:[point(.2,10),point(.4,2.001),point(.6,10),point(1,8,{nominal:true})]};
  assert.equal(rankAdvantage(row).tier,'small');
  assert.equal(rankAdvantage(row,{singles:true}).tier,'noticeable');
  assert.equal(rankAdvantage({...row,warning:'Unverified'}).tier,'none');
  assert.equal(rankAdvantage({...row,points:row.points.map(p=>({...p,complete:false}))}).tier,'none');
  assert.equal(rankAdvantage({...row,points:[point(.5,10),point(2,10)]}).tier,'none');
  const short={id:'short',nominal:1,points:[point(.2,8),point(.4,8),point(.6,2),point(1,8,{nominal:true})]};
  const long={...short,id:'long',points:short.points.map(p=>p.x===.6?point(.6,8):p)};
  assert.equal(prioritizeRows([short,long])[0].row.id,'long');
  assert.ok(rankAdvantage(long).score>rankAdvantage(short).score);
});
test('ranking preserves published data and partitions every original match',()=>{
  const d=JSON.parse(fs.readFileSync(new URL('../data/advantages/index.json',import.meta.url)));
  const before=JSON.stringify(d),ranked=prioritizeRows(matchingRows(d.rows,{selection:'all'}));
  assert.equal(ranked.length,1147);assert.equal(JSON.stringify(d),before);
  assert.equal(ranked.filter(r=>r.rank.tier==='noticeable').length,285);
  assert.equal(ranked.filter(r=>r.rank.tier==='small').length,688);
  assert.equal(ranked.filter(r=>r.rank.tier==='spread').length,174);
  assert.equal(new Set(ranked.filter(r=>r.rank.tier==='noticeable').map(r=>r.row.sourceId+'|'+r.row.setting)).size,69);
  const narrow=ranked.filter(item=>item.row.sourceId==='ppo_tv_walker'&&item.row.axis==='actuator_gain'&&item.row.setting==='a2p85')[0];
  assert.ok(narrow);assert.notEqual(narrow.rank.tier,'noticeable');
  for(const {row,rank} of ranked){
    assert.ok(rank.scale>0);assert.ok(Number.isFinite(rank.score));
    if(rank.tier==='noticeable')for(const s of rank.spans)for(const x of s.values){
      const p=row.points.find(p=>p.x===x);assert.ok(p.delta>=.05*rank.scale&&p.upperGap>=.05*rank.scale);
      assert.ok(p.complete&&!p.nominal&&p.upper);
    }
  }
  assert.ok(ranked.filter(item=>rankAdvantage(item.row,{threshold:.1}).tier==='noticeable').length<=285);
  assert.ok(prioritizeRows(d.rows,{threshold:.02}).filter(item=>item.rank.tier==='noticeable').length>=285);
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
  assert.equal(d.rows.filter(r=>ranges(r,'separated').length).length,6);
  assert.equal(new Set(d.rows.filter(r=>ranges(r,'separated').length).map(r=>r.sourceId+'|'+r.setting)).size,4);
  assert.equal(d.rows.filter(r=>ranges(r).length).length,1147);
  assert.equal(new Set(d.rows.filter(r=>ranges(r).length).map(r=>r.sourceId+'|'+r.setting)).size,150);
  assert.ok(d.rows.filter(r=>r.warning).every(r=>ranges(r,'positive',true).length===0));
});
