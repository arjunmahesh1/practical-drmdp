export const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
export function moments(values){
  if(values.length<2||values.some(v=>!Number.isFinite(v)))return null;
  const m=mean(values);
  return {mean:m,sd:Math.sqrt(values.reduce((s,v)=>s+(v-m)**2,0)/(values.length-1)),n:values.length};
}
export const tolerance=(...values)=>1e-10*Math.max(1,...values.map(Math.abs));
export function classify(point){
  const {standard:s,robust:r,standardSD:ss,robustSD:rs}=point;
  const valid=[s,r,ss,rs].every(Number.isFinite)&&ss>=0&&rs>=0;
  const eps=valid?tolerance(s,r,ss,rs):0;
  return {...point,valid,delta:valid?r-s:null,gap:valid?r-rs-s-ss:null,
    positive:valid&&r-s>eps,separated:valid&&r-rs-s-ss>eps,
    upperGap:valid?r+rs-s-ss:null,upper:valid&&r+rs-s-ss>eps};
}
export function ranges(row,screen='upper',includeSingles=false){
  if(row.warning)return [];
  const out=[];let run=[];
  const flush=()=>{if(run.length>=(includeSingles?1:2))out.push({from:run[0].x,to:run.at(-1).x,count:run.length,
    minDelta:Math.min(...run.map(p=>p.delta)),maxDelta:Math.max(...run.map(p=>p.delta)),
    minUpperGap:Math.min(...run.map(p=>p.upperGap)),maxUpperGap:Math.max(...run.map(p=>p.upperGap)),values:run.map(p=>p.x)});run=[];};
  for(const p of row.points){
    // A nominal value between two saved samples also separates shift directions.
    if(run.length&&row.nominal!==null&&run.at(-1).x<row.nominal&&p.x>row.nominal)flush();
    if(p.valid&&p.complete&&!p.nominal&&p[screen])run.push(p);else flush();
  }
  flush();return out;
}
export function matchingRows(rows,{environment='all',method='all',screen='upper',selection='best',singles=false,search=''}={}){
  return rows.filter(r=>(environment==='all'||r.environmentId===environment)&&(method==='all'||r.method===method)&&
    (selection!=='best'||r.best)&&(!search||(r.environment+' '+r.method+' '+r.settingLabel+' '+r.axisTitle+' '+r.configuration).toLowerCase().includes(search.toLowerCase()))&&
    (screen==='all'||ranges(r,screen,singles).length));
}

// Normalize against the whole curve, not a near-zero return at one severity.
export function rankAdvantage(row,{threshold=.05,screen='upper',singles=false}={}){
  const criterion=screen==='all'?'upper':screen;
  const complete=row.points.filter(p=>p.valid&&p.complete);
  const edges=complete.flatMap(p=>[p.standard-p.standardSD,p.standard+p.standardSD,p.robust-p.robustSD,p.robust+p.robustSD]);
  const scale=edges.length?Math.max(...edges)-Math.min(...edges):0;
  const strength=p=>criterion==='upper'?Math.min(p.delta,p.upperGap):criterion==='separated'?p.gap:p.delta;
  const scored={...row,points:row.points.map(p=>({...p,
    noticeable:scale>0&&p[criterion]&&p.positive&&strength(p)>=threshold*scale,
    meanBacked:p[criterion]&&p.positive}))};
  const allSpans=ranges(row,criterion,singles),noticeable=ranges(scored,'noticeable',singles);
  const backed=ranges(scored,'meanBacked',singles);
  const tier=noticeable.length?'noticeable':backed.length?'small':'spread';
  const spans=tier==='noticeable'?noticeable:allSpans;
  const total=complete.filter(p=>!p.nominal).length;
  const segmentScores=spans.map(s=>{
    const points=scored.points.filter(p=>s.values.includes(p.x));
    const average=scale>0?mean(points.map(p=>Math.max(0,tier==='spread'?p.upperGap:strength(p))/scale)):0;
    return {score:total?average*s.count/total:0,average,count:s.count};
  }).sort((a,b)=>b.score-a.score);
  return {tier:allSpans.length?tier:'none',scale,spans,allSpans,
    score:segmentScores[0]?.score||0,average:segmentScores[0]?.average||0,
    count:segmentScores[0]?.count||0,total};
}

export function prioritizeRows(rows,options={}){
  const order={noticeable:0,small:1,spread:2,none:3};
  return rows.map(row=>({row,rank:rankAdvantage(row,options)})).sort((a,b)=>
    order[a.rank.tier]-order[b.rank.tier]||b.rank.score-a.rank.score||a.row.id.localeCompare(b.row.id));
}
