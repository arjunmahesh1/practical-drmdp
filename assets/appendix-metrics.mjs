export const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
export function median(xs){const a=[...xs].sort((a,b)=>a-b);return a.length?(a[Math.floor(a.length/2)]+a[Math.floor((a.length-1)/2)])/2:null;}
const same=(a,b)=>Math.abs(a-b)<1e-9;

export function conditions(study, model, reference, scope='suite', axisId=null, value=null, conditional=false){
  const axes=scope==='suite'?study.axes:study.axes.filter(a=>a.id===axisId);
  return axes.map(axis=>{
    const r0=median((axis.nominalSeeds[reference]||[]).map(s=>s[1]));
    const nominal=new Map(axis.nominalSeeds[model]||[]);
    let points=axis.values[model]||[];
    if(scope==='condition')points=points.filter(p=>same(p.x,value));
    else if(scope==='nominal')points=[{x:axis.nominal,seeds:axis.nominalSeeds[model]||[]}];
    else points=points.filter(p=>!same(p.x,axis.nominal));
    return {axis, r0, points:points.map(p=>({...p,seeds:p.seeds.filter(([s])=>!conditional||(r0>0&&nominal.has(s)&&nominal.get(s)/r0>=.5))}))};
  });
}

export function summarize(study,model,reference,scope='suite',axisId=null,value=null,conditional=false){
  const groups=conditions(study,model,reference,scope,axisId,value,conditional);
  const valid=groups.length>0&&groups.every(g=>g.r0>0&&g.points.length&&g.points.every(p=>p.seeds.length));
  const average=fn=>mean(groups.map(g=>mean(g.points.map(p=>mean(p.seeds.map(([s,r])=>fn(r,g.r0,s)))))));
  const raw=groups.length&&groups.every(g=>g.points.length&&g.points.every(p=>p.seeds.length))?average(r=>r):null;
  const reliability=t=>valid?average((r,r0)=>Number(r/r0>=t)):null;
  const auc=valid?average((r,r0)=>Math.max(0,Math.min(1,r/r0))):null;
  const perSeed=new Map();
  for(const g of groups)for(const p of g.points)for(const [seed,r] of p.seeds){
    if(!perSeed.has(seed))perSeed.set(seed,[]);
    perSeed.get(seed).push({axis:g.axis.id,r,z:g.r0>0?r/g.r0:null});
  }
  const seeds=[...perSeed].map(([seed,rows])=>{
    const keys=[...new Set(rows.map(r=>r.axis))];
    const byAxis=fn=>mean(keys.map(k=>mean(rows.filter(r=>r.axis===k).map(fn))));
    return {seed, raw:byAxis(r=>r.r), auc:valid?byAxis(r=>Math.max(0,Math.min(1,r.z))):null, axes:keys.length, conditions:rows.length};
  });
  const seedCounts=groups.flatMap(g=>g.points.map(p=>p.seeds.length));
  return {valid,raw,auc,reliability,catastrophe:valid?1-reliability(.5):null,seeds,axisCount:groups.length,
    conditionCount:groups.reduce((n,g)=>n+g.points.length,0), minN:seedCounts.length?Math.min(...seedCounts):0,maxN:seedCounts.length?Math.max(...seedCounts):0,
    referenceSources:[...new Set(groups.map(g=>g.axis.nominalSource))]};
}

export function severity(study,reference){
  return study.axes.map(axis=>{
    const r0=median((axis.nominalSeeds[reference]||[]).map(s=>s[1]));
    const retained=(axis.values[reference]||[]).filter(p=>!same(p.x,axis.nominal)).map(p=>median(p.seeds.map(s=>s[1]))/r0);
    return {id:axis.id,title:axis.title,value:r0>0&&retained.length?1-median(retained):null};
  });
}

export function rawReliability(study,model,reference,scope,axisId,value){
  const groups=conditions(study,model,reference,scope,axisId,value,false);
  const valid=groups.length>0&&groups.every(g=>g.points.length&&g.points.every(p=>p.seeds.length));
  const rows=groups.flatMap(g=>g.points.flatMap(p=>p.seeds.map(([,r])=>[r,1/groups.length/g.points.length/p.seeds.length])));
  const survival=t=>valid?rows.reduce((n,[r,w])=>n+(r>=t?w:0),0):null;
  const jumps=new Map();for(const [r,w] of rows)jumps.set(r,(jumps.get(r)||0)+w);
  const points=[];let remaining=1;
  for(const [r,w] of [...jumps].sort((a,b)=>a[0]-b[0])){points.push([r,remaining]);remaining=Math.max(0,remaining-w);points.push([r,remaining]);}
  return {valid,rows,points,survival};
}
