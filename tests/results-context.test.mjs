import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonParams,environmentLink} from '../assets/results-context.mjs';

test('environment selections replace stale global-view selections',()=>{
  const p=comparisonParams('?study=walker&cohort=drawer&setting=old&parameter=cap8&axis=mass&shift=friction&value=0.5&point=9');
  assert.equal(p.get('study'),'drawer');assert.equal(p.get('setting'),'cap8');
  assert.equal(p.get('axis'),'friction');assert.equal(p.get('value'),'0.5');
  for(const key of ['cohort','parameter','shift','point'])assert.equal(p.has(key),false);
});
test('old point-only links and explicit zero severities remain valid',()=>{
  assert.equal(comparisonParams('?study=ant&point=4').get('point'),'4');
  const p=comparisonParams('?value=0&point=4&reference=control&scope=axis');
  assert.equal(p.get('value'),'0');assert.equal(p.get('reference'),'control');
  assert.equal(p.get('scope'),'axis');assert.equal(p.has('point'),false);
});
test('environment return links keep the exact fixed comparison',()=>{
  const link=environmentLink('/index.html',{study:'humanoid',model:'tv_c2.5',axis:'action_delay',value:0});
  const url=new URL(link,'https://example.org');const p=comparisonParams(url.search);
  assert.equal(url.hash,'#environments');assert.equal(p.get('study'),'humanoid');
  assert.equal(p.get('setting'),'tv_c2.5');assert.equal(p.get('value'),'0');
});
