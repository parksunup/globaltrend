import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const base = process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:3000";
assert(process.env.PLAYWRIGHT_MODULE, "PLAYWRIGHT_MODULE is required");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch();
const routes = ["/public", "/public/search", "/public/weekly", "/public/laws?view=full", "/public/laws?view=compare", "/feedback"];
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600, isMobile: width < 600 });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => console.error("Browser error:", error.message));
    for (const route of routes) {
      const response = await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, route + " must load at " + width + "px");
      const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert(bodyWidth <= width + 2, route + " overflows at " + width + "px: " + bodyWidth);
    }
    if (width < 600) {
      await page.goto(new URL("/public", base).href);
      await page.getByRole("button", { name: "메뉴" }).click();
      await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "국가별 법제" }).waitFor({ state: "visible" });
      await page.goto(new URL("/public/search", base).href);
      await page.getByRole("button", { name: "검색 필터 펼치기" }).click();
      await page.getByRole("button", { name: /건 결과 보기/ }).click();
    }
    await page.goto(new URL("/public/laws/appi", base).href);
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
    console.log("Public pages, navigation, comparison and article search pass at " + width + "px");
    await context.close();
  }
} finally {
  await browser.close();
}
