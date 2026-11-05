const rank={L3:3,L2:2,L1:1,borderline:0,none:-1,unassessed:-2};

export function supportedLevel(gates,role='robust'){
 if(role==='reference')return {code:'reference',label:'Reference'};
 if(role==='control')return {code:'control',label:'Control'};
 if(gates.L1.status==='fail')return {code:'none',label:'None · L1 failed'};
 if(gates.L1.status==='borderline')return {code:'borderline',label:'Borderline L1'};
 if(gates.L1.status!=='pass')return {code:'unassessed',label:'Nominal competence unresolved'};
 if(gates.L2.status!=='pass')return {code:'L1',label:gates.L2.status==='blocked'?'L1 · deployment metric unavailable':'L1 only'};
 if(gates.L3.status==='pass')return {code:'L3',label:'L3 · exploratory'};
 return {code:'L2',label:gates.L3.status==='blocked'?'L2 · suite unavailable':'L2 · exploratory'};
}

function score(c){return [rank[supportedLevel(c.gates).code],c.gates.L3.d_auc?.[1]??-Infinity,c.gates.L2.passed||0];}
export function strongestComparison(comparisons){
 return [...comparisons].sort((a,b)=>{const x=score(a),y=score(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return y[i]-x[i];return a.reference.localeCompare(b.reference);})[0];
}

export function auditRows(rows,audit,mode='strongest'){
 const fixed=mode.startsWith('reference:')?mode.slice(10):null;
 const applicable=fixed?new Set(Object.entries(audit.comparisons).filter(([,cs])=>cs.some(c=>c.reference===fixed)).map(([id])=>id.split('|')[0])):null;
 return rows.flatMap(r=>{
  if(fixed&&!applicable.has(r.study))return [];
  if(r.role!=='robust')return [{...r,result:supportedLevel(r.gates,r.role)}];
  const choices=audit.comparisons[r.id];
  if(!choices){
   const reason=r.evaluationReuse?'Additional evaluations of existing policies; these added axes need their own hierarchy assessment. Exact row mapping is not supplied.':r.dataset?'Policy-level inference needs independent training-policy identities for the supplied rows.':r.archived?'Archived configuration, outside the current audit.':'No eligible saved policy summary.';
   const gates=Object.fromEntries(['L1','L2','L3'].map(k=>[k,{status:'blocked',basis:'data limitation',note:reason}]));
   return [{...r,gates,result:{code:'unassessed',label:r.evaluationReuse?'New-axis audit pending':r.dataset?'Policy identities needed':'Outside current audit'}}];
  }
  const chosen=mode==='all'?choices:mode==='strongest'?[strongestComparison(choices)]:mode==='paper'?choices.filter(c=>c.reference===r.reference):
   mode==='standard'?choices.filter(c=>['vanilla','standard','non-robust'].includes(c.reference)):choices.filter(c=>c.reference===mode.replace('reference:',''));
  return chosen.map(c=>({...r,reference:c.reference,referenceLabel:audit.labels[c.reference]||c.reference,gates:c.gates,
   l1Nominal:c.gates.L1.originalReference===c.reference?c.nominal:r.nominal,nominal:c.nominal,
   l1ReferenceLabel:audit.labels[c.gates.L1.originalReference]||c.gates.L1.originalReference,
   result:supportedLevel(c.gates),audit:true,resampling:c.paired?'Paired whole policies':'Independent whole policies',
   comparisonMode:mode,comparisonId:mode==='all'?r.id+'|'+c.reference:r.id,paperGates:r.gates,comparisons:choices}));
 });
}
