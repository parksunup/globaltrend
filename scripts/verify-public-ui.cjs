const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const base = process.env.AUDIT_BASE_URL || 'http://localhost:3000';
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(15000);
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function visit(route) { const response = await page.goto(base + route, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200, route); }
  async function check(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (error) { results.push({ name, pass: false, error: error.message }); } process.stdout.write(JSON.stringify(results.at(-1)) + '\n'); }
  async function clickRoute(name, route) { await page.getByRole('link', { name, exact: true }).first().click(); await page.waitForURL(url => url.pathname === route); }

  await check('Public menu and worker navigation', async () => {
    for (const route of ['/public', '/public/search', '/public/laws', '/public/weekly']) {
      await visit(route);
      for (const [name, target] of [['동향', '/public'], ['주간호', '/public/weekly'], ['동향 검색', '/public/search'], ['법제 비교', '/public/laws']]) await clickRoute(name, target);
      await clickRoute('작업자용 페이지', '/');
      await clickRoute('공개 사이트 보기', '/public');
    }
  });
  await check('Only published home items have detail links', async () => {
    await visit('/public');
    const links = await page.locator('ol[class*="timeline"] a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    if (!links.length) assert(await page.getByText(/발행된 동향이 없습니다|자료를 불러오지 못했습니다/).count());
    for (const href of links) {
      await visit('/public'); await page.locator('a[href="' + href + '"]').first().click(); await page.waitForURL(url => url.pathname === href);
      assert(await page.locator('h1').textContent()); assert(await page.getByRole('link', { name: /공식 원문 보기/ }).count());
    }
  });
  await check('Search URL, filters, sorting and detail', async () => {
    await visit('/public/search');
    const input = page.getByRole('textbox', { name: '동향 검색어' });
    await input.fill('아동 개인정보'); await page.getByRole('button', { name: '검색', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('q') === '아동 개인정보');
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await input.inputValue(), '아동 개인정보');
    await page.getByRole('button', { name: '검색어 지우기' }).click(); await page.waitForURL(url => !url.search);
    const groups = page.locator('details[class*="filterGroup"]');
    for (let group = 0; group < 3; group++) {
      const count = await groups.nth(group).locator('button').count();
      for (let index = 0; index < count; index++) {
        await groups.nth(group).locator('button').nth(index).click();
        await page.getByRole('button', { name: '초기화', exact: true }).click();
      }
    }
    await page.getByRole('button', { name: '최신순' }).click(); await page.getByRole('button', { name: '관련도순' }).click();
    if (await page.locator('[class*="storyCard"]').count()) {
      await page.locator('[class*="storyCard"]').last().click();
      const title = await page.locator('[class*="preview"] h2').textContent();
      await page.getByRole('link', { name: '상세 보기 →' }).click();
      await page.waitForURL(/\/public\/trends\/[0-9a-f-]{36}$/);
      assert.equal(await page.locator('h1').textContent(), title);
    }
  });
  await check('Law comparison and editorial login', async () => {
    await visit('/public/laws');
    assert.equal(await page.locator('[class*="criteriaList"] button').count(), 17);
    assert.equal(await page.locator('[aria-label="비교 국가 선택"] button').count(), 7);
    await visit('/'); await clickRoute('동향 작성·발행', '/work');
    assert(await page.getByRole('button', { name: '로그인' }).count());
    await visit('/team'); await clickRoute('동향 작성·발행', '/work');
  });
  await check('Public and worker pages fit common widths', async () => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/', '/team', '/work', '/public', '/public/search', '/public/laws', '/public/weekly']) {
        await visit(route);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), width + 'px ' + route);
        if (route === '/public/search' && width === 390) {
          await page.getByRole('button', { name: '검색 필터 펼치기' }).click();
          assert(await page.locator('details').first().isVisible());
        }
      }
    }
  });
  await check('No browser runtime errors', async () => assert.deepEqual(errors, []));
  await browser.close();
  fs.writeFileSync(process.env.AUDIT_REPORT || path.join(os.tmpdir(), 'globaltrend-ui-audit.json'), JSON.stringify({ base, results, errors }, null, 2));
  process.exitCode = results.some(row => !row.pass) ? 1 : 0;
})().catch(error => { console.error(error); process.exit(1); });
