const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8773/';
const out=process.argv[3]||'/tmp/returns-nov03-browser';
const ids=['td3_tv_halfcheetah','td3_kl_physical_halfcheetah','sac_tv_pickcube_20261028','td3_tv_pickcube_20261029'];
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[],checks=[];
  const check=(x,m)=>{if(!x)throw Error(m);};
  try{
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:1000}});
      page.on('pageerror',e=>errors.push(e.message));
      for(const id of ids){
        const count=id.includes('halfcheetah')?36:6;
        await page.goto(base+'?study='+id+'&setting=best#returns');
        await page.locator('#returns-gallery svg').first().waitFor();
        check(await page.locator('#returns-gallery .return-axis').count()===count,id+' axes missing');
        check((await page.locator('#returns-gallery').innerText()).includes('Standard'),id+' fixed reference missing');
        check(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),id+' overflow');
        if(id==='td3_tv_halfcheetah'){
          check((await page.locator('#returns-gallery').innerText()).includes('Horizontal gravity'),'Gravity mislabeled');
          check((await page.locator('#returns-gallery').innerText()).includes('Cap 900'),'Best cap wrong');
        }
        await page.screenshot({path:path.join(out,id+'-returns-'+width+'.png')});checks.push({id,width,view:'returns',axes:count});
        await page.locator('[data-page=advanced]').click();
        await page.locator('.metric-panel').first().waitFor();
        await page.locator('[data-metric=aggregate]').click();
        await page.locator('.cap-table tbody tr').first().waitFor();
        check(await page.locator('.cap-table tbody tr').count()===(id.includes('kl_physical')?7:9),'Setting table incomplete');
        if(id.includes('halfcheetah'))check((await page.locator('#analysis-content').innerText()).includes('effectiveness is unverified'),'Flat-axis caveat missing');
        check(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),id+' advanced overflow');
        await page.screenshot({path:path.join(out,id+'-advanced-'+width+'.png')});checks.push({id,width,view:'advanced'});
        await page.locator('[data-page=seeds]').click();await page.locator('.seed-table tbody tr').first().waitFor();
        check(await page.locator('.seed-table').first().locator('tbody tr').count()===30,'Seed table incomplete');checks.push({id,width,view:'seeds'});
        await page.locator('[data-page=figures]').click();await page.locator('.figure-item').first().waitFor();
        check(await page.locator('#figure-study').inputValue()===id,'Figure cohort lost');
        check(await page.locator('.figure-item').count()===Math.min(24,count+1),'Figure links incomplete');
        const href=await page.locator('.figure-item a').first().getAttribute('href');
        const response=await page.request.get(new URL(href,base).href);
        check(response.ok(),'PDF not served');check((await response.body()).subarray(0,5).toString()==='%PDF-','Invalid PDF');
        checks.push({id,width,view:'figures',pdf:true});
      }
      await page.close();
    }
    check(!errors.length,'Browser errors: '+errors.join(';'));
    fs.writeFileSync(path.join(out,'browser_qa.json'),JSON.stringify({checked_utc:new Date().toISOString(),base,checks,errors},null,2));
    console.log(JSON.stringify({checks:checks.length,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
