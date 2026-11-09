"""Read-only, robots-aware Firecrawl self-hosted probe for seven sources."""
import argparse
import json
import re
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
import sys
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from bs4 import BeautifulSoup
from protego import Protego

from scripts.collector.expansion import ROUTES, discover as discover_expansion
from scripts.collector.parsers import discover_rss
from scripts.collector.extraction import extract_document
from scripts.source_catalog import load_catalog

TARGETS = ("oecd", "eu-parliament", "ripd", "cn-cac", "hk-pcpd", "vn-gov", "eu-council")
USER_AGENT = "GlobalTrendResearch/0.1 (+https://github.com/parksunup/globaltrend)"
MIN_DELAY = 5
RELEVANCE = {
    "oecd": r"privacy|personal data|data protection|digital security",
    "eu-parliament": r"privacy|personal data|data protection",
    "ripd": r"privacidad|datos personales|protección de datos",
    "cn-cac": r"个人信息|数据安全|网络数据|个人隐私|个人信息保护",
    "hk-pcpd": r"PCPD|Privacy Commissioner|personal data|privacy",
    "vn-gov": r"privacy|personal data|personal information|data protection|cybersecurity|cyber security|decree 363",
    "eu-council": r"privacy|personal data|data protection|data breach|artificial intelligence|AI Act",
}


def discover_candidates(source, html, url):
    if source in ("eu-parliament", "ripd"):
        rows, _ = discover_rss(html, url, keep_feed_text=True)
    elif source == "oecd":
        soup = BeautifulSoup(html, "html.parser")
        rows = []
        for anchor in soup.select('main a[href*="/publications/"], main a[href*="/about/news/press-releases/"]'):
            href = urljoin(url, anchor.get("href", ""))
            title = " ".join(anchor.get_text(" ", strip=True).split())
            if urlsplit(href).hostname == "www.oecd.org" and title:
                rows.append({"url": href, "title": title})
    else:
        rows, _ = discover_expansion(source, html, url)
    pattern = re.compile(RELEVANCE[source], re.I)
    relevant = [row for row in rows if pattern.search(row.get("title", "") + " " + row.get("feed_text", ""))]
    return rows, relevant


class Firecrawl:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")
        self.robot_cache = {}
        self.last_request = {}
        self.delays = {}

    def _pace(self, host):
        delay = self.delays.get(host, MIN_DELAY)
        elapsed = time.monotonic() - self.last_request.get(host, 0)
        if elapsed < delay:
            time.sleep(delay - elapsed)

    def robots(self, host):
        if host in self.robot_cache:
            return self.robot_cache[host], self.delays[host]
        self._pace(host)
        request = urllib.request.Request("https://" + host + "/robots.txt", headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                body = response.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            if 400 <= exc.code < 500 and exc.code != 429:
                body = ""
            else:
                raise RuntimeError("robots_fetch_failed_http_" + str(exc.code)) from None
        self.last_request[host] = time.monotonic()
        policy = Protego.parse(body)
        delay = policy.crawl_delay("GlobalTrendResearch") or policy.crawl_delay("*") or 0
        delay = max(MIN_DELAY, float(delay))
        self.delays[host] = delay
        self.robot_cache[host] = policy
        return policy, delay

    def scrape(self, url, hosts):
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.hostname not in hosts:
            raise ValueError("url_outside_allowlisted_https_hosts")
        policy, delay = self.robots(parsed.hostname)
        if not policy.can_fetch(url, USER_AGENT):
            raise PermissionError("robots_disallowed")
        self._pace(parsed.hostname)
        payload = json.dumps({
            "url": url,
            "formats": ["rawHtml", "html", "markdown"],
            "onlyMainContent": False,
            "timeout": 45000,
            "proxy": "basic",
            "storeInCache": False,
            "headers": {"User-Agent": USER_AGENT},
        }).encode()
        request = urllib.request.Request(
            self.base_url + "/v2/scrape", data=payload,
            headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=75) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read(1000).decode("utf-8", "replace")
            self.last_request[parsed.hostname] = time.monotonic()
            raise RuntimeError("firecrawl_http_" + str(exc.code) + ":" + detail[:250]) from None
        self.last_request[parsed.hostname] = time.monotonic()
        data = result.get("data") or {}
        metadata = data.get("metadata") or {}
        final_url = metadata.get("url") or url
        final = urlsplit(final_url)
        if final.scheme != "https" or final.hostname not in hosts:
            raise ValueError("redirect_host_not_allowlisted")
        if not result.get("success"):
            raise RuntimeError("firecrawl_unsuccessful:" + str(result.get("error", "unknown"))[:200])
        return data, delay


def probe(source, crawler, source_by_id):
    source_config = source_by_id[source]
    listing_url = source_config["listing"]
    if source == "hk-pcpd":
        today = date.today()
        listing_url = f"https://www.info.gov.hk/gia/general/{today:%Y%m}/{today:%d}.htm"
    try:
        listing_data, delay = crawler.scrape(listing_url, set(source_config["hosts"]))
        listing_html = listing_data.get("rawHtml") or listing_data.get("html") or ""
        listing_body = listing_data.get("markdown") or ""
        rows, relevant = discover_candidates(source, listing_html, listing_url)
        sample_row = None
        for row in relevant[:1]:
            try:
                detail, detail_delay = crawler.scrape(row["url"], set(source_config["hosts"]))
                html = detail.get("rawHtml") or detail.get("html") or ""
                doc = extract_document(source, html.encode("utf-8"), row["url"], "text/html", row)
                body = (doc or {}).get("content_text") or detail.get("markdown") or ""
                sample_row = {
                    "url": row["url"], "title": row.get("title"),
                    "http_status": (detail.get("metadata") or {}).get("statusCode"),
                    "body_characters": len(body), "body_preview": body[:500],
                    "extractor": ((doc or {}).get("metadata") or {}).get("extraction_method", "firecrawl_markdown"),
                    "crawl_delay_seconds": detail_delay,
                }
                break
            except Exception as exc:
                # Keep discovery evidence even if the first detail candidate fails.
                detail_error = type(exc).__name__ + ": " + str(exc)[:240]
                sample_row = {"url": row.get("url"), "title": row.get("title"), "error": detail_error}
                break
        return {
            "source": source,
            "status": "listing_fetched" if relevant else "no_relevant_candidates",
            "listing_url": listing_url,
            "listing_http_status": (listing_data.get("metadata") or {}).get("statusCode"),
            "listing_characters": len(listing_body),
            "candidate_count": len(rows),
            "relevant_candidate_count": len(relevant),
            "sample": sample_row,
            "crawl_delay_seconds": delay,
        }
    except Exception as exc:
        return {"source": source, "status": "failed", "listing_url": listing_url,
                "error": type(exc).__name__ + ": " + str(exc)[:300]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:3002")
    parser.add_argument("--output", type=Path, default=ROOT / "work/firecrawl-seven-source-probe.json")
    args = parser.parse_args()
    sources = {row["id"]: row for row in load_catalog()["sources"]}
    crawler = Firecrawl(args.base_url)
    results = [probe(source, crawler, sources) for source in TARGETS]
    report = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "engine": "Firecrawl self-hosted OSS v2.11.0; /v2/scrape; proxy=basic; no cloud API, stealth, or proxy service",
        "database_writes": False,
        "policy": "robots checked before each URL; requests paced per host by max(robots crawl-delay, 5 seconds); HTTPS and catalog-host allowlist; at most one detail per source",
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
