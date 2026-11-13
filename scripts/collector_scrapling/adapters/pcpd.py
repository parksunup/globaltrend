"""PCPD publication discovery through Hong Kong ISD's official date archive.

Scrapling is used by the shared transport only. This module parses the returned
HTML and never uses browser, stealth, proxy, or CAPTCHA features.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import re
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

HOST = "www.info.gov.hk"
ARCHIVE_RE = re.compile(r"^/gia/general/(\d{6})/(\d{2})\.htm$")
ARTICLE_RE = re.compile(r"^/gia/general/\d{6}/\d{2}/P\d+\.htm$")
PCPD_TERMS = re.compile(r"\b(?:PCPD|Privacy Commissioner|personal data|privacy)\b", re.I)
BASE = f"https://{HOST}/gia/general"


def listing_urls(start_date: str, end_date: str) -> list[str]:
    """Return every official daily archive in the inclusive interval, newest first."""
    start = dt.date.fromisoformat(start_date)
    end = dt.date.fromisoformat(end_date)
    if start > end:
        raise ValueError("pcpd_invalid_date_window")
    days = (end - start).days
    return [f"{BASE}/{day:%Y%m}/{day:%d}.htm" for day in (end - dt.timedelta(days=n) for n in range(days + 1))]


def next_page_url(html: str, url: str, since: str | None = None) -> str | None:
    """Give the shared runner the previous archive day when no fixed URL list is used."""
    del html
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != HOST:
        raise ValueError("pcpd_archive_host_invalid")
    match = ARCHIVE_RE.fullmatch(parsed.path)
    if not match:
        raise ValueError("pcpd_archive_url_unverified")
    current = dt.date(int(match.group(1)[:4]), int(match.group(1)[4:]), int(match.group(2)))
    previous = current - dt.timedelta(days=1)
    if since is not None and previous < dt.date.fromisoformat(since):
        return None
    return f"{BASE}/{previous:%Y%m}/{previous:%d}.htm"


def parse_listing(source_id: str, html: str, listing_url: str) -> list[dict]:
    if source_id != "hk-pcpd":
        raise ValueError("pcpd_source_id_mismatch")
    parsed = urlsplit(listing_url)
    if parsed.scheme != "https" or parsed.hostname != HOST:
        raise ValueError("pcpd_archive_host_invalid")
    archive = ARCHIVE_RE.fullmatch(parsed.path)
    if not archive:
        raise ValueError("pcpd_archive_url_unverified")
    archive_date = dt.date(int(archive.group(1)[:4]), int(archive.group(1)[4:]), int(archive.group(2)))
    soup = BeautifulSoup(html, "html.parser")
    rows: dict[str, dict] = {}
    for anchor in soup.select('li > a[href*="/gia/general/"]'):
        title = " ".join(anchor.get_text(" ", strip=True).split())
        target = urljoin(listing_url, anchor.get("href", ""))
        target_parts = urlsplit(target)
        if target_parts.scheme != "https" or target_parts.hostname != HOST or not ARTICLE_RE.fullmatch(target_parts.path):
            continue
        if not title or not PCPD_TERMS.search(title):
            continue
        rows[target] = {
            "url": target,
            "title": title,
            "source_attribution": "Office of the Privacy Commissioner for Personal Data, Hong Kong",
            "date_observations": [{
                "meaning": "listing_archive_day",
                "locator": "Hong Kong ISD official daily archive URL",
                "value": archive_date.isoformat(),
            }],
        }
    return list(rows.values())


def parse_detail(source_id: str, html: str, url: str, row: dict) -> dict:
    if source_id != "hk-pcpd":
        raise ValueError("pcpd_source_id_mismatch")
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != HOST or not ARTICLE_RE.fullmatch(parsed.path):
        raise ValueError("pcpd_detail_url_unverified")
    soup = BeautifulSoup(html, "html.parser")
    title_node = soup.select_one("main h1, article h1, h1")
    title = " ".join((title_node.get_text(" ", strip=True) if title_node else row.get("title", "")).split())
    if not title:
        raise ValueError("pcpd_detail_title_missing")
    try:
        import trafilatura
        extracted = trafilatura.extract(
            html, url=url, output_format="txt", include_comments=False,
            include_tables=True, include_formatting=True, favor_precision=True,
        )
    except Exception:
        extracted = None
    body = " ".join((extracted or "").split())
    if not body:
        node = soup.select_one("main, article, #content, .content, .news-content")
        if node:
            for junk in node.select("script, style, nav, footer, .related-content, .share-tools"):
                junk.decompose()
            body = " ".join(node.get_text(" ", strip=True).split())
    if not body:
        raise ValueError("pcpd_detail_body_missing")
    observations = list(row.get("date_observations", []))
    for selector, meaning, locator in (
        ('meta[property="article:published_time"]', "detail_published_attribute", 'meta[property="article:published_time"]@content'),
        ("time[datetime]", "detail_published_attribute", "time@datetime"),
    ):
        node = soup.select_one(selector)
        value = node.get("content") or node.get("datetime") if node else None
        if value:
            observations.append({"meaning": meaning, "locator": locator, "value": value.strip()})
    return {
        "title_original": title,
        "content_text": body,
        "content_hash": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        "published_date": row.get("date_observations", [{}])[0].get("value"),
        "metadata": {
            "parser_version": "scrapling-pcpd-official-isd-v1",
            "read_scope": "official_isd_republication_body",
            "source_attribution": "Office of the Privacy Commissioner for Personal Data, Hong Kong",
            "date_observations": observations,
            "requires_review": True,
            "ai_ready": False,
            "extraction_method": "trafilatura" if extracted else "source_selector_fallback",
            "related_documents": [],
            "unread_attachments": [],
        },
    }
