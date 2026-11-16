import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {suppliedProfileId,originalSet} from '../assets/supplied-environment.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const index=read('data/profiles/index.json'),old=JSON.parse(execFileSync('git',['show','e659098:data/profiles/index.json'],{encoding:'utf8',maxBuffer:20e6}));
test('all previous 297 comparisons are unchanged; four evaluations are not new training cohorts',()=>{
 assert.deepEqual(index.rows.slice(0,297),old.rows);assert.equal(index.rows.length,333);
 assert.equal(index.summary.catalogStudies,43);assert.equal(index.summary.suppliedAdditionalDatasets,2);
 const csv=fs.readFileSync(new URL('../data/profiles/comparisons.csv',import.meta.url),'utf8');
 assert.ok(csv.startsWith(execFileSync('git',['show','e659098:data/profiles/comparisons.csv'],{encoding:'utf8',maxBuffer:20e6})));
 for(const r of index.rows.slice(297))assert.ok(csv.includes(r.study+','));
});
test('original datasets have independent-policy intervals only, never fabricated paired methods',()=>{
 for(const sid of [suppliedProfileId('json'),suppliedProfileId('json 2')]){
  const data=read('data/profiles/'+sid+'.json');assert.equal(data.comparisons.length,9);
  for(const row of data.comparisons){assert.equal(row.primary,'independent');assert.equal(row.algorithm,'Unreported');
   for(const s of [row.nominal,...row.shiftResults,row.suite])for(const t of Object.values(s.tests)){assert.ok(!t.paired);if(t.independent){assert.ok(t.independent.interval.every(Number.isFinite));assert.equal(t.independent.interval.length,3);}}
   for(const p of Object.values(row.profile))assert.equal(p.paired,null);
   for(const s of row.shiftResults.filter(s=>s.compound)){assert.equal(s.side,'all');assert.equal(s.values.length,10);assert.equal(s.values[0],0);}
  }
 }
 assert.equal(originalSet('json6'),false);assert.equal(suppliedProfileId('json'),'yiting_doublependulum_original');
});
test('additional axes are visible descriptive records without scope transfer or invented intervals',()=>{
 for(const id of ['json6','json7'])for(const row of read('data/profiles/'+suppliedProfileId(id)+'.json').comparisons){
  assert.equal(row.sourceKind,'supplied-additional');assert.equal(row.shiftResults.length,0);
  assert.ok(Object.values(row.profile).every(p=>p.level===null));
  for(const t of Object.values(row.suite.tests)){assert.equal(t.status,'descriptive-only');assert.equal(t.eligible,false);assert.ok(!t.independent&&!t.paired);}
 }
});
test('banded reliability can reach suite scope independently of total reliability',()=>{
 const rows=read('data/profiles/yiting_doublependulum_original.json').comparisons;
 for(const model of ['KL-80','KL-100']){const r=rows.find(r=>r.model===model);assert.equal(r.profile.near.level,3);assert.equal(r.profile.reliability.level,2);assert.equal(r.suite.tests.reliability.passes,false);}
});
