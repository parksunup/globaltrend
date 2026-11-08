"""Read-only cloud diagnostic for EDPS RSS, newsletter, and linked official detail."""
import asyncio
import html
import json
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from urllib.robotparser import RobotFileParser

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from scripts.collector.core import USER_AGENT


BASE = "https://www.edps.europa.eu"
ROBOTS_URL = f"{BASE}/robots.txt"
RSS_URL = f"{BASE}/feed/news_en"
ROUTES = [
    {
        "id": "newsletter_detail",
        "title": "EDPS Newsletter 123",
        "url": f"{BASE}/press-publications/publications/newsletters/newsletter-123_en",
        "markers": ["Newsletter (123)", "In this issue", "Cross-border health data"],
    },
    {
        "id": "newsletter_news_item",
        "title": "EDPS Newsletter 123 out now",
        "url": f"{BASE}/press-publications/press-news/news/2026/edps-newsletter-123-out-now",
        "markers": ["EDPS Newsletter 123 out now", "In this edition"],
    },
    {
        "id": "linked_formal_comments",
        "title": "EDPS Formal Comments on HealthData@EU",
        "url": f"{BASE}/data-protection/our-work/publications/formal-comments/2026-10-08-edps-commission-regulation-healthdataeu_en",
        "markers": ["HealthData@EU", "Formal Comments"],
    },
]


DIAGNOSTIC_HEADERS = (
    "server",
    "content-type",
    "via",
    "x-cache",
    "x-request-id",
    "x-amzn-requestid",
    "x-amz-cf-id",
    "x-azure-ref",
    "cf-ray",
    "retry-after",
)


def safe_headers(headers):
    return {
        name: str(value)[:160]
        for name in DIAGNOSTIC_HEADERS
        if (value := headers.get(name))
    }


def get_url(url, timeout=20):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read(2_000_000), safe_headers(response.headers), None
    except urllib.error.HTTPError as error:
        return error.code, error.read(2_000_000), safe_headers(error.headers), None
    except Exception as error:  # noqa: BLE001 - bounded diagnostic only
        return None, b"", {}, type(error).__name__


def robots_results():
    status, body, headers, error = get_url(ROBOTS_URL, timeout=20)
    if error:
        return {"status": "unreachable", "error": error}, {route["id"]: False for route in ROUTES}
    if status == 429:
        return {"status": status, "result": "rate_limited", "headers": headers}, {route["id"]: False for route in ROUTES}
    if status is not None and 400 <= status < 500:
        # RFC 9309 treats 4xx robots responses as unavailable, not as Disallow.
        return {"status": status, "result": "unavailable_4xx", "headers": headers}, {route["id"]: True for route in ROUTES}
    if status is None or status < 200 or status >= 300:
        return {"status": status, "result": "unavailable_server_error", "headers": headers}, {route["id"]: False for route in ROUTES}

    parser = RobotFileParser()
    parser.parse(body.decode("utf-8", "replace").splitlines())
    allowed = {}
    for route in ROUTES:
        allowed[route["id"]] = parser.can_fetch("GlobalTrendResearch", route["url"])
    return {"status": status, "result": "rules_loaded", "headers": headers}, allowed


def rss_item_summary():
    status, body, headers, error = get_url(RSS_URL, timeout=20)
    result = {"url": RSS_URL, "status": status, "headers": headers, "result": "unavailable"}
    if error:
        result["error"] = error
        return result
    if status != 200:
        result["body_excerpt"] = body.decode("utf-8", "replace").strip()[:240]
        return result
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        result["result"] = "invalid_xml"
        return result
    for item in root.findall("./channel/item"):
        if (item.findtext("title") or "").strip() != "EDPS Newsletter 123 out now":
            continue
        description = html.unescape(item.findtext("description") or "")
        soup = BeautifulSoup(description, "html.parser")
        summary = " ".join(soup.stripped_strings)
        linked_urls = [anchor.get("href") for anchor in soup.find_all("a", href=True)]
        return {
            "url": RSS_URL,
            "status": status,
            "result": "item_found",
            "item_title": "EDPS Newsletter 123 out now",
            "published": item.findtext("pubDate"),
            "summary_characters": len(summary),
            "summary_excerpt": summary[:500],
            "linked_urls": linked_urls,
        }
    result["result"] = "item_not_found"
    return result


