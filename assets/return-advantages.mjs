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
    positive:valid&&r-s>eps,separated:valid&&r-rs-s-ss>eps};
}
export function ranges(row,screen='separated',includeSingles=false){
  if(row.warning)return [];
  const out=[];let run=[];
  const flush=()=>{if(run.length>=(includeSingles?1:2))out.push({from:run[0].x,to:run.at(-1).x,count:run.length,
    minDelta:Math.min(...run.map(p=>p.delta)),maxDelta:Math.max(...run.map(p=>p.delta)),values:run.map(p=>p.x)});run=[];};
  for(const p of row.points){
    // A nominal value between two saved samples also separates shift directions.
    if(run.length&&row.nominal!==null&&run.at(-1).x<row.nominal&&p.x>row.nominal)flush();
    if(p.valid&&p.complete&&!p.nominal&&p[screen])run.push(p);else flush();
  }
  flush();return out;
}
export function matchingRows(rows,{environment='all',method='all',screen='separated',selection='best',singles=false,search=''}={}){
  return rows.filter(r=>(environment==='all'||r.environmentId===environment)&&(method==='all'||r.method===method)&&
    (selection!=='best'||r.best)&&(!search||(r.environment+' '+r.method+' '+r.settingLabel+' '+r.axisTitle+' '+r.configuration).toLowerCase().includes(search.toLowerCase()))&&
    (screen==='all'||ranges(r,screen,singles).length));
}
