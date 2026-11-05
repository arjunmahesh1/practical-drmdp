import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeRecordings,libraryRecordingCoverage} from '../assets/recording-overlay.mjs';
const original={id:'ant_ppo_tv30',models:['vanilla','tv_c2'],axes:[{id:'action_delay',curves:{vanilla:[{x:0,y:12}],tv_c2:[{x:0,y:15}]}}],replays:{vanilla:{'action_delay|1':'assets/replays/existing.json'}}};
const path='assets/isaac-recordings-20261105/ant-cap2-nominal.json';
test('new video links do not mutate numeric study data or original recordings',()=>{
 const before=structuredClone(original),overlay={studies:{ant_ppo_tv30:{tv_c2:{'action_delay|0':path}}}};
 const result=mergeRecordings(original,overlay);
 assert.deepEqual(original,before);assert.deepEqual(result.axes,original.axes);
 assert.equal(result.replays.tv_c2['action_delay|0'],path);
 assert.equal(result.replays.vanilla['action_delay|1'],'assets/replays/existing.json');
});
test('recordings require an existing model and measured condition',()=>{
 assert.throws(()=>mergeRecordings(original,{studies:{ant_ppo_tv30:{tv_c3:{'action_delay|0':path}}}}));
 assert.throws(()=>mergeRecordings(original,{studies:{ant_ppo_tv30:{tv_c2:{'action_delay|0.5':path}}}}));
 assert.throws(()=>mergeRecordings(original,{studies:{ant_ppo_tv30:{tv_c2:{'unknown|0':path}}}}));
});
test('an overlay cannot replace an existing exact-policy recording',()=>{
 const study={...original,replays:{tv_c2:{'action_delay|0':'assets/replays/original.json'}}};
 assert.throws(()=>mergeRecordings(study,{studies:{ant_ppo_tv30:{tv_c2:{'action_delay|0':path}}}}));
});
test('unrelated studies and incomplete/pilot environment entries stay unchanged',()=>{
 assert.equal(mergeRecordings(original,{studies:{}}),original);
 const library={entries:[{id:'ant',videoSelections:0,recordingPending:true,cohorts:[{id:'ant_ppo_tv30'}]},{id:'lift',videoSelections:0,recordingPending:true,cohorts:[]}]};
 const result=libraryRecordingCoverage(library,{studies:{ant_ppo_tv30:{tv_c2:{'action_delay|0':path}}}});
 assert.equal(result.entries[0].videoSelections,1);assert.equal(result.entries[0].recordingPending,false);
 assert.deepEqual(result.entries[1],library.entries[1]);assert.equal(library.entries[0].videoSelections,0);
});
