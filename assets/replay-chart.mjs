import {fmt} from './model.mjs';

export function episodeTraceSVG(timeline,index,color,compact=false) {
  const W=compact?400:600,H=compact?220:200,L=78,R=22,T=24,B=52;
  const values=timeline.map(p=>p.reward),low=Math.min(...values),high=Math.max(...values);
  const pad=(high-low||Math.abs(high)||1)*.04,lo=low-pad,hi=high+pad;
  const end=timeline.at(-1).time||1,plotW=W-L-R,plotH=H-T-B;
  const x=t=>L+t/end*plotW,y=r=>H-B-(r-lo)/(hi-lo)*plotH;
  const ticks=[0,.5,1],parts=[];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Recorded episode: cumulative return over time" fill="#59656a" font-family="inherit">`);
  parts.push(`<text x="${L}" y="16" font-size="12">Recorded episode</text>`);
  for(const p of ticks){
    const value=lo+p*(hi-lo),yy=y(value);
    parts.push(`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#e7ece8"/>`);
    parts.push(`<text class="episode-y-tick" x="${L-8}" y="${yy+4}" text-anchor="end" font-size="12">${fmt(value,0)}</text>`);
  }
  for(const p of ticks){
    const value=p*end,xx=x(value);
    parts.push(`<line x1="${xx}" x2="${xx}" y1="${H-B}" y2="${H-B+5}" stroke="#9caaa0"/>`);
    parts.push(`<text class="episode-x-tick" x="${xx}" y="${H-B+22}" text-anchor="middle" font-size="12">${fmt(value,2)}</text>`);
  }
  parts.push(`<path class="episode-axes" d="M${L},${T}V${H-B}H${W-R}" fill="none" stroke="#9caaa0"/>`);
  parts.push(`<text class="x-axis-label" x="${L+plotW/2}" y="${H-8}" text-anchor="middle" font-size="14">Time (s)</text>`);
  parts.push(`<text class="y-axis-label" transform="translate(18 ${T+plotH/2}) rotate(-90)" text-anchor="middle" font-size="14">Cumulative return</text>`);
  parts.push(`<path class="episode-curve" d="${timeline.map((p,i)=>(i?'L':'M')+x(p.time)+','+y(p.reward)).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`);
  const point=timeline[index];
  parts.push(`<circle class="episode-cursor" cx="${x(point.time)}" cy="${y(point.reward)}" r="4" fill="${color}"/>`);
  parts.push('</svg>');
  return parts.join('');
}
