import {conditions,summarize,rawReliability,mean} from './appendix-metrics.mjs';
import {bestModelOnAxis} from './model.mjs';

export function normalizedSurvival(study,model,reference,scope,axis,value,conditional=false){
  const summary=summarize(study,model,reference,scope,axis,value,conditional);
  if(!summary.valid)return {points:[],summary};
  const groups=conditions(study,model,reference,scope,axis,value,conditional),jumps=new Map();
  for(const g of groups)for(const p of g.points)for(const [,r] of p.seeds){
    const z=r/g.r0;
    if(z>=0&&z<1)jumps.set(z,(jumps.get(z)||0)+1/groups.length/g.points.length/p.seeds.length);
  }
  let remaining=summary.reliability(0);const points=[[0,remaining]];
  for(const [z,weight] of [...jumps].sort((a,b)=>a[0]-b[0])){points.push([z,remaining]);remaining=Math.max(0,remaining-weight);points.push([z,remaining]);}
  points.push([1,summary.reliability(1)]);
  return {points,summary};
}

export function reliabilityDisplay(study,models,reference,scope,axis,value){
  const summaries=models.map(model=>summarize(study,model,reference,scope,axis,value));
  const negative=models.some(model=>conditions(study,model,reference,scope,axis,value).some(g=>g.points.some(p=>p.seeds.some(([,r])=>r<0))));
  return {normalized:summaries.every(s=>s.valid)&&!negative,negative,summaries};
}

export function returnDistribution(study,model,reference,scope,axis,value){
  return rawReliability(study,model,reference,scope,axis,value).points.map(([r,p])=>[r,1-p]);
}

export function capSummaries(study,reference){
  return study.models.map(model=>({model,suite:summarize(study,model,reference,'suite'),nominal:summarize(study,model,reference,'nominal',study.axes[0].id)}));
}

export function bestFixedSetting(study,reference){
  const rows=capSummaries(study,reference);
  const curves=Object.fromEntries(rows.filter(r=>r.suite.raw!==null).map(r=>[r.model,[{mean:r.suite.raw}]]));
  return bestModelOnAxis(study,{curves});
}

export function recordedOutcomes(study,model,reference,scope,axis,value){
  const groups=conditions(study,model,reference,scope,axis,value);
  const keys=[...new Set(groups.flatMap(g=>g.points.flatMap(p=>Object.keys(p.outcomes||{}))))];
  return Object.fromEntries(keys.map(key=>[key,groups.every(g=>g.points.length&&g.points.every(p=>Number.isFinite(p.outcomes?.[key])))?mean(groups.map(g=>mean(g.points.map(p=>p.outcomes[key])))):null]));
}
