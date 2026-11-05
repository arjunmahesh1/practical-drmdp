export function cumulativeResult(gates,role='robust'){
  if(role==='reference')return {code:'reference',label:'Reference'};
  if(role==='control')return {code:'control',label:'Control'};
  if(gates.L1?.status==='fail')return {code:'none',label:'None (L1 failed)'};
  if(gates.L1?.status==='borderline')return {code:'borderline',label:'Borderline L1'};
  if(gates.L1?.status!=='pass')return {code:'unassessed',label:'Not assessed'};
  if(gates.L2?.status!=='pass')return {code:'L1',label:gates.L2?.status==='fail'?'L1':'At least L1'};
  if(gates.L3?.status==='pass')return {code:'L3',label:'L3'};
  return {code:'L2',label:gates.L3?.status==='unassessed'?'At least L2':'L2'};
}

export function splitGate(tests,declaredShifts,blockedAxes=[]){
  const checked=tests.map(t=>({...t,eligible:t.n===30&&!blockedAxes.includes(t.axis)}));
  const passed=checked.filter(t=>t.eligible&&t.L2===true);
  const complete=checked.length===declaredShifts&&checked.every(t=>t.eligible);
  return {status:passed.length?'pass':complete?'fail':'unassessed',basis:'saved split-shift tests',
    tested:checked.length,passed:passed.length,declared:declaredShifts,tests:checked,
    note:'Shift-selected settings only; unselected settings are not failed tests. These tests do not include the L1 prerequisite.'};
}

export const missingGate=note=>({status:'unassessed',basis:'none',note});

export function matchesSetting(row,{environment='all',algorithm='all',result='all',search='',archive=false}={}){
  return (archive||!row.archived)&&(environment==='all'||row.environment===environment)&&
    (algorithm==='all'||row.algorithm===algorithm)&&(result==='all'||row.result.code===result)&&
    [row.environment,row.algorithm,row.family,row.branch,row.settingLabel,row.model,row.result.label].join(' ').toLowerCase().includes(search.toLowerCase());
}

export function settingsCSV(rows){
  const fields=['environment','algorithm','family','branch','model','settingLabel','referenceLabel','result','L1','L2','L3','tested_shifts','passed_shifts','declared_shifts','nominal_mean','reference_nominal_mean','nominal_failures','reference_nominal_failures','policies','reference_policies','L1_basis','L3_basis','archived','evidence_note','comparison_mode','resampling','L1_reference','suite_auc_delta','suite_auc_lower','suite_auc_upper','suite_mean_delta','suite_mean_lower','suite_mean_upper','suite_return_margin'];
  const values=rows.map(r=>[r.environment,r.algorithm,r.family,r.branch,r.model,r.settingLabel,r.referenceLabel,r.result.label,
    r.gates.L1.status,r.gates.L2.status,r.gates.L3.status,r.gates.L2.tested??'',r.gates.L2.passed??'',r.gates.L2.declared??'',r.nominal?.mean,r.nominal?.referenceMean,r.nominal?.failures,r.nominal?.referenceFailures,r.nominal?.policies,r.nominal?.referencePolicies,r.gates.L1.basis,r.gates.L3.basis,r.archived,
    [r.gates.L1.note,r.gates.L2.note,r.gates.L3.note].filter(Boolean).join(' '),r.comparisonMode,r.resampling,r.l1ReferenceLabel,
    ...(r.gates.L3.d_auc||['','','']),...(r.gates.L3.d_mean||['','','']),r.gates.L3.margin]);
  return [fields,...values].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
}