async def probe_route(page, route, robots_allowed):
    result = {
        "id": route["id"],
        "title": route["title"],
        "url": route["url"],
        "robots_allowed": robots_allowed,
        "result": "not_run",
        "database_writes": False,
        "cookies_reused": False,
        "captcha_or_challenge_solved": False,
    }
    if not robots_allowed:
        result["result"] = "stopped_by_robots_or_rate_limit"
        return result

    statuses = []
    def record_document_response(response):
        if response.request.resource_type == "document":
            statuses.append(response.status)

    page.on("response", record_document_response)
    try:
        response = await page.goto(route["url"], wait_until="domcontentloaded", timeout=45_000)
        initial_status = response.status if response else None
        response_headers = safe_headers(response.headers) if response else {}
        deadline = time.monotonic() + 20
        body_text = ""
        title = ""
        page_html = ""
        while time.monotonic() < deadline:
            try:
                title = await page.title()
                body_text = await page.locator("body").inner_text(timeout=2_000)
                page_html = await page.content()
            except Exception:  # page may reload while the origin checks the request
                await page.wait_for_timeout(750)
                continue
            if any(marker in body_text for marker in route["markers"]):
                break
            if initial_status in {403, 429} and len(body_text) < 500:
                break
            await page.wait_for_timeout(750)

        lower_html = page_html.lower()
        waf_markers = any(marker in lower_html for marker in ("challenge.js", "awswaf", "challenge-container"))
        markers = {marker: marker in body_text for marker in route["markers"]}
        if initial_status == 429:
            classification = "rate_limited_429"
        elif initial_status == 403 and waf_markers:
            classification = "waf_challenge_403"
        elif initial_status == 403:
            classification = "forbidden_403"
        elif initial_status == 202 and waf_markers:
            classification = "waf_challenge_202"
        elif all(markers.values()):
            classification = "official_detail_rendered"
        elif initial_status and 200 <= initial_status < 300:
            classification = "http_success_expected_content_missing"
        else:
            classification = "http_error_or_navigation_failure"

        result.update(
            initial_http_status=initial_status,
            response_headers=response_headers,
            final_http_status=statuses[-1] if statuses else None,
            document_response_statuses=statuses,
            rendered_title=title,
            rendered_body_characters=len(body_text),
            response_body_excerpt=body_text.strip()[:240] if initial_status in {403, 429} else None,
            expected_sections=markers,
            challenge_interstitial_present=waf_markers,
            result=classification,
        )
    except Exception as error:  # noqa: BLE001 - bounded diagnostic only
        result.update(result="navigation_error", error_type=type(error).__name__)
    finally:
        page.remove_listener("response", record_document_response)
    return result


async def run_probe():
    robots, allowed = robots_results()
    rss = rss_item_summary()
    result = {
        "source": "edps",
        "purpose": "read_only_route_diagnostic",
        "robots": robots,
        "rss": rss,
        "routes": [],
        "database_writes": False,
    }
    if not any(allowed.values()):
        result["result"] = "stopped_by_robots_or_rate_limit"
        return result

    delay = robots.get("crawl_delay_seconds", 0)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            for route in ROUTES:
                await asyncio.sleep(max(2.0, float(delay or 0)))
                result["routes"].append(await probe_route(page, route, allowed[route["id"]]))
        finally:
            await browser.close()

    primary = next(route for route in result["routes"] if route["id"] == "newsletter_detail")
    alternatives = [route for route in result["routes"] if route["id"] != "newsletter_detail"]
    if primary["result"] == "official_detail_rendered":
        result["result"] = "newsletter_detail_rendered"
    elif any(route["result"] == "official_detail_rendered" for route in alternatives):
        result["result"] = "newsletter_blocked_but_linked_official_detail_available"
    else:
        result["result"] = "cloud_cannot_fetch_edps_detail"
    return result


def main():
    result = asyncio.run(run_probe())
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    if result["result"] == "cloud_cannot_fetch_edps_detail":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
