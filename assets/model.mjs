export const baselineColor = '#003087';
export const robustColor = '#d94b24';
export const fmt = (n, digits = 1) => Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
export const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function label(model) {
  const fixed = {vanilla:'Standard',a1e9:'Inactive cap 1e9',tvc1e9:'Inactive cap 1e9',tvc500:'Inactive cap 500',tv_noop:'Inactive TV cap',rsc_noop:'RSC · augmentation off',ctxkl0:'Context KL · radius 0',ctxkluniform:'Uniform context',klprho0:'Risk-neutral ensemble',rsc_active:'RSC · ratio 0.5',rsc:'RSC · ratio 0.5'};
  if (fixed[model]) return fixed[model];
  if (model.startsWith('kl_beta')) return 'β = '+model.slice(7);
  if (model.startsWith('klb')) return 'β = '+model.slice(3).replace('p','.');
  if (model.startsWith('klprho')) return 'ρ = '+model.slice(6).replace('p','.');
  if (model.startsWith('ctxkl')) return 'Context ρ = '+model.slice(5).replace('p','.');
  if (model.startsWith('tv_c')) return 'Cap '+model.slice(4);
  if (model.startsWith('tvc')) return 'Cap '+model.slice(3).replace('p','.');
  if (/^a\d/.test(model)) return 'Cap '+model.slice(1).replace('p','.');
  return model.replaceAll('_',' ');
}
export function activeModel(models) {
  return models.find(m => m !== 'vanilla' && !['a1e9','tvc1e9','tvc500','tv_noop','rsc_noop','ctxkl0','ctxkluniform','klprho0'].includes(m)) || models.find(m=>m!=='vanilla');
}
export function gridMean(points) {
  return points.reduce((sum,p)=>sum+p.mean,0)/points.length;
}
export function bestModelOnAxis(study,axis) {
  const controls=new Set([study.baseline,'a1e9','tvc1e9','tvc500','tv_noop','rsc_noop','ctxkl0','ctxkluniform','klprho0']);
  const candidates=study.models.filter(m=>!controls.has(m)&&axis.curves[m]?.length);
  return candidates.reduce((best,m)=>best===null||gridMean(axis.curves[m])>gridMean(axis.curves[best])?m:best,null);
}
export function axisLabel(axis,environment) {
  if (/replace|bernoulli/.test(axis.id)) return 'Replacement probability';
  if (axis.id==='gravity'&&environment.startsWith('Lunar')) return 'Gravity (m/s²)';
  if (/noise|wind|turbulence/.test(axis.id)) return 'Disturbance amplitude';
  return 'Parameter scale (×)';
}
export function nearestPoint(points, value) {
  if (!points.length) throw new Error('No measured points');
  return points.reduce((best,p,i)=>Math.abs(p.x-value)<Math.abs(points[best].x-value)?i:best,0);
}
export function bounds(axis, bands = true) {
  const points=Object.values(axis.curves).flat();
  let lo=Math.min(...points.map(p=>p.mean-(bands?p.sd:0))), hi=Math.max(...points.map(p=>p.mean+(bands?p.sd:0)));
  const pad=(hi-lo||Math.abs(hi)||1)*.09;return [lo-pad,hi+pad];
}
export function factorLabel(axis, value, environment) {
  if (axis.id==='gravity' && environment.startsWith('Lunar')) return fmt(value,2)+' m/s²';
  if (/replace|bernoulli/.test(axis.id)) return fmt(value*100,2)+'%';
  if (/noise|wind|turbulence/.test(axis.id)) return fmt(value,3);
  return fmt(value,3)+'×';
}
