import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentWindow,segmentFrame,segmentTime,segmentSource} from '../assets/video-segment.mjs';
const standalone={video:'clip.mp4',fps:10,timeline:Array.from({length:51},(_,step)=>({step}))};
const bundled={...standalone,video:'checkpoint.mp4',videoSegment:{start:120,duration:5.1,fps:10}};
test('standalone recordings retain their original timing',()=>{
  assert.equal(segmentSource(standalone),'clip.mp4');
  assert.equal(segmentFrame(standalone,.3),3);
  assert.equal(segmentTime(standalone,50),5);
});
test('bundled playback and scrubbing remain inside the exact episode',()=>{
  assert.deepEqual(segmentWindow(bundled),{start:120,end:125.1,fps:10});
  assert.equal(segmentSource(bundled),'checkpoint.mp4#t=120.000000,125.100000');
  assert.equal(segmentFrame(bundled,0),0);
  assert.equal(segmentFrame(bundled,120.3),3);
  assert.equal(segmentFrame(bundled,1000),50);
  assert.equal(segmentTime(bundled,0),120);
  assert.equal(segmentTime(bundled,1000),125);
});
test('invalid segment metadata does not silently select another episode',()=>{
  for(const videoSegment of [{start:-1,duration:1},{start:0,duration:0},{start:Infinity,duration:2}])
    assert.throws(()=>segmentWindow({...standalone,videoSegment}));
});
