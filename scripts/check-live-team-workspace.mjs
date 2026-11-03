import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const base = process.env.TEAM_CHECK_URL || 'http://localhost:3018';
const browser = await chromium.launch({headless:true});
try {
  const context = await browser.newContext({viewport:{width:1365,height:900}});
  const page = await context.newPage();
  const failures=[]; page.on('pageerror',error=>failures.push(error.message));
  for (const role of ['trends','legal']) {
    const response = await context.request.get(`${base}/api/team-workspace?role=${role}`);
    assert.equal(response.status(),200,await response.text());
    const data = await response.json();
    assert.match(data.commitSha,/^[a-f0-9]{40}$/);
    assert.ok(data.items.length>0);
    if(role==='legal') {
      assert.ok(data.documents.legal.length>0);
      assert.ok(data.translations.some(law=>law.sections.some(section=>section.lines.length>0)));
    }
    await page.goto(`${base}/team?role=${role}`);
    await page.getByRole('status').filter({hasText:data.commitSha.slice(0,7)}).waitFor();
    if(role==='legal') {
      const law=data.translations[0];
      await page.getByRole('button',{name:`${law.title} · ${law.articleCount}조`,exact:true}).click();
      await page.getByRole('heading',{level:1,name:law.title,exact:true}).waitFor();
      assert.ok(await page.locator('article').innerText());
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile must not overflow');
      await page.setViewportSize({width:1365,height:900});
    }
    console.log(`LIVE ${role}: ${data.commitSha.slice(0,7)}, ${data.items.length} items, ${data.translations.length} translations`);
  }
  // Simulate two completed pushes and an outage without creating deployments or editing real staff data.
  const simulated = await browser.newContext({viewport:{width:390,height:844}});
  const screen = await simulated.newPage();
  await screen.clock.install();
  let version=1;
  await screen.route('**/api/team-workspace?role=*',async route=>{
    if(version===3) return route.fulfill({status:503,json:{error:'시험용 연결 실패'}});
    return route.fulfill({json:{role:'trends',branch:'feat/trend-source-contracts',commitSha:String(version).repeat(40),checkedAt:new Date().toISOString(),stale:false,translations:[],translationErrors:[],documents:{legal:[],weekly:null},notes:[],items:[{id:'fixture-test-one',group:'trends',kind:'동향 표본',title:version===1?'수정 전 제목':'수정 후 제목',subtitle:'시험 기관',summary:'미발행 제출 자료',status:'withheld',fields:[],links:[],files:[]}]}});
  });
  await screen.goto(`${base}/team?role=trends`);
  await screen.getByRole('heading',{name:'수정 전 제목',exact:true}).waitFor();
  version=2; await screen.clock.fastForward(121000);
  await screen.getByRole('heading',{name:'수정 후 제목',exact:true}).waitFor();
  version=3; await screen.clock.fastForward(121000);
  await screen.getByRole('alert').filter({hasText:'시험용 연결 실패'}).waitFor();
  assert.ok(await screen.getByRole('heading',{name:'수정 후 제목',exact:true}).isVisible());
  assert.equal(failures.length,0,failures.join('\n'));
  console.log('PASS: anonymous real-branch reading, full translation, mobile width, automatic revision change, retained last result with explicit outage warning');
} finally {await browser.close();}
