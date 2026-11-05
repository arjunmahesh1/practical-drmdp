import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {suppliedEnvironments,suppliedResults} from '../assets/results-policy.mjs';
import {auditRows} from '../assets/hierarchy-audit.mjs';
import {belongsTo} from '../assets/environment-library.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const additions=read('data/pendulum-additions.json'),audit=read('data/hierarchy/assessments.json');
test('additional evaluations share existing environments without replacing original mappings',()=>{
 assert.equal(suppliedEnvironments.length,2);assert.equal(suppliedResults.length,4);
 assert.equal(suppliedEnvironments.find(e=>e.id==='pendulum').dataset,'json 2');
 assert.equal(suppliedEnvironments.find(e=>e.id==='doublependulum').dataset,'json');
 for(const e of suppliedEnvironments){assert.equal(e.simulator,'');assert(belongsTo(e,'','MuJoCo','all'));}
 assert.deepEqual(suppliedResults.filter(e=>e.dataset==='json6'||e.dataset==='json7').map(e=>[e.dataset,e.name,e.axisCount]),
  [['json7','Inverted Double Pendulum',12],['json6','Inverted Pendulum',16]]);
});
test('additional rows have their own sources and never inherit the original hierarchy',()=>{
 assert.equal(additions.rows.length,20);assert.equal(additions.sourceValueCount,76200);
 assert.equal(additions.additionalEvaluationsOfExistingPolicies,true);
 const rows=auditRows(additions.rows,audit);
 assert.equal(rows.filter(r=>r.role==='robust').length,18);
 for(const r of rows.filter(r=>r.role==='robust')){
  assert.equal(r.result.code,'unassessed');assert.equal(r.result.label,'New-axis audit pending');assert(!r.audit);assert(r.source.includes('pendulum-additions'));
  assert.equal(r.algorithm,'');assert.equal(audit.comparisons[r.id],undefined);
 }
 assert.equal(Object.values(audit.comparisons).flat().length,235);
});
test('report preserves every supplied value and all distinct nominal references',()=>{
 const payload=read('reports/pendulum-additions/outputs/metrics.json');
 let count=0;for(const c of payload.cohorts)for(const a of c.axes)for(const s of Object.values(a.settings)){
  assert.equal(s.values.length,30);for(const row of s.values){assert.equal(row.length,a.levels.length);assert(row.every(Number.isFinite));count+=row.length;}
 }
 assert.equal(count,76200);assert.equal(payload.cohorts.find(c=>c.id==='json6').reference,500);
 const double=payload.cohorts.find(c=>c.id==='json7');assert.equal(double.nominal_vectors_identical,false);
 assert(double.nominal_max_abs_difference['TV-70']>50);
 const html=fs.readFileSync(new URL('../reports/pendulum-additions/index.html',import.meta.url),'utf8');
 assert.deepEqual(JSON.parse(html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]),payload);
 assert(!html.includes('The human confirms 30 independently trained policies per setting'));
});
test('each additional result has exact curve and advanced metric links',()=>{
 for(const s of suppliedResults){const u=new URL(s.report,'https://example.test/');assert.equal(u.searchParams.get('dataset'),s.dataset);assert.equal(u.searchParams.get('view'),'returns');}
 for(const p of ['setting_summary.csv','axis_summary.csv','level_summary.csv','reported_values.csv','within_axis_row_profiles.csv','reliability_curves.csv'])
  assert(fs.existsSync(new URL('../reports/pendulum-additions/outputs/'+p,import.meta.url)));
});
