import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";

const base = process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:3000";
assert(process.env.PLAYWRIGHT_MODULE, "PLAYWRIGHT_MODULE is required");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
const routes = ["/public", "/public/search", "/public/weekly", "/public/laws?view=full", "/public/laws?view=compare", "/feedback", "/", "/team", "/guide", "/work", "/work/legal"];
await mkdir("work/screenshots", { recursive: true });
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600, isMobile: width < 600 });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    for (const route of routes) {
      const response = await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, route + " must load at " + width + "px");
      const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert(bodyWidth <= width + 2, route + " overflows at " + width + "px: " + bodyWidth);
    }
    await page.goto(new URL("/public", base).href);
    assert.equal(await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "피드백" }).count(), 0, "Public menu must not link to feedback");
    assert.equal(await page.locator('footer a[href="/feedback"]').count(), 0, "Public footer must not link to feedback");
    await page.locator('a[href^="/public/trends/"]').first().click();
    assert.equal(await page.getByText("이 자료에 의견 남기기", { exact: false }).count(), 0, "Public trend detail must not show review feedback");
    await page.goto(new URL("/feedback", base).href);
    assert.equal(await page.locator('a[href="/team"]').first().getAttribute("href"), "/team");
    if (width < 600) {
      await page.goto(new URL("/public", base).href);
      await page.getByRole("button", { name: "메뉴" }).click();
      await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "국가별 법제" }).waitFor({ state: "visible" });
      await page.goto(new URL("/public/search", base).href);
      await page.getByRole("button", { name: "검색 필터 펼치기" }).click();
      await page.getByRole("button", { name: /건 결과 보기/ }).click();
    }
    await page.goto(new URL("/public/laws/appi", base).href);
    assert.equal(await page.getByRole("button", { name: "이 조문에 의견 남기기" }).count(), 0, "Public law reader must not show review feedback");
    const search = page.getByRole("searchbox", { name: "조문 검색" });
    await search.fill("개인정보");
    const countText = await page.getByText(/^검색 결과 \d+개$/).innerText();
    assert(Number(countText.match(/\d+/)?.[0]) > 0, "Article body search must return results at " + width + "px");
    await search.fill("존재하지않는조문단어xyz");
    await page.getByText(/일치하는 조문이 없습니다/).first().waitFor({ state: "visible" });
    await search.fill("제2조");
    await page.getByRole("link", { name: /제2조/ }).first().click();
    await page.waitForURL((url) => url.hash.length > 1);
    await page.goto(new URL("/public/laws?view=compare", base).href);
    if (width < 600) {
      await page.getByRole("button", { name: /국가 변경/ }).click();
      await page.getByRole("button", { name: /국가 변경|선택 닫기/ }).first().waitFor();
      const link = page.locator('a[href^="/public/laws/appi"]:visible').first();
      await link.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ state: "visible" });
      assert((await dialog.innerText()).includes("한국어 번역 초안 일부"));
      await dialog.getByRole("button", { name: "닫기" }).click();
    } else {
      const link = page.locator('a[href^="/public/laws/appi"]:visible').first();
      await link.hover();
      const tooltip = page.getByRole("tooltip");
      await tooltip.waitFor({ state: "visible" });
      assert((await tooltip.innerText()).includes("한국어 번역 초안 일부"));
      await page.keyboard.press("Escape");
      await tooltip.waitFor({ state: "hidden" });
    }
    for (const law of ["appi", "pipl", "gdpr", "uk-gdpr", "ccpa", "pdpa"]) {
      const response = await page.goto(new URL(`/public/laws/${law}`, base).href);
      assert.equal(response?.status(),200,law + " full translation must load");
      assert(await page.locator('article[id]').count() > 0, law + " must contain real provisions");
      if (law === "gdpr") assert.equal(await page.locator('article[id^="recital-"]').count(),173);
      if (law === "uk-gdpr") assert.equal(await page.locator('article[id^="division-"]').count(),173);
      assert(await page.evaluate(() => document.documentElement.scrollWidth) <= width + 2, law + " must fit the viewport");
    }
    await page.goto(new URL('/public/laws?view=compare',base).href);
    await page.screenshot({path:`work/screenshots/laws-dark-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'밝은 테마로 전환'}).click();
    await page.screenshot({path:`work/screenshots/laws-light-${width}.png`,fullPage:true});
    await page.reload();
    await page.getByRole('button',{name:'어두운 테마로 전환'}).waitFor();
    assert.deepEqual(browserErrors,[],"Browser must not produce runtime exceptions");
    console.log("Public pages, worker routes, six full translations, themes, comparison and article search pass at " + width + "px");
    await context.close();
  }
} finally {
  await browser.close();
}
