import test from 'node:test';
import assert from 'node:assert/strict';
import {episodeTraceSVG} from '../assets/replay-chart.mjs';

test('recorded-episode graph labels both axes and includes numeric ticks',()=>{
  const svg=episodeTraceSVG([{time:0,reward:0},{time:5,reward:5000}],1,'#d94b24');
  assert.match(svg,/class="x-axis-label"[^>]*>Time \(s\)</);
  assert.match(svg,/class="y-axis-label"[^>]*>Cumulative return</);
  assert.equal((svg.match(/class="episode-x-tick"/g)||[]).length,3);
  assert.equal((svg.match(/class="episode-y-tick"/g)||[]).length,3);
  assert.match(svg,/>2\.5<\/text>/);
  assert.match(svg,/class="episode-axes"/);
  assert.match(svg,/class="episode-cursor" cx="578"/);
});

test('negative and constant episode returns keep finite geometry',()=>{
  for(const rewards of [[0,-15,-60],[0,0,0]]){
    const svg=episodeTraceSVG(rewards.map((reward,i)=>({time:i/10,reward})),1,'#003087');
    assert.doesNotMatch(svg,/NaN|Infinity/);
    assert.match(svg,/class="episode-cursor"[^>]*fill="#003087"/);
  }
});

test('compact episode charts reserve space for mobile labels',()=>{
  const svg=episodeTraceSVG([{time:0,reward:0},{time:1,reward:1}],0,'#003087',true);
  assert.match(svg,/viewBox="0 0 400 220"/);
  assert.match(svg,/class="episode-cursor" cx="78"/);
});
