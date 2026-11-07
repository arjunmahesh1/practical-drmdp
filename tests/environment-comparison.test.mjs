import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compatibleAxis,rankEnvironmentAlgorithms} from '../assets/environment-comparison.mjs';
import {reliabilityDisplay,normalizedSurvival} from '../assets/browser-metrics.mjs';
import {rawReliability} from '../assets/appendix-metrics.mjs';
const load=id=>JSON.parse(fs.readFileSync(new URL('../data/'+id+'.json',import.meta.url)));
test('ANYmal negative condition returns remain distinguishable without changing normalized metrics',()=>{
 const s=load('appendix/anymal_ppo_tv30'),models=['vanilla','tv_c2.5'];
 const view=reliabilityDisplay(s,models,'vanilla','condition','motor_strength',.5);
 assert.equal(view.negative,true);assert.equal(view.normalized,false);
 assert.ok(view.summaries.every(p=>p.valid&&p.auc===0));
 assert.ok(Math.abs(view.summaries[0].raw+45.75000557455886)<1e-10);
 assert.ok(Math.abs(view.summaries[1].raw+34.80846350357837)<1e-10);
 const native=models.map(m=>rawReliability(s,m,'vanilla','condition','motor_strength',.5));
 for(const curve of native){assert.ok(curve.points.every(p=>p[0]<0));for(let i=1;i<curve.points.length;i++)assert.ok(curve.points[i][1]<=curve.points[i-1][1]+1e-12);}
 assert.notDeepEqual(native[0].points,native[1].points);
 assert.ok(native[0].survival(-40)<native[1].survival(-40));
 assert.equal(normalizedSurvival(s,'vanilla','vanilla','condition','motor_strength',.5).summary.auc,0);
});
test('positive distributions retain normalized reliability and nonpositive references never acquire a ratio',()=>{
 const s=load('appendix/anymal_ppo_tv30');
 for(const axis of s.axes)axis.nominalSeeds.vanilla=axis.nominalSeeds.vanilla.map(([id,r])=>[id,Math.abs(r)+1]);
 assert.equal(reliabilityDisplay(s,['vanilla'],'vanilla','nominal','motor_strength',1).normalized,true);
 const p=load('appendix/ppo_tv_pusher');
 assert.equal(reliabilityDisplay(p,[p.baseline],p.baseline,'nominal',p.axes[0].id,p.axes[0].nominal).normalized,false);
});
test('algorithm rankings do not cross task versions, controllers, missing policies or grids',()=>{
 const ppo=load('ppo_tv_pickcube_20261028'),sac=load('sac_tv_pickcube_20261028'),td3=load('td3_tv_pickcube_20261029');
 assert.equal(compatibleAxis(sac,ppo,'cube_mass'),null);
 assert.equal(compatibleAxis(td3,ppo,'cube_mass'),null);
 assert.ok(compatibleAxis(td3,sac,'cube_mass'));
 const walker=load('ppo_tv_walker'),walker5=load('td3_tv_walker');
 assert.equal(compatibleAxis(walker5,walker,'mass'),null);
 const changed=structuredClone(sac);changed.axes[0].curves.vanilla[0].x+=.01;
 assert.equal(compatibleAxis(changed,sac,sac.axes[0].id),null);
 const missing=structuredClone(td3);missing.models.forEach(m=>missing.axes[0].curves[m][0].n=29);
 assert.equal(rankEnvironmentAlgorithms([missing],sac,sac.axes[0].id).length,0);
});
test('best algorithm can select ordinary standard, excludes no-ops, and preserves source values',()=>{
 const ids=['ant_ppo_tv30','ant_sac_tv30','ant_td3_tv30'],studies=ids.map(load),before=JSON.stringify(studies);
 const rows=rankEnvironmentAlgorithms(studies,studies[0],'action_delay');
 assert.equal(rows.length,3);assert.equal(rows[0].algorithm,'PPO');assert.equal(rows[0].model,'vanilla');
 assert.ok(rows.every((row,i)=>!i||row.mean<=rows[i-1].mean));
 assert.equal(JSON.stringify(studies),before);
 const inactive=structuredClone(studies[0]);inactive.models.push('tv_noop');inactive.axes.forEach(a=>a.curves.tv_noop=a.curves.vanilla.map(p=>({...p,mean:1e12})));
 assert.notEqual(rankEnvironmentAlgorithms([inactive],inactive,'action_delay')[0].model,'tv_noop');
});
