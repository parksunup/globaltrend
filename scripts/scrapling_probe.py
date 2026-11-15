"""Read-only Scrapling Fetcher probe for the eight currently failing sources.

Uses Scrapling's unmodified HTTP Fetcher API. It checks robots.txt before each
page request, observes crawl-delay with a five-second minimum, and never uses
stealth, proxies, CAPTCHA handling, or browser fingerprint options.
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from bs4 import BeautifulSoup

from protego import Protego
from scrapling.fetchers import Fetcher

from scripts.source_catalog import load_catalog

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {"oecd", "ftc", "calprivacy", "hk-pcpd", "eu-parliament", "cn-cac", "ripd", "vn-gov"}
USER_AGENT = "GlobalTrendResearch/0.1 (+https://github.com/parksunup/globaltrend)"
MIN_DELAY = 5


def robots_policy(host):
    request = urllib.request.Request("https://" + host + "/robots.txt", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        if 400 <= exc.code < 500 and exc.code != 429:
            body = ""
        else:
            raise RuntimeError("robots_fetch_failed_http_" + str(exc.code)) from None
    policy = Protego.parse(body)
    delay = policy.crawl_delay("GlobalTrendResearch") or policy.crawl_delay("*") or 0
    return policy, max(MIN_DELAY, float(delay))


def extract_text(page):
    # Keep extraction deliberately transparent: use Scrapling's DOM parser and
    # common article containers, then fall back to body text for diagnostics.
    for selector in ("article", "main", "[role=main]", "body"):
        node = page.css(selector)
        if node:
            text = "\n".join(part.strip() for part in node[0].get_all_text().splitlines() if part.strip())
            if text:
                return text
    return ""


def candidate_rows(source_id, html, listing_url):
    """Use the existing institution adapter where one is configured."""
    from scripts.collector.expansion import ROUTES, discover
    from scripts.collector.parsers import discover_rss
    route = ROUTES.get(source_id, {})
    if source_id in ("eu-parliament", "ripd"):
        rows, _ = discover_rss(html, listing_url, keep_feed_text=True)
        return rows
    if source_id == "hk-pcpd":
        return discover(source_id, html, listing_url)[0]
    if source_id == "vn-gov":
        return discover(source_id, html, listing_url)[0]
    soup = BeautifulSoup(html, "html.parser")
    selector = route.get("links")
    anchors = soup.select(selector) if selector else []
    if not anchors:
        anchors = soup.select("article a[href], main a[href]")
    import re
    host = route.get("host")
    pattern = re.compile(route.get("article_path", r"$^"))
    if source_id == "oecd":
        host = "www.oecd.org"
        pattern = re.compile(r"/en/(?:topics|news|about)/[^?#]+")
    rows = []
    for anchor in anchors:
        href = anchor.get("href", "")
        from urllib.parse import urljoin
        target = urljoin(listing_url, href)
        parsed = urlsplit(target)
        title = " ".join(anchor.get_text(" ", strip=True).split())
        if parsed.scheme != "https" or parsed.hostname != host or not pattern.fullmatch(parsed.path) or not title:
            continue
        if source_id == "ftc" and not re.search(
                r"privacy|personal (?:data|information)|data protection|data breach|identity theft",
                title, re.I):
            continue
        rows.append({"url": target, "title": title})
    return rows


PRIVACY_TITLE_TERMS = {
    "oecd": r"privacy|personal data|data protection|digital security",
    "ftc": r"privacy|personal (?:data|information)|data protection|data breach|identity theft",
    "calprivacy": r"privacy|personal information|consumer data",
    "hk-pcpd": r"PCPD|Privacy Commissioner|personal data|privacy",
    "eu-parliament": r"privacy|personal data|data protection",
    "cn-cac": r"个人信息|数据安全|网络数据|个人隐私|个人信息保护",
    "ripd": r"privacidad|datos personales|protección de datos",
    "vn-gov": r"privacy|personal data|personal information|data protection|cybersecurity|cyber security|Decree 363",
}


def relevant_rows(source_id, rows):
    matcher = re.compile(PRIVACY_TITLE_TERMS[source_id], re.I)
    return [row for row in rows if matcher.search(row.get("title", ""))]


def _fetch(url, hosts):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in hosts or parsed.username or parsed.password:
        raise ValueError("url_outside_allowlisted_https_hosts")
    policy, delay = robots_policy(parsed.hostname)
    if not policy.can_fetch(url, USER_AGENT):
        raise PermissionError("robots_disallowed")
    time.sleep(delay)
    response = Fetcher.get(url, timeout=30, headers={"User-Agent": USER_AGENT},
                           stealthy_headers=False)
    final = urlsplit(response.url)
    if final.scheme != "https" or final.hostname not in hosts:
        raise ValueError("redirect_host_not_allowlisted")
    if response.status in (401, 403, 429):
        raise PermissionError("http_" + str(response.status))
    if response.status >= 400:
        raise RuntimeError("http_" + str(response.status))
    return response, delay


def probe_source(source):
    # FTC's search subdomain route adds items_per_page, which robots prohibits.
    # Keep the official FTC privacy filter, remove its disallowed page-size
    # parameter, and verify the selected host/path against that host's robots.
    listing = ("https://search.ftc.gov/news-events/news/press-releases?search=privacy&field_mission%5B29%5D=29"
               if source["id"] == "ftc" else source["listing"])
    if source["id"] == "hk-pcpd":
        listing = "https://www.info.gov.hk/gia/general/202611/09.htm"
    parsed = urlsplit(listing)
    hosts = set(source["hosts"])
    if parsed.scheme != "https" or parsed.hostname not in hosts:
        return {"source": source["id"], "status": "held", "error": "listing_host_not_allowlisted"}
    delay = MIN_DELAY
    try:
        response, delay = _fetch(listing, hosts)
        status = response.status
        final_url = response.url
        final = urlsplit(final_url)
        if status in (401, 403, 429):
            return {"source": source["id"], "status": "access_denied", "http_status": status,
                    "stage": "listing", "requests": 1, "crawl_delay_seconds": delay}
        if final.scheme != "https" or final.hostname not in hosts:
            return {"source": source["id"], "status": "held", "error": "redirect_host_not_allowlisted",
                    "requests": 1, "http_status": status}
        if status >= 400:
            return {"source": source["id"], "status": "failed", "error": "http_" + str(status),
                    "requests": 1, "crawl_delay_seconds": delay}
        text = extract_text(response)
        try:
            rows = candidate_rows(source["id"], response.html_content, final_url)
        except Exception as exc:
            rows = []
            listing_parse_error = type(exc).__name__ + ": " + str(exc)[:160]
        else:
            listing_parse_error = None
        sample = None
        detail_error = None
        relevant = relevant_rows(source["id"], rows)
        for row in relevant[:1]:
            try:
                detail, _ = _fetch(row["url"], hosts)
                from scripts.collector.parsers import extract_document
                parsed_document = extract_document(source["id"], detail.html_content.encode("utf-8"),
                                                   detail.url, "text/html", row)
                body = (parsed_document or {}).get("content_text") or extract_text(detail)
                sample = {"url": row["url"], "title": row.get("title"),
                          "body_characters": len(body), "body_preview": body[:500],
                          "extractor": (parsed_document or {}).get("metadata", {}).get("extraction_method", "scrapling_dom"),
                          "http_status": detail.status, "final_url": detail.url}
            except Exception as exc:
                detail_error = type(exc).__name__ + ": " + str(exc)[:160]
            break
        result_status = "listing_fetched" if relevant else "no_relevant_candidates"
        return {"source": source["id"], "status": result_status, "http_status": status,
                "final_url": final_url, "characters": len(text), "preview": text[:500],
                "candidate_count": len(rows), "relevant_candidate_count": len(relevant),
                "listing_parse_error": listing_parse_error, "sample": sample,
                "detail_error": detail_error,
                "crawl_delay_seconds": delay, "requests": 1 + int(sample is not None or detail_error is not None),
                "note": "one detail sample at most; each URL independently checked against robots and host policy"}
    except Exception as exc:
        message = re.sub(r"https?://\S+", "[url]", str(exc))[:300]
        status = "access_denied" if str(exc).startswith("http_") and str(exc) in ("http_401", "http_403", "http_429") else "failed"
        status = "robots_disallowed" if str(exc) == "robots_disallowed" else status
        return {"source": source["id"], "status": status, "stage": "listing", "error": type(exc).__name__ + ": " + message,
                "requests": 1, "crawl_delay_seconds": delay}


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="all", help="one of the eight source IDs, or all")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    catalog = load_catalog()
    by_id = {row["id"]: row for row in catalog["sources"]}
    selected = sorted(TARGETS) if args.source == "all" else [args.source]
    unknown = set(selected) - TARGETS
    if unknown:
        parser.error("source must be one of the eight diagnostic targets: " + ", ".join(sorted(TARGETS)))
    results = [probe_source(by_id[source]) for source in selected]
    report = {"run_at": datetime.now(timezone.utc).isoformat(), "method": "Scrapling Fetcher HTTP only",
              "database_writes": False,
              "detail_pages_requested": any(item.get("requests", 0) > 1 for item in results),
              "policy": "robots checked before listing; per-host delay >=5s; no stealth/proxy/captcha",
              "results": results}
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 1 if any(item["status"] in ("failed", "access_denied", "robots_disallowed") for item in report["results"]) else 0


if __name__ == "__main__":
    sys.exit(main())
