import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for(const id of ['ppo_tv_pickcube_20261028','sac_tv_pusher','td3_tv_pusher']){
  test(id+' has complete exact-policy video coverage',()=>{
    const study=JSON.parse(fs.readFileSync(new URL('../data/'+id+'.json',import.meta.url)));
    let count=0;
    for(const model of study.models){
      const expected=study.axes.flatMap(a=>a.curves[model].map(p=>a.id+'|'+p.x));
      assert.equal(expected.length,37);
      assert.deepEqual(Object.keys(study.replays[model]).sort(),expected.sort());
      const policies=new Set();
      for(const key of expected){
        const row=JSON.parse(fs.readFileSync(new URL('../'+study.replays[model][key],import.meta.url)));
        assert.equal(row.study,id);assert.equal(row.model,model);
        assert.equal(row.axis+'|'+row.value,key);
        assert.equal(row.trainingSeed,1000);assert.equal(row.episodeSeed,100000);
        assert.equal(row.steps,id==='ppo_tv_pickcube_20261028'?50:100);
        assert.equal(row.timeline.at(-1).step,row.steps);
        assert.equal(row.timeline.at(-1).reward,row.returnValue);
        assert.match(row.videoContainerSha256,/^[0-9a-f]{64}$/);
        assert.match(row.videoSha256,/^[0-9a-f]{64}$/);
        assert(row.video.startsWith('https://github.com/arjunmahesh1/practical-drmdp/releases/download/recordings-'));
        assert(row.videoSegment.duration>0);
        policies.add(row.checkpointSha256);count++;
      }
      assert.equal(policies.size,1);
    }
    assert.equal(count,id==='ppo_tv_pickcube_20261028'?333:148);
  });
}
