const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8766/';
const out=process.argv[3]||'/tmp/appendix-browser-qa-20261029';
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const results=[],errors=[];
  try{
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:1000}});
      page.on('pageerror',e=>errors.push({width,message:e.message}));
      const cases=[['index','#appendix','#study-index tbody tr'],['evidence','#evidence','.evidence-row'],['reliability','?study=ppo_tv_walker&setting=a2p95&axis=mass&scope=condition&value=0.5#metrics','#seed-table tbody tr'],['suite','?study=td3_tv_walker&setting=tvc400&reference=tvc500#metrics','#seed-table tbody tr'],['negative','?study=sac_tv_pusher#metrics','.blank'],['raw','?study=ppo_tv_walker&setting=a2p95&axis=mass&scope=condition&value=0.5&metric=raw&threshold=500#metrics','#raw-result'],['outcomes','?study=lunar_sac_tv&metric=outcomes#metrics','#metric-content table'],['no-outcomes','?study=ppo_tv_pickcube_20261028&metric=outcomes#metrics','.blank'],['aggregate','?study=ppo_tv_pickcube_20261028&metric=aggregate#metrics','.aggregate-table tbody tr'],['figures','#figures','.figure-item'],['new-returns','?study=sac_kl_pusher#returns','#returns-gallery .return-axis']];
      for(const [name,suffix,ready] of cases){
        await page.goto(base+suffix);await page.locator(ready).first().waitFor({state:'visible'});
        if(name==='figures')await page.locator('.figure-item img').first().evaluate(img=>img.decode());
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
        if(overflow)throw Error(`${name} overflow at ${width}`);
        if(name==='reliability'){
          await page.locator('#reliability-threshold').fill('0.7');await page.locator('#reliability-threshold').dispatchEvent('input');
          if(!(await page.locator('#threshold-result').textContent()).includes('70.0%'))throw Error('Threshold slider not updated');
          await page.locator('#metric-kind').selectOption('seeds');await page.locator('.plot-title').filter({hasText:'Distribution'}).waitFor();
          await page.locator('#metric-kind').selectOption('reliability');
          const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#seed-download').click()]);
          if(!download.suggestedFilename().endsWith('.csv'))throw Error('CSV download missing');
        }
        if(name==='figures'){
          await page.locator('#figure-search').fill('fig:walker-ppo-mass-reliability');
          if(await page.locator('.figure-item').count()!==1)throw Error('Figure label filter mismatch');
        }
        await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:false});results.push({name,width,overflow});
      }
      // In-place navigation must preserve the appendix's selected cohort.
      await page.goto(base+'?study=ppo_tv_walker#metrics');await page.locator('#seed-table tbody tr').first().waitFor();
      await page.locator('#metric-study').selectOption('lunar_sac_tv');await page.waitForFunction(()=>new URLSearchParams(location.search).get('study')==='lunar_sac_tv');
      await page.locator('nav a[data-page=returns]').click();await page.waitForFunction(()=>document.querySelector('#algorithm').value==='SAC'&&document.querySelector('#version').value==='LunarLander-v3');
      await page.locator('nav a[data-page=metrics]').click();await page.locator('#seed-table tbody tr').first().waitFor();
      if(await page.locator('#metric-study').inputValue()!=='lunar_sac_tv')throw Error('Navigation lost cohort');
      // An aggregate menu visit must not alter the current fixed setting.
      await page.locator('#metric-kind').selectOption('aggregate');await page.locator('.aggregate-table tbody tr').first().waitFor();
      await page.locator('#metric-kind').selectOption('severity');await page.locator('#metric-content table').waitFor();
      if(width===1440){
        const studies=await page.locator('#metric-study option').evaluateAll(os=>os.map(o=>o.value));
        for(const id of studies){await page.locator('#metric-study').selectOption(id);await page.waitForFunction(id=>new URLSearchParams(location.search).get('study')===id,id);await page.locator('#metric-kind').selectOption('aggregate');await page.locator('.aggregate-table tbody tr').first().waitFor();const count=await page.locator('.aggregate-table tbody tr').count();results.push({name:'all-setting-summary',study:id,width,settings:count});}
      }
      await page.close();
    }
    if(errors.length)throw Error(JSON.stringify(errors));
    fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({base,checkedAt:new Date().toISOString(),results,errors},null,2));
    console.log(JSON.stringify({checks:results.length,errors,output:out}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
