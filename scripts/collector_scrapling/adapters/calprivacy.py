"""CalPrivacy press-release parser for the separate Scrapling collector."""
from __future__ import annotations

import hashlib
import re
from datetime import date
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup


SOURCE_ID = "calprivacy"
HOSTS = {"privacy.ca.gov"}
LISTING_URL = "https://privacy.ca.gov/category/content-types/news/press-release/"
ARTICLE_PATH = re.compile(r"^/\d{4}/\d{2}/[^?#]+/?$")
PRIVACY_TERMS = re.compile(r"privacy|personal\s+information|consumer\s+data", re.I)


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
    return urlunsplit(("https", parsed.netloc, parsed.path.rstrip("/") + "/", "", ""))


def parse_listing(source_id: str, html: str, listing_url: str) -> list[dict]:
    if source_id != SOURCE_ID:
        raise ValueError("calprivacy_adapter_source_mismatch")
    parsed = urlsplit(listing_url)
    if parsed.scheme != "https" or parsed.hostname != "privacy.ca.gov":
        raise ValueError("calprivacy_listing_host_unverified")
    soup = BeautifulSoup(html, "html.parser")
    found: dict[str, dict] = {}
    for card in soup.select("article.post"):
        title_node = card.select_one(".cat-info h2, .title")
        title = _text(title_node)
        if not title or not PRIVACY_TERMS.search(title):
            continue
        anchor = card.select_one(".thumbnail-link[href], .title[href], h2 a[href]")
        if not anchor:
            continue
        target = _canonical(anchor.get("href", ""), listing_url)
        if not target:
            continue
        row = {"url": target, "title": title}
        date_node = card.select_one(".post-meta .published, time[datetime]")
        if date_node:
            value = date_node.get("datetime") or _text(date_node)
            if value:
                row["date_observations"] = [{
                    "meaning": "listing_published_display",
                    "locator": "CalPrivacy press-release card date",
                    "value": value,
                }]
        found[target] = row

    return list(found.values())


def next_page_url(html: str, listing_url: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    anchor = soup.select_one("a.next, a.next.page-numbers, a[rel~='next']")
    if not anchor or not anchor.get("href"):
        return None
    target = urljoin(listing_url, anchor["href"])
    parsed = urlsplit(target)
    if parsed.scheme != "https" or parsed.hostname != "privacy.ca.gov":
        return None
    if not re.fullmatch(r"/category/content-types/news/press-release/(?:page/\d+/)?", parsed.path):
        return None
    return urlunsplit(("https", parsed.netloc, parsed.path, parsed.query, ""))


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
        raise ValueError("calprivacy_adapter_source_mismatch")
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != "privacy.ca.gov" or not ARTICLE_PATH.fullmatch(parsed.path):
        raise ValueError("calprivacy_detail_url_unverified")
    soup = BeautifulSoup(html, "html.parser")
    title = _text(soup.select_one("main h1, article h1, h1")) or row.get("title", "")
    body = _trafilatura_text(html, url)
    method = "trafilatura"
    if len(body) < 80:
        body_node = soup.select_one("main .et_pb_text_1 .et_pb_text_inner")
        if not body_node:
            body_node = soup.select_one("main article, main")
        body = _text(body_node)
        method = "calprivacy_source_body_fallback"
    if not title or len(body) < 10:
        raise ValueError("calprivacy_title_or_body_missing")

    date_node = soup.select_one('meta[property="article:published_time"]')
    raw_date = date_node.get("content", "").strip() if date_node else ""
    if not raw_date:
        visible = soup.select_one(".post-meta .published, time[datetime]")
        raw_date = (visible.get("datetime") or _text(visible)) if visible else ""
    published = raw_date[:10] if re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:T.*)?", raw_date) else None
    if published:
        try:
            date.fromisoformat(published)
        except ValueError:
            published = None

    metadata = {
        "parser_version": "scrapling-calprivacy-article-v1",
        "read_scope": "official_calprivacy_press_release_body",
        "requires_review": True,
        "ai_ready": False,
        "extraction_method": method,
        "date_observations": ([{
            "meaning": "official_published_attribute",
            "locator": "article:published_time or press-release date",
            "value": raw_date,
        }] if raw_date else []),
        "factual_status": "official_calprivacy_press_release_not_independently_reviewed",
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
