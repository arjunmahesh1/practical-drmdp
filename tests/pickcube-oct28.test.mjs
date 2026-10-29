import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bestModelOnAxis} from '../assets/model.mjs';
import {parameterNote} from '../assets/environments.mjs';

const study=JSON.parse(await readFile(new URL('../data/ppo_tv_pickcube_20261028.json',import.meta.url),'utf8'));
test('new joint-delta cohort retains nine complete settings and exact new videos',()=>{
  assert.equal(study.models.length,9);
  assert.equal(study.axes.length,6);
  assert.equal(study.baseline,'vanilla');
  assert.equal(study.selection.held_out,false);
  assert.equal(Object.keys(study.replays).length,9);
  for(const model of study.models)assert.equal(Object.keys(study.replays[model]).length,37);
  for(const axis of study.axes){
    assert.equal(bestModelOnAxis(study,axis),'tv_c4');
    for(const points of Object.values(axis.curves))assert(points.every(p=>p.n===30));
  }
});
test('joint command axes are not described as gripper translation',()=>{
  for(const axis of ['arm_command_gain','arm_command_noise','arm_command_replacement']){
    const note=parameterNote('PickCube-v1',axis);
    assert(note.includes('joint'));
    assert(note.includes('unchanged'));
    assert(!note.includes('translation'));
  }
});
