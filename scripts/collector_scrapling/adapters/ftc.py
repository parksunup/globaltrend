"""FTC press-release parser for the separate Scrapling collector.

Scrapling itself is used unmodified by the transport layer. This module only
parses official FTC HTML and deliberately omits the robots-disallowed
``items_per_page`` query parameter from the official listing URL.
"""
from __future__ import annotations

import hashlib
import re
from datetime import date
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup


SOURCE_ID = "ftc"
HOSTS = {"search.ftc.gov", "www.ftc.gov"}
LISTING_URL = (
    "https://search.ftc.gov/news-events/news/press-releases?"
    "search=privacy&field_mission%5B29%5D=29"
)
ARTICLE_PATH = re.compile(r"^/news-events/news/press-releases/[^?#]+$")
PRIVACY_TERMS = re.compile(
    r"privacy|personal\s+(?:data|information)|data\s+protection|"
    r"data\s+breach|identity\s+theft",
    re.I,
)


def _text(node) -> str:
    return " ".join(node.get_text(" ", strip=True).split()) if node else ""


def _canonical(href: str, base_url: str) -> str | None:
    target = urljoin(base_url, href or "")
    parsed = urlsplit(target)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in HOSTS
        or parsed.username
        or parsed.password
        or not ARTICLE_PATH.fullmatch(parsed.path)
    ):
        return None
    return urlunsplit(("https", parsed.netloc, parsed.path, "", ""))


def parse_listing(source_id: str, html: str, listing_url: str) -> list[dict]:
    if source_id != SOURCE_ID:
        raise ValueError("ftc_adapter_source_mismatch")
    parsed_listing = urlsplit(listing_url)
    if parsed_listing.scheme != "https" or parsed_listing.hostname != "search.ftc.gov":
        raise ValueError("ftc_listing_host_unverified")
    query = parse_qs(parsed_listing.query, keep_blank_values=True)
    if "items_per_page" in query:
        raise ValueError("ftc_robots_disallowed_page_size_parameter")

    soup = BeautifulSoup(html, "html.parser")
    found: dict[str, dict] = {}
    for anchor in soup.select('main a[href*="/news-events/news/press-releases/"]'):
        card = anchor.find_parent("article")
        title = _text(anchor)
        if not title and card:
            title = _text(card.select_one("h2, h3"))
        if not title or not PRIVACY_TERMS.search(title):
            continue
        target = _canonical(anchor.get("href", ""), listing_url)
        if not target:
            continue
        row = {"url": target, "title": title}
        time_node = card.select_one("time[datetime]") if card else None
        if time_node:
            raw_date = time_node.get("datetime", "").strip()
            row["date_observations"] = [{
                "meaning": "expansion_listing_published",
                "locator": "FTC search result time[datetime]",
                "value": raw_date,
            }]
        found[target] = row

    return list(found.values())


def next_page_url(html: str, listing_url: str) -> str | None:
    """Return a verified same-host next URL retaining FTC's topic filters."""
    parsed_listing = urlsplit(listing_url)
    query = parse_qs(parsed_listing.query, keep_blank_values=True)
    filter_key = "field_mission[29]"
    if (parsed_listing.scheme != "https" or parsed_listing.hostname != "search.ftc.gov"
            or "items_per_page" in query or query.get("search") != ["privacy"]
            or query.get(filter_key) != ["29"]):
        raise ValueError("ftc_listing_query_unverified")
    soup = BeautifulSoup(html, "html.parser")
    anchor = soup.select_one("a[rel~='next'], .pager__item--next a[href]")
    if not anchor or not anchor.get("href"):
        return None
    target = urljoin(listing_url, anchor["href"])
    parts = urlsplit(target)
    next_query = parse_qs(parts.query, keep_blank_values=True)
    if (parts.scheme != "https" or parts.hostname != "search.ftc.gov"
            or "items_per_page" in next_query
            or next_query.get("search") != ["privacy"]
            or next_query.get(filter_key) != ["29"]):
        return None
    return urlunsplit(("https", parts.netloc, parts.path, urlencode(next_query, doseq=True), ""))


def _trafilatura_text(html: str, url: str) -> str:
    try:
        import trafilatura
        extracted = trafilatura.extract(
            html, url=url, output_format="txt", include_comments=False,
            include_tables=True, include_formatting=True, favor_precision=True,
        )
    except Exception:
        return ""
    return " ".join(extracted.split()) if extracted else ""


def parse_detail(source_id: str, html: str, url: str, row: dict) -> dict:
    if source_id != SOURCE_ID:
        raise ValueError("ftc_adapter_source_mismatch")
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in HOSTS or not ARTICLE_PATH.fullmatch(parsed.path):
        raise ValueError("ftc_detail_url_unverified")
    soup = BeautifulSoup(html, "html.parser")
    title = _text(soup.select_one("main h1, article h1, h1")) or _text(None) or row.get("title", "")
    body = _trafilatura_text(html, url)
    method = "trafilatura"
    if len(body) < 80:
        body_node = soup.select_one("main article .field--name-body") or soup.select_one("main article")
        body = _text(body_node)
        method = "ftc_source_body_fallback"
    if not title or len(body) < 10:
        raise ValueError("ftc_title_or_body_missing")

    observations = list(row.get("date_observations", []))
    date_node = soup.select_one("main article time[datetime], article time[datetime], time[datetime]")
    raw_date = date_node.get("datetime", "").strip() if date_node else ""
    detail_date = raw_date[:10] if re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:T.*)?", raw_date) else None
    if detail_date:
        try:
            date.fromisoformat(detail_date)
        except ValueError:
            detail_date = None
    if raw_date:
        observations.append({
            "meaning": "published_attribute",
            "locator": "FTC article time[datetime]",
            "value": raw_date,
        })

    route_month = re.search(r"/(\d{4})/(\d{2})/[^/]+$", parsed.path)
    route_month_value = f"{route_month[1]}-{route_month[2]}" if route_month else None
    if route_month_value:
        observations.append({
            "meaning": "route_month_candidate_not_full_date",
            "locator": "FTC press-release URL path",
            "value": route_month_value,
        })
    exact_listing_dates = set()
    for observation in row.get("date_observations", []):
        value = str(observation.get("value", ""))
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:T.*)?", value):
            try:
                exact_listing_dates.add(date.fromisoformat(value[:10]).isoformat())
            except ValueError:
                pass
    date_conflict = len(exact_listing_dates) > 1
    if detail_date and exact_listing_dates and detail_date not in exact_listing_dates:
        date_conflict = True
    if detail_date and route_month_value and not detail_date.startswith(route_month_value):
        date_conflict = True
    published = detail_date if detail_date and not date_conflict else None
    metadata = {
        "parser_version": "scrapling-ftc-article-v1",
        "read_scope": "official_ftc_press_release_body",
        "requires_review": True,
        "ai_ready": False,
        "extraction_method": method,
        "date_observations": observations,
        "date_conflict": date_conflict,
        "factual_status": "official_ftc_press_release_not_independently_reviewed",
        "body_review_status": "machine_extracted_not_human_reviewed",
        "related_documents": [],
        "unread_attachments": [],
    }
    return {
        "title_original": title,
        "content_text": body,
        "content_hash": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        "published_date": published,
        "metadata": metadata,
    }
