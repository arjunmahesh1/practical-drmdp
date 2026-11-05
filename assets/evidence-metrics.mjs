import {summarize} from './appendix-metrics.mjs';
import {bestModelOnAxis} from './model.mjs';

export function activeSettings(study){
  return study.models.filter(model=>bestModelOnAxis({...study,models:[model]},study.axes[0])===model);
}
export function compareSetting(curve,policy,model,scope,axisId=null,value=null,reference=curve.baseline){
  const axis=axisId||policy.axes[0].id;
  const selected=summarize(policy,model,reference,scope,axis,value);
  const standard=summarize(policy,reference,reference,scope,axis,value);
  const nominal=summarize(policy,model,reference,'nominal',axis);
  const deltaMean=selected.raw===null||standard.raw===null?null:selected.raw-standard.raw;
  const deltaAuc=selected.auc===null||standard.auc===null?null:selected.auc-standard.auc;
  const warning=scope==='nominal'?'':scope==='suite'?((curve.flatResponseAxes?.length||curve.axes.some(a=>a.warning))?'Some perturbation effects unverified':''):(curve.axes.find(a=>a.id===axis)?.warning||'');
  const complete=selected.minN===policy.intendedPolicies&&standard.minN===policy.intendedPolicies;
  const positiveMean=deltaMean!==null&&deltaMean>1e-9,positiveAuc=deltaAuc!==null&&deltaAuc>1e-9;
  const comparable=selected.raw!==null&&standard.raw!==null;
  const status=!comparable?'Unavailable':warning?'Perturbation unverified':!complete?'Incomplete policies':deltaAuc===null?'Native returns only':positiveMean&&positiveAuc?'Mean + reliability gain':positiveMean||positiveAuc?'Mixed trade-off':'No joint gain';
  return {study:curve.id,environment:curve.environment,algorithm:curve.algorithm,family:curve.family,branch:curve.branch,
    model,reference,scope,axis:scope==='suite'?null:axis,value:scope==='condition'?value:null,
    selectedMean:selected.raw,referenceMean:standard.raw,deltaMean,selectedAuc:selected.auc,referenceAuc:standard.auc,deltaAuc,
    nominalMean:nominal.raw,nominalRetention:nominal.reliability(.5),minN:selected.minN,referenceMinN:standard.minN,intended:policy.intendedPolicies,
    conditionCount:selected.conditionCount,axisCount:selected.axisCount,complete,warning,status,
    favorable:status==='Mean + reliability gain',referenceIsStandard:reference==='vanilla'||reference==='standard'};
}

export function evidenceRows(curve,policy){
  const rows=[];
  for(const model of activeSettings(curve)){
    rows.push({...compareSetting(curve,policy,model,'nominal'),level:'L1'});
    rows.push({...compareSetting(curve,policy,model,'suite'),level:'L3'});
    for(const axis of curve.axes){
      rows.push({...compareSetting(curve,policy,model,'axis',axis.id),axisTitle:axis.title,level:'L2'});
      for(const point of axis.curves[model]||[]){
        if(Math.abs(point.x-axis.nominal)<1e-9)continue;
        rows.push({...compareSetting(curve,policy,model,'condition',axis.id,point.x),axisTitle:axis.title,level:'condition'});
      }
    }
  }
  return rows;
}
