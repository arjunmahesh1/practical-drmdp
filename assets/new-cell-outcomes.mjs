const ids=new Set(['drawer_ppo_tv30','drawer_sac_tv30','drawer_td3_tv30','pickcube_sac_kl30','pickcube_td3_kl30','pusher_td3_kl_delta30']);
let pending;
export const hasNewCellAudit=id=>ids.has(id);
export function mergeOutcomes(study,overlay){
  const saved=overlay[study.id];
  if(!saved)return study;
  return {...study,axes:study.axes.map(axis=>({...axis,values:Object.fromEntries(Object.entries(axis.values).map(([model,points])=>[model,points.map(point=>{
    const measured=saved[axis.id]?.[model]?.find(p=>p.x===point.x);
    return measured?{...point,outcomes:{...point.outcomes,...measured.outcomes}}:point;
  })]))}))};
}
export async function withNewOutcomes(study){
  if(!ids.has(study.id))return study;
  pending??=fetch('data/new-cells/outcomes.json?v=20261107-cells1').then(r=>{if(!r.ok)throw Error('Recorded outcomes unavailable');return r.json();}).catch(e=>{pending=null;throw e;});
  return mergeOutcomes(study,await pending);
}
