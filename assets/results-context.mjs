export function comparisonParams(search){
  const params=new URLSearchParams(search);
  for(const [alias,key] of [['cohort','study'],['parameter','setting'],['shift','axis']]){
    if(params.has(alias))params.set(key,params.get(alias));
    params.delete(alias);
  }
  if(params.has('value'))params.delete('point');
  return params;
}

export function environmentLink(path,{study,model,axis,value}){
  const params=new URLSearchParams({cohort:study,parameter:model,shift:axis,value});
  return path+'?'+params+'#environments';
}
