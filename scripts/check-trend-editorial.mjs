import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const base=process.env.PUBLIC_BASE_URL||'http://127.0.0.1:3000';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});
const drafts=JSON.parse(readFileSync('data/trends/editorial/report-drafts.json','utf8')).items;
mkdirSync('work/screenshots',{recursive:true});
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const draft of drafts){
   const response=await page.goto(base+'/public/trends/'+draft.record_id);
   assert.equal(response.status(),200,draft.record_id);
   assert.equal(await page.locator('h1').innerText(),draft.title_ko);
   assert.equal(await page.locator('article section').first().locator('p').innerText(),draft.summary_ko);
   assert.equal(await page.locator('article ul li').count(),draft.details_ko.split('\n\n').length);
   assert.equal(await page.locator('article ul li p').first().innerText(),draft.details_ko.split('\n\n')[0].replace(/^- \([^)]+\) /,''));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${draft.record_id}: horizontal overflow at ${width}`);
  }
  await page.goto(base+'/public/weekly');
  assert.equal(await page.locator('table tbody tr').count(),7);
  assert.equal(await page.locator('article[id^="weekly-"]').count(),7);
  const contentsLink=page.locator('table tbody a').first();
  const target=await contentsLink.getAttribute('href');await contentsLink.click();
  await page.waitForURL(url=>url.hash===target);
  assert.equal(await page.locator(target+' h4').innerText(),drafts.find(d=>d.record_id===target.slice('#weekly-'.length)).title_ko);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`weekly overflow ${width}`);
  await page.screenshot({path:`work/screenshots/trend-weekly-${width}.png`,fullPage:false});
  assert.deepEqual(errors,[]);
  console.log(`Verified ${drafts.length} revised trend details and weekly anchors at ${width}px`);
  await context.close();
 }
}finally{await browser.close();}
