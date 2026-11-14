export const dimensions=['mean','reliability','catastrophe','band','consistency'];
export const names={mean:'Mean return',reliability:'Reliability',catastrophe:'Catastrophic failure',band:'Banded reliability',consistency:'Consistency',failure:'Failure band',degraded:'Degraded band',near:'Near-nominal band'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const metricKey=(dimension,band='failure')=>dimension==='band'?band:dimension;
export function levelOf(row,dimension,band='failure',method='primary'){
 const p=row.profile[metricKey(dimension,band)];return method==='primary'?p.level:p[method];
}
export const scopeLabel=value=>value===null?'Unavailable':value===0?'Not established':'L'+value;
export function evidenceBound(test,key,method){
 const c=test?.[method]?.interval;if(!c||!test.eligible)return -Infinity;
 return key==='consistency'?c[1]-.5:key==='catastrophe'?-c[2]:key==='mean'?(c[1]-test.margin)/(Math.abs(test.reference)||1):c[1];
}
export function pentagon(row,band='failure',method='primary'){
 const values=dimensions.map(d=>levelOf(row,d,band,method));
 const point=(i,r)=>{const a=(-90-72*i)*Math.PI/180;return [280+155*r*Math.cos(a),215+155*r*Math.sin(a)];};
 const xy=p=>p.map(v=>v.toFixed(2)).join(',');
 let svg=`<svg class="profile-pentagon" viewBox="0 0 560 440" role="img" aria-label="${esc(row.model)} versus ${esc(row.reference)}: five independent evidence scopes"><title>${dimensions.map((d,i)=>names[d]+': '+scopeLabel(values[i])).join('; ')}</title>`;
 for(let r=1;r<=3;r++)svg+=`<polygon points="${dimensions.map((_,i)=>xy(point(i,r/3))).join(' ')}" fill="none" stroke="#c6cdd1"/><text x="${289+r*26}" y="${211-r*40}" fill="#6c767c" font-size="13">L${r}</text>`;
 dimensions.forEach((_,i)=>{const p=point(i,1);svg+=`<line x1="280" y1="215" x2="${p[0]}" y2="${p[1]}" stroke="#c6cdd1"/>`;});
 if(values.every(v=>v!==null))svg+=`<polygon points="${values.map((v,i)=>xy(point(i,v/3))).join(' ')}" fill="#16745b" fill-opacity=".12" stroke="#16745b" stroke-width="2.5"/>`;
 else values.forEach((v,i)=>{const next=(i+1)%5;if(v!==null&&values[next]!==null)svg+=`<path d="M${xy(point(i,v/3))}L${xy(point(next,values[next]/3))}" fill="none" stroke="#16745b" stroke-width="2.5"/>`;});
 const labels=[['Mean return'],['Reliability'],['Catastrophic','failure'],['Banded','reliability'],['Consistency']];
 const positions=[[280,28,'middle'],[109,156,'end'],[177,390,'end'],[383,390,'start'],[451,156,'start']];
 values.forEach((v,i)=>{const [x,y,anchor]=positions[i];const p=point(i,v===null?1:v/3);
  svg+=v===null?`<path d="M${p[0]-4},${p[1]-4}l8,8m0,-8l-8,8" stroke="#8e979d" stroke-width="2"/>`:`<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#16745b"><title>${names[dimensions[i]]}: ${scopeLabel(v)}</title></circle>`;
  svg+=`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="15" fill="#202b31">${labels[i].map((t,n)=>`<tspan x="${x}" dy="${n?18:0}">${t}</tspan>`).join('')}<tspan x="${x}" dy="20" font-size="12" fill="#617078">${scopeLabel(v)}</tspan></text>`;
 });
 return svg+'</svg>';
}
