const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8773/';
const out=process.argv[3]||'/tmp/results-browser-preview-20261102';
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const results=[],errors=[];
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  try{
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:1000}});
      page.on('pageerror',e=>errors.push({width,message:e.message}));
      async function screenshot(name,ready){
        if(ready)await page.locator(ready).first().waitFor();
        check(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),`${name} page overflow at ${width}`);
        await page.screenshot({path:path.join(out,`${name}-${width}.png`)});
        results.push({name,width});
      }
      await page.goto(base);await page.locator('#returns-gallery svg').first().waitFor();
      check(new URL(page.url()).hash==='#returns','Return curves not default');
      check(await page.locator('#returns-gallery .return-axis').count()===20,'Missing default return axes');
      check(!(await page.locator('body').innerText()).includes('Which shifts damage'),'Narrative questions still visible');
      await screenshot('returns','#returns-gallery svg');
      await page.locator('#variant').selectOption('a2p95');
      await page.locator('[data-page=advanced]').click();await page.locator('.metric-panel svg').first().waitFor();
      check(await page.locator('.metric-panel').count()===20,'Missing advanced metric axes');
      check(new URL(page.url()).searchParams.get('setting')==='a2p95','Lost selected cap');
      await screenshot('advanced','.metric-panel svg');
      await page.locator('[data-open-axis=actuator_gain]').click();await page.locator('#metric-threshold').waitFor();
      check(await page.locator('#analysis-scope').inputValue()==='axis','Opening current axis did not change scope');
      await page.locator('#metric-threshold').fill('0.7');await page.locator('#metric-threshold').dispatchEvent('input');
      check((await page.locator('#metric-threshold-label').textContent()).includes('70'),'Threshold failed');
      await screenshot('single-axis','#threshold-readout');
      await page.locator('[data-page=seeds]').click();await page.locator('.seed-table tbody tr').first().waitFor();
      const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-seed-download]').click()]);
      check(download.suggestedFilename().endsWith('.csv'),'Seed download missing');
      await screenshot('seeds','.seed-table');
      await page.locator('[data-page=advanced]').click();await page.locator('[data-metric=aggregate]').click();
      await page.locator('.cap-table tbody tr').first().waitFor();
      check(await page.locator('.cap-table tbody tr').count()===11,'Incomplete cap table');
      await screenshot('caps','.heatmap');
      await page.locator('[data-heat-model=a3p00][data-heat-axis=mass]').click();await page.locator('#metric-threshold').waitFor();
      check(await page.locator('#variant').inputValue()==='a3p00','Heatmap did not select cap');
      check(await page.locator('#analysis-axis').inputValue()==='mass','Heatmap did not select axis');
      await page.locator('[data-cap-mode=best]').click();await page.locator('.panel-selection').first().waitFor();
      check((await page.locator('#analysis-caption').textContent()).includes('Best per axis'),'Best mode mislabeled');
      await page.waitForFunction(()=>document.querySelector('#analysis-scope option[value=suite]')?.disabled,{timeout:5000});
      await page.locator('[data-cap-mode=all]').click();await page.locator('.analysis-legend span').first().waitFor();
      check(await page.locator('.analysis-legend span').count()===11,'All-cap metrics incomplete');
      await page.locator('[data-page=returns]').click();await page.locator('.return-legend').first().waitFor();
      check(await page.locator('.return-legend').first().locator('span').count()===11,'All-cap return legend incomplete');
      await page.locator('#bands-gallery').uncheck();
      check(await page.locator('#returns-gallery [data-band]').count()===0,'SD toggle ignored in all-cap mode');
      await page.locator('[data-cap-mode=fixed]').click();
      await page.locator('[data-page=figures]').click();await page.locator('.figure-item').first().waitFor();
      check(await page.locator('#figure-study').inputValue()==='ppo_tv_walker','Figure cohort lost');
      await screenshot('figures','.figure-item');
      await page.goBack();await page.locator('#returns-gallery svg').first().waitFor();
      check(new URL(page.url()).hash==='#returns','Browser back lost tab');
      await page.locator('[data-page=advanced]').click();await page.locator('.metric-panel').first().waitFor();
      await page.locator('#env-tabs button').filter({hasText:'PickCube'}).click();
      await page.waitForFunction(()=>new URLSearchParams(location.search).get('study')==='ppo_tv_pickcube');
      await page.locator('#branch').selectOption('ppo_tv_pickcube_20261028');
      await page.waitForFunction(()=>new URLSearchParams(location.search).get('study')==='ppo_tv_pickcube_20261028');
      await page.locator('.metric-panel').first().waitFor();
      await page.locator('#analysis-scope').selectOption('gallery');
      check(await page.locator('.metric-panel').count()===6,'Cohort change lost task axes');
      check(await page.locator('#variant option').count()===9,'Joint-delta cohort mixed with historical cohort');
      await page.locator('#analysis-scope').selectOption('condition');
      await page.locator('#analysis-value').selectOption({index:0});
      const condition=await page.locator('#analysis-value').inputValue();
      await page.locator('[data-page=returns]').click();await page.locator('#returns-gallery svg').first().waitFor();
      check(new URL(page.url()).searchParams.get('value')===condition,'Selected condition lost on tab switch');
      await page.goto(base+'?study=td3_tv_walker&setting=tvc400&reference=tvc500&scope=suite#advanced');
      await page.locator('.panel-stats').first().waitFor();
      check(await page.locator('#reference').inputValue()==='tvc500','Inactive control substituted');
      await page.locator('[data-page=returns]').click();await page.locator('.return-legend').first().waitFor();
      check((await page.locator('.return-legend').first().innerText()).includes('Inactive cap 500'),'Return comparator not shared');
      await page.goto(base+'?study=sac_tv_pusher&scope=axis#advanced');await page.locator('.metric-unavailable').first().waitFor();
      await page.locator('#analysis-kind').selectOption('raw');await page.locator('.metric-chart').first().waitFor();
      check((await page.locator('.metric-chart').first().getAttribute('aria-label')).includes('Native return'),'Negative task raw survival missing');
      await screenshot('negative-return','.metric-chart');
      await page.goto(base+'?study=lunar_sac_tv&metric=outcomes&scope=suite#advanced');await page.locator('#analysis-content table').waitFor();
      await screenshot('outcomes','#analysis-content table');
      await page.goto(base+'?study=ppo_tv_pickcube_20261028&metric=outcomes#advanced');await page.locator('.metric-unavailable').first().waitFor();
      check((await page.locator('.metric-unavailable').first().textContent()).includes('No recorded'),'Invented task outcomes');
      if(width===1440){
        const studies=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/appendix/index.json'))).studies;
        for(const s of studies){
          await page.goto(base+`?study=${s.id}&metric=aggregate#advanced`);await page.locator('.cap-table tbody tr').first().waitFor();
          check(await page.locator('.cap-table tbody tr').count()===s.models.length,`Missing settings ${s.id}`);
          results.push({name:'cohort-cap-summary',study:s.id,width});
        }
      }
      await page.close();
    }
    check(!errors.length,JSON.stringify(errors));
    const result={base,checkedAt:new Date().toISOString(),results,errors};
    fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({checks:results.length,errors,output:out}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
