"""Read-only cloud probe for one official EDPS article using ordinary Chromium."""
import asyncio
import json
import time
import urllib.error
import urllib.request
from urllib.robotparser import RobotFileParser

from playwright.async_api import async_playwright

from scripts.collector.core import USER_AGENT


ROBOTS_URL = "https://www.edps.europa.eu/robots.txt"
ARTICLE_URL = (
    "https://www.edps.europa.eu/press-publications/publications/"
    "newsletters/newsletter-123_en"
)
MARKERS = ("Newsletter (123)", "In this issue", "Cross-border health data")


def robots_result():
    request = urllib.request.Request(ROBOTS_URL, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status = response.status
            body = response.read(256_000)
    except urllib.error.HTTPError as error:
        status = error.code
        body = b""
    except Exception as error:  # noqa: BLE001 - bounded diagnostic only
        return {"status": "unreachable", "error": type(error).__name__}, False

    if status == 429:
        return {"status": status, "result": "rate_limited"}, False
    if 400 <= status < 500:
        # RFC 9309 treats 4xx robots responses as unavailable, not as Disallow.
        return {"status": status, "result": "unavailable_4xx"}, True
    if status < 200 or status >= 300:
        return {"status": status, "result": "unavailable_server_error"}, False

    parser = RobotFileParser()
    parser.parse(body.decode("utf-8", "replace").splitlines())
    allowed = parser.can_fetch("GlobalTrendResearch", ARTICLE_URL)
    return {
        "status": status,
        "result": "allowed" if allowed else "disallowed",
        "crawl_delay_seconds": parser.crawl_delay("GlobalTrendResearch")
        or parser.crawl_delay("*"),
    }, allowed


async def run_probe():
    robots, proceed = robots_result()
    result = {
        "source": "edps",
        "sample_title": "EDPS Newsletter 123 out now",
        "article_url": ARTICLE_URL,
        "robots": robots,
        "database_writes": False,
        "cookies_reused": False,
        "captcha_or_challenge_solved": False,
        "result": "not_run",
    }
    if not proceed:
        result["result"] = "stopped_by_robots_or_rate_limit"
        return result

    delay = robots.get("crawl_delay_seconds")
    await asyncio.sleep(max(2.0, float(delay or 0)))
    document_responses = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page()
        page.on(
            "response",
            lambda response: document_responses.append(response.status)
            if response.request.resource_type == "document"
            else None,
        )
        started = time.monotonic()
        try:
            initial = await page.goto(
                ARTICLE_URL, wait_until="domcontentloaded", timeout=45_000
            )
            result["initial_http_status"] = initial.status if initial else None
            deadline = time.monotonic() + 30
            body_text = ""
            page_title = ""
            page_html = ""
            while time.monotonic() < deadline:
                try:
                    page_title = await page.title()
                    body_text = await page.locator("body").inner_text(timeout=2_000)
                    page_html = await page.content()
                except Exception:  # page may reload after the site's JS check
                    await page.wait_for_timeout(1_000)
                    continue
                if all(marker in body_text for marker in MARKERS):
                    break
                if "403 Forbidden" in body_text and len(body_text) < 100:
                    break
                await page.wait_for_timeout(1_000)

            result.update(
                final_http_status=document_responses[-1] if document_responses else None,
                document_response_statuses=document_responses,
                rendered_title=page_title,
                rendered_body_characters=len(body_text),
                expected_sections={marker: marker in body_text for marker in MARKERS},
                challenge_interstitial_present=(
                    "challenge.js" in page_html.lower()
                    or "awswaf" in page_html.lower()
                    or "challenge-container" in page_html.lower()
                ),
                elapsed_seconds=round(time.monotonic() - started, 2),
            )
            result["result"] = (
                "article_rendered"
                if all(marker in body_text for marker in MARKERS)
                else "challenge_or_article_unavailable"
            )
        except Exception as error:  # noqa: BLE001 - bounded diagnostic only
            result.update(result="navigation_error", error_type=type(error).__name__)
        finally:
            await browser.close()
    return result


def main():
    result = asyncio.run(run_probe())
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    if result["result"] != "article_rendered":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
