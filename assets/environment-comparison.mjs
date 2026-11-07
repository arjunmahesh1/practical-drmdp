import {gridMean} from './model.mjs';

function controller(study){
  if(study.environment!=='PickCube-v1')return 'native';
  // Notes may mention other controllers in exclusions; the cohort branch is authoritative.
  const description=study.branch||'';
  if(/joint-delta/i.test(description))return 'joint-delta';
  if(/end-effector.delta/i.test(description))return 'end-effector-delta';
  if(['ppo_tv_pickcube','td3_tv_pickcube','td3_kl_pickcube'].includes(study.id))return 'legacy-translation';
  return null;
}
export function compatibleAxis(study,current,axisId){
  if(study.environment!==current.environment||controller(study)===null||controller(study)!==controller(current))return null;
  const a=study.axes.find(a=>a.id===axisId),b=current.axes.find(a=>a.id===axisId);
  if(!a||!b||a.warning||b.warning||study.flatResponseAxes?.includes(axisId)||current.flatResponseAxes?.includes(axisId))return null;
  const points=a.curves[study.baseline],reference=b.curves[current.baseline];
  if(a.nominal!==b.nominal||points?.length!==reference?.length||!points?.every((p,i)=>Math.abs(p.x-reference[i].x)<1e-9))return null;
  return a;
}
export function rankEnvironmentAlgorithms(studies,current,axisId){
  const inactive=['a1e9','tvc1e9','tvc500','tv_noop','rsc_noop','ctxkl0','ctxkluniform','klprho0','kl_bypass'];
  return studies.flatMap(study=>{
    const axis=compatibleAxis(study,current,axisId);if(!axis)return [];
    const excluded=new Set([...(study.controls||[]),...inactive]);excluded.delete(study.baseline);
    const candidates=study.models.filter(m=>!excluded.has(m)&&axis.curves[m]?.length===axis.curves[study.baseline].length&&axis.curves[m].every(p=>Number.isFinite(p.mean)&&p.n===30));
    const best=candidates.sort((a,b)=>gridMean(axis.curves[b])-gridMean(axis.curves[a]))[0];
    return best?[{study:study.id,algorithm:best===study.baseline&&study.algorithm==='RSC-SAC'?'SAC':study.algorithm,family:study.family,branch:study.branch,model:best,mean:gridMean(axis.curves[best]),environment:study.environment}]:[];
  }).sort((a,b)=>b.mean-a.mean||a.study.localeCompare(b.study));
}
