import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const base = process.env.PREVIEW_BASE_URL;
const expectedSha = process.env.PREVIEW_EXPECTED_SHA;
assert(base && expectedSha, "PREVIEW_BASE_URL and PREVIEW_EXPECTED_SHA are required");
const branch = "feat/trend-source-contracts";
const query = new URLSearchParams({ branch });
const artifactDir = process.env.PREVIEW_ARTIFACT_DIR ?? "preview-check-artifacts";

async function readFeedback(extra = {}) {
  const params = new URLSearchParams({ branch, ...extra, check: String(Date.now()) });
  const response = await fetch(new URL(`/api/feedback?${params}`, base), {
    headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Public feedback API returned HTTP ${response.status}`);
  return response.json();
}
async function waitForDeployment() {
  const deadline = Date.now() + 8 * 60 * 1000;
  let last = "Preview has not returned this commit yet";
  while (Date.now() < deadline) {
    try {
      const data = await readFeedback();
      if (data.deploymentCommit === expectedSha) return data;
      last = `Preview serves ${data.deploymentCommit ?? "unknown commit"}; waiting for ${expectedSha}`;
    } catch (error) { last = error.message; }
    console.log(last);
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  throw new Error(`Timed out waiting for the current Preview: ${last}`);
}
const snapshotMode = process.argv.includes("--deployed-snapshot");
async function verifiedDeployment() {
  if (!snapshotMode) return waitForDeployment();
  const active = await readFeedback();
  assert(/^[a-f0-9]{40}$/.test(active.deploymentCommit ?? ""), "Active Preview must identify its source commit");
  try {
    execFileSync("git", ["diff", "--quiet", active.deploymentCommit, "HEAD", "--",
      "app", "lib", "middleware.ts", "data", "public", "package.json", "pnpm-lock.yaml",
      "next.config.*", "tsconfig.json", "vercel.json"], { stdio: "pipe" });
  } catch {
    throw new Error("Active Preview " + active.deploymentCommit + " differs from the checked-out application, or its source commit is unavailable. Snapshot verification cannot proceed.");
  }
  return active;
}
const feedback = await verifiedDeployment();
console.log(snapshotMode
  ? "Verified active Preview " + feedback.deploymentCommit + " has the same application sources as checkout " + expectedSha
  : "Preview serves the expected commit " + expectedSha);
if (process.argv.includes("--wait-only")) process.exit(0);
assert.equal(feedback.branch, branch);
assert(Array.isArray(feedback.feedback) && feedback.feedback.length > 0,
  "Existing branch feedback must be visible without authentication");
assert(feedback.feedback.every((entry) => entry.branch_name === branch && typeof entry.body === "string" && entry.body.trim()),
  "Feedback must belong to the requested branch and contain a body");
const sample = feedback.feedback[0];
const itemFeedback = await readFeedback({ item: sample.item_id });
assert(itemFeedback.feedback.some((entry) => entry.id === sample.id), "Item lookup must include the historical feedback");
assert(itemFeedback.feedback.every((entry) => entry.item_id === sample.item_id), "Item lookup must not mix other items");
await mkdir(artifactDir, { recursive: true });
assert(process.env.PLAYWRIGHT_MODULE, "PLAYWRIGHT_MODULE is required");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch();
const results = { verificationMode: snapshotMode ? "deployed-snapshot" : "latest-deployment", deploymentCommit: feedback.deploymentCommit, checkoutCommit: expectedSha, applicationSourcesMatch: true, feedbackCount: feedback.feedback.length, feedbackSSR: false, previews: [] };
let page;
try {
  const feedbackContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  page = await feedbackContext.newPage();
  const response = await page.goto(new URL(`/feedback?${query}`, base).href, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "Public feedback page must be available anonymously");
  await page.getByRole("heading", { name: "저장된 피드백", exact: true }).waitFor();
  for (const entry of feedback.feedback.slice(0, 10)) {
    await page.getByText(entry.body, { exact: true }).first().waitFor({ state: "visible" });
  }
  await page.screenshot({ path: path.join(artifactDir, "feedback-anonymous-ssr.png"), fullPage: true });
  results.feedbackSSR = true;
  await feedbackContext.close();
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 600, isMobile: viewport.width < 600 });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    const pages = ["/public", "/public/search", "/public/weekly", "/public/laws?view=full", "/public/laws?view=compare", "/feedback"];
    for (const pathname of pages) {
      const response = await page.goto(new URL(pathname, base).href, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, pathname + " must load");
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      assert(width <= viewport.width + 2, pathname + " must not scroll horizontally: " + width + "/" + viewport.width);
    }
    if (viewport.width < 600) {
      await page.goto(new URL("/public", base).href);
      await page.getByRole("button", { name: "메뉴" }).click();
      await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "국가별 법제" }).waitFor({ state: "visible" });
    }
    for (const criterion of ["first", "법 적용 대상"]) {
      await page.goto(new URL("/public/laws?view=compare", base).href, { waitUntil: "domcontentloaded" });
      if (criterion !== "first") {
        if (viewport.width < 600) await page.locator("#mobile-criterion").selectOption((await page.locator("#mobile-criterion option").filter({ hasText: "법 적용 대상" }).getAttribute("value")) ?? "");
        else await page.getByRole("button", { name: /법 적용 대상/ }).click();
      }
      const japan = page.locator("article").filter({ has: page.getByRole("heading", { name: "일본", exact: true }) });
      const links = japan.locator('a[href^="/public/laws/appi"]:visible');
      const count = await links.count();
      assert(count > 0, "Japanese related-article links must exist");
      for (const index of [...new Set([0, count - 1])]) {
        const link = links.nth(index);
        await link.scrollIntoViewIfNeeded();
        const citation = await link.innerText();
        if (viewport.width < 600) {
          await link.click();
          const sheet = page.getByRole("dialog", { name: new RegExp(citation) });
          await sheet.waitFor({ state: "visible" });
          assert((await sheet.innerText()).includes("한국어 번역 초안 일부"), "Touch sheet must show real translation");
          await sheet.getByRole("button", { name: "닫기" }).click();
          await sheet.waitFor({ state: "hidden" });
          results.previews.push({ viewport: viewport.width, criterion, index, citation, touchSheet: true });
        } else {
          await link.hover();
          console.log("Hover case", viewport.width, criterion, index, citation, "pointer", await page.evaluate(() => ({ coarse: matchMedia("(pointer: coarse)").matches, none: matchMedia("(hover: none)").matches })));
          await page.waitForFunction(() => document.querySelectorAll('[role="tooltip"]').length === 1, { timeout: 15000 });
          const tooltip = page.getByRole("tooltip");
          await tooltip.waitFor({ state: "visible" });
          assert.equal(await tooltip.count(), 1, "Only the active reference should have a tooltip");
          const text = await tooltip.innerText();
          assert(text.includes(citation) && text.includes("한국어 번역 초안 일부"), "Hover must show the matching real translation");
          assert((await tooltip.locator("p").innerText()).trim().length > 35, "Hover must contain article text");
          const box = await tooltip.boundingBox();
          assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
            "Tooltip must stay inside the viewport: " + JSON.stringify(box));
          await page.keyboard.press("Escape");
          await tooltip.waitFor({ state: "hidden" });
          results.previews.push({ viewport: viewport.width, criterion, index, citation, withinViewport: true, escape: true });
        }
      }
      const destination = await links.first().getAttribute("href");
      assert(destination?.includes("#"), "Related-article links must contain a real anchor");
      if (viewport.width < 600) {
        await links.first().click();
        await page.getByRole("dialog").getByRole("link", { name: /전문에서 보기/ }).click();
      } else await links.first().click();
      const target = new URL(destination, base);
      await page.waitForURL((url) => url.pathname === target.pathname && url.hash === target.hash);
      await page.locator('[id="' + target.hash.slice(1) + '"]').waitFor({ state: "attached" });
      const search = page.getByRole("searchbox", { name: "조문 검색" });
      await search.fill("개인정보");
      await page.getByText(/^검색 결과 \d+개$/).waitFor({ state: "visible" });
    }
    await context.close();
  }
  console.log("Anonymous feedback, public routes, mobile navigation, touch sheets, desktop hovers and cross-device article search passed");
} catch (error) {
  results.error = error.message;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifactDir, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await writeFile(path.join(artifactDir, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();
}
