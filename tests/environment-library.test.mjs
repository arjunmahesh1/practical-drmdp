import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {belongsTo,previewChart} from '../assets/environment-library.mjs';
import {parameterNote} from '../assets/environments.mjs';
import {summarize} from '../assets/appendix-metrics.mjs';

const root=new URL('../',import.meta.url),json=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const library=json('data/environments.json'),catalog=json('data/catalog.json');

test('all thirteen task implementations distinguish main, pilot and development work',()=>{
  assert.equal(library.entries.length,13);
  assert.equal(library.entries.filter(e=>e.stage==='main').length,9);
  assert.equal(library.entries.filter(e=>e.stage==='pilot').length,1);
  assert.equal(library.entries.filter(e=>e.stage==='development').length,3);
  assert.equal(library.entries.flatMap(e=>e.cohorts).length,39);
});
test('engine labels separate ManiSkill, Isaac and classic control',()=>{
  const get=id=>library.entries.find(e=>e.id===id);
  assert.equal(get('pickcube').framework,'ManiSkill 3');assert.equal(get('pickcube').simulator,'SAPIEN / PhysX');
  for(const id of ['ant','humanoid','anymal','drawer','lift'])assert.equal(get(id).simulator,'Isaac Sim / PhysX');
  assert.equal(get('lunar').simulator,'Box2D');assert.equal(get('walker').simulator,'MuJoCo');
  assert.notDeepEqual(get('ant').taskIds,get('ant-mujoco').taskIds);
});
test('search and simulator/scope filters use exact sources without matching unrelated tasks',()=>{
  const ant=library.entries.find(e=>e.id==='ant');
  assert(belongsTo(ant,'ant','Isaac Sim / PhysX','main'));
  assert(!belongsTo(ant,'ant','MuJoCo','main'));
  assert(!belongsTo(ant,'drawer','all','all'));
  assert.equal(library.entries.filter(e=>belongsTo(e,'','Isaac Sim / PhysX','all')).length,5);
});
test('recording coverage stays exact and missing Isaac recordings are not invented',()=>{
  assert.equal(library.entries.filter(e=>e.videoSelections>0).length,5);
  assert.equal(library.entries.reduce((n,e)=>n+e.videoSelections,0),6032);
  for(const e of library.entries)for(const c of e.cohorts){
    const s=json('data/'+c.id+'.json');
    assert.equal(c.videoSelections,Object.values(s.replays||{}).reduce((n,v)=>n+Object.keys(v).length,0));
  }
  for(const e of library.entries.filter(e=>e.framework==='Isaac Lab'))assert.equal(e.videoSelections,0);
});
test('cohorts, controllers and versions stay separate',()=>{
  for(const e of library.entries)for(const c of e.cohorts){
    assert(e.taskIds.includes(c.environment));assert(catalog.studies.some(s=>s.id===c.id));
    assert.equal(json('data/'+c.id+'.json').branch,c.branch);
  }
  const pick=library.entries.find(e=>e.id==='pickcube');
  assert(pick.cohorts.some(c=>c.id==='ppo_tv_pickcube_20261028'));
  assert(pick.cohorts.some(c=>c.id==='pickcube_sac_kl30'));
});
test('pilots and uncertain incoming data do not acquire 30-seed curves or simulator attribution',()=>{
  for(const e of library.entries.filter(e=>e.stage!=='main')){assert.equal(e.cohorts.length,0);assert(e.note);}
  assert.equal(library.incoming.length,1);assert(library.incoming[0].note.includes('unconfirmed'));
  assert(!catalog.studies.some(s=>/pendulum/i.test(s.environment)));
});
test('every original policy export remains byte-identical',()=>{
  const receipt=JSON.parse(fs.readFileSync(new URL('./fixtures/export-preservation.json',import.meta.url)));
  assert.equal(Object.keys(receipt.source_study_files_unchanged).length,78);
  for(const [p,h] of Object.entries(receipt.source_study_files_unchanged)){
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex'),h,p);
  }
});
test('manuscript downloads exist for all ten packaged comparisons',()=>{
  const cohorts=library.entries.flatMap(e=>e.cohorts).filter(c=>c.archive);
  assert.equal(cohorts.length,10);
  for(const c of cohorts)assert(fs.existsSync(new URL(c.archive,root)));
  assert.equal(json('data/appendix/index.json').deliveries.length,5);
});
test('negative references retain native-unit summaries and never obtain normalized AUC',()=>{
  const s=json('data/appendix/pusher_ppo_tv30.json');
  const out=summarize(s,s.baseline,s.baseline,'axis',s.axes[0].id);
  assert.equal(out.valid,false);assert.equal(out.auc,null);assert(Number.isFinite(out.raw));
});
test('curve preview preserves constant and negative values with finite geometry',()=>{
  const out=previewChart([{name:'<Standard>',points:[{x:1,y:-4,sd:0},{x:2,y:-4,sd:0}]}],'Shift','Return',{bands:true,nominal:1});
  assert(!/NaN|Infinity/.test(out));assert(out.includes('&lt;Standard&gt;'));assert(out.includes('<svg'));
  assert(previewChart([],'Shift','Return').includes('No values'));
});
test('PickCube command explanations respect each cohort controller',()=>{
  assert(parameterNote('PickCube-v1','arm_command_gain',{branch:'End-effector delta / SAC moment KL'}).includes('gripper translation'));
  assert(parameterNote('PickCube-v1','arm_command_gain',{branch:'October 28 joint-delta cohort'}).includes('joint-delta'));
});
