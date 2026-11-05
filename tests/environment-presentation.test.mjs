import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resultEnvironments,suppliedEnvironments} from '../assets/results-policy.mjs';

const root=new URL('../',import.meta.url),json=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
test('inverted pendulum identities have equal environment status without guessed algorithm or backend',()=>{
 const library=json('data/environments.json');
 const entries=resultEnvironments([...library.entries,...suppliedEnvironments]);
 assert.equal(entries.length,11);
 assert.deepEqual(suppliedEnvironments.map(e=>e.name),['Inverted Double Pendulum','Inverted Pendulum']);
 assert(!entries.some(e=>['pilot','development'].includes(e.stage)));
 for(const e of suppliedEnvironments){assert(entries.includes(e));assert.equal(e.simulator,'');assert.equal(e.framework,'');assert(e.report);}
 const data=json('reports/return-reliability/outputs/metrics.json');
 for(const e of suppliedEnvironments){const c=data.cohorts.find(c=>c.id===e.dataset);assert.equal(c.models.length,e.settingCount);assert.equal(c.axes.length,e.axisCount);}
});
test('only pendulum display metadata changes; hierarchy outcomes remain unassessed',()=>{
 const inventory=json('data/hierarchy/settings.json');
 for(const r of inventory.rows.filter(r=>r.dataset)){
  assert.equal(r.environment,r.dataset==='json'?'Inverted Double Pendulum':'Inverted Pendulum');
  assert.equal(r.algorithm,'');assert.equal(r.branch,'');
  for(const g of Object.values(r.gates))assert.equal(g.status,'unassessed');
 }
 assert.equal(inventory.rows.filter(r=>r.dataset).length,20);
});
