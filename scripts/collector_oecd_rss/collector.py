"""New OECD collector built only around OECD's official WebCMS RSS routes.

This module intentionally does not import the legacy PR #42 topic-page parser
or the previous OECD adapter. It uses Scrapling's ordinary Fetcher through the
shared robots-aware, rate-limited transport. RSS excerpts remain labelled as
excerpts when the linked official page cannot be read.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from html import unescape
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup
from trafilatura import extract

from scripts.collector_scrapling.transport import FetchFailure, SafeScraplingClient


RSS_FEEDS = (
    "https://api.oecd.org/webcms/search/rss?siteName=oecd&interfaceLanguage=en&path=%2Fcontent%2Foecd%2Fen%2Ftopics%2Fprivacy-and-data-protection&facets=oecd-languages%3Aen",
    "https://api.oecd.org/webcms/search/rss?siteName=oecd&interfaceLanguage=en&path=%2Fcontent%2Foecd%2Fen%2Fpublications&facets=oecd-languages%3Aen",
)
ALLOWED_HOSTS = {"api.oecd.org", "www.oecd.org", "www.oecd-ilibrary.org"}
MAX_ITEM_CHARS = 80_000
MAX_PDF_BYTES = 5_000_000
PRIVACY_TERMS = re.compile(
    r"\bprivacy\b|personal data|data protection|data privacy|digital security|"
    r"protection des données|vie privée|données personnelles|privacidad|"
    r"datos personales|protección de datos",
    re.I,
)


def _text(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return " ".join("".join(node.itertext()).split())


def _clean_html(value: str) -> str:
    return " ".join(BeautifulSoup(unescape(value), "html.parser").get_text(" ", strip=True).split())


def _date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        return parsed.date().isoformat()
    except (TypeError, ValueError, OverflowError):
        pass
    candidate = value.strip()[:10]
    try:
        return dt.date.fromisoformat(candidate).isoformat()
    except ValueError:
        return None


def parse_feed(payload: bytes, feed_url: str) -> list[dict]:
    """Read one exact official RSS endpoint without following untrusted XML."""
    if feed_url not in RSS_FEEDS:
        raise ValueError("oecd_rss_route_not_in_allowlist")
    raw = payload.decode("utf-8", "replace")
    if re.search(r"<!DOCTYPE|<!ENTITY", raw, re.I):
        raise ValueError("oecd_rss_xml_entities_rejected")
    try:
        root = ET.fromstring(raw.lstrip("\ufeff \t\r\n"))
    except ET.ParseError as error:
        raise ValueError("oecd_rss_xml_invalid") from error
    rows: dict[str, dict] = {}
    for entry in root.iter():
        if entry.tag.rsplit("}", 1)[-1].casefold() not in {"item", "entry"}:
            continue
        fields = {child.tag.rsplit("}", 1)[-1].casefold(): child for child in entry}
        title = _text(fields.get("title"))
        link_node = fields.get("link")
        target = (link_node.attrib.get("href") if link_node is not None else "") or _text(link_node)
        target = urljoin(feed_url, target)
        parsed = urlsplit(target)
        if (not title or parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS
                or parsed.username or parsed.password):
            continue
        summary_node = next((fields.get(key) for key in ("encoded", "description", "summary", "content")
                             if fields.get(key) is not None), None)
        summary = _clean_html(_text(summary_node))
        # The first API is the official privacy topic feed. The publication
        # feed is broader, so only keep its explicit privacy-related entries.
        is_topic_feed = "privacy-and-data-protection" in feed_url
        if not is_topic_feed and not PRIVACY_TERMS.search(title + " " + summary):
            continue
        date_node = next((fields.get(key) for key in ("pubdate", "date", "published", "updated")
                          if fields.get(key) is not None), None)
        raw_date = _text(date_node)
        published = _date(raw_date)
        observations = ([{"meaning": "official_rss_published", "locator": "OECD WebCMS RSS date", "value": raw_date}]
                       if raw_date else [])
        row = {
            "url": target,
            "title": title,
            "feed_text": summary,
            "published_date": published,
            "feed_date_raw": raw_date or None,
            "date_observations": observations,
            "source_feed_url": feed_url,
        }
        prior = rows.get(target)
        if prior is None or len(summary) > len(prior["feed_text"]):
            rows[target] = row
    return list(rows.values())


def _article_path_allowed(url: str) -> bool:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in {"www.oecd.org", "www.oecd-ilibrary.org"}:
        return False
    return (parsed.path.startswith("/en/publications/") or
            parsed.path.startswith("/en/about/news/press-releases/"))


def _item_from_detail(html: bytes, final_url: str, row: dict) -> dict | None:
    markup = html.decode("utf-8", "replace")
    body = extract(markup, url=final_url, output_format="txt", include_comments=False,
                   include_tables=True, favor_precision=True)
    if not body:
        return None
    body = "\n".join(line.strip() for line in body.splitlines() if line.strip())
    if len(body.strip()) < 80:
        return None
    body_truncated = len(body) > MAX_ITEM_CHARS
    body = body[:MAX_ITEM_CHARS]
    soup = BeautifulSoup(markup, "html.parser")
    heading = soup.select_one("main h1, article h1, h1")
    title = " ".join(heading.get_text(" ", strip=True).split()) if heading else row["title"]
    dates = list(row.get("date_observations", []))
    for node in soup.select("time[datetime], meta[property='article:published_time'], meta[name='date']"):
        value = node.get("datetime") or node.get("content")
        if value:
            dates.append({"meaning": "official_detail_date", "locator": node.name + " date attribute", "value": value})
    parsed_dates = {_date(str(x.get("value") or "")) for x in dates}
    parsed_dates.discard(None)
    conflict = len(parsed_dates) > 1
    published = next(iter(parsed_dates)) if len(parsed_dates) == 1 else row.get("published_date")
    return {
        "url": final_url,
        "title_original": title or row["title"],
        "content_text": body,
        "content_hash": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        "published_date": None if conflict else published,
        "metadata": {
            "parser_version": "oecd-webcms-rss-detail-v2",
            "read_scope": "official_article_main_text",
            "source_feed_url": row["source_feed_url"],
            "date_observations": dates,
            "date_conflict": conflict,
            "requires_review": True,
            "ai_ready": False,
            "body_truncated": body_truncated,
            "factual_status": "official_detail_extracted_via_webcms_rss_discovery",
        },
    }


def _pdf_item(client: SafeScraplingClient, item: dict, markup: bytes) -> dict:
    soup = BeautifulSoup(markup, "html.parser")
    for anchor in soup.select("main a[href], article a[href]"):
        target = urljoin(item["url"], anchor.get("href", ""))
        parsed = urlsplit(target)
        if (parsed.scheme != "https" or parsed.hostname not in {"www.oecd.org", "www.oecd-ilibrary.org"}
                or not parsed.path.casefold().endswith(".pdf")):
            continue
        try:
            data, final_url, content_type = client.get(target)
            if not final_url.startswith("https://") or not data.startswith(b"%PDF-") or len(data) > MAX_PDF_BYTES:
                continue
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(data), strict=True)
            if reader.is_encrypted or not 1 <= len(reader.pages) <= 300:
                continue
            pages = [" ".join((page.extract_text() or "").split()) for page in reader.pages]
            ocr_pages = [index + 1 for index, value in enumerate(pages) if len(value) < 20]
            if ocr_pages:
                from scripts.collector.pdf_ocr import add_text_layer
                reader = PdfReader(io.BytesIO(add_text_layer(data, 'oecd', ocr_pages)), strict=True)
                pages = [" ".join((page.extract_text() or "").split()) for page in reader.pages]
            text = "\n\n".join(f"[Page {index + 1}]\n{value}" for index, value in enumerate(pages) if value)
            if len(text.strip()) < 80:
                continue
            body_truncated = len(text) > MAX_ITEM_CHARS
            text = text[:MAX_ITEM_CHARS]
            item = dict(item)
            item["content_text"] = text
            item["content_hash"] = hashlib.sha256(text.encode("utf-8")).hexdigest()
            item["metadata"] = {
                **item["metadata"],
                "parser_version": "oecd-webcms-rss-official-pdf-v2",
                "read_scope": "official_linked_pdf_text",
                "pdf_source_url": final_url,
                "pdf_page_count": len(reader.pages),
                "pdf_extraction_method": "ocrmypdf+pypdf" if ocr_pages else "pypdf",
                "pdf_ocr_pages": ocr_pages,
                "body_truncated": body_truncated,
                "unread_attachments": [],
                "factual_status": "official_linked_pdf_text_requires_human_review",
            }
            break
        except Exception:
            # Keep the verified HTML body and make the attachment limitation
            # explicit; do not retry or follow a different guessed PDF URL.
            item.setdefault("metadata", {})["pdf_extraction_incomplete"] = True
            break
    return item


def collect_window(since: str, until: str, *, client=None, max_items: int | None = None) -> dict:
    own_client = client is None
    client = client or SafeScraplingClient(ALLOWED_HOSTS)
    result = {"status": "partial", "since": since, "until": until, "pages": 0,
              "discovered": 0, "details_attempted": 0, "out_of_range": 0,
              "coverage_complete": False, "items": [], "errors": []}
    by_url: dict[str, dict] = {}
    try:
        for feed_url in RSS_FEEDS:
            try:
                payload, final_url, content_type = client.get(feed_url)
                if final_url != feed_url:
                    raise ValueError("oecd_rss_redirect_not_exact")
                if content_type not in {"application/rss+xml", "application/xml", "text/xml", "text/plain"}:
                    raise ValueError("oecd_rss_unexpected_content_type")
                rows = parse_feed(payload, feed_url)
                result["pages"] += 1
                result["discovered"] += len(rows)
                for row in rows:
                    if row["published_date"] and not since <= row["published_date"] <= until:
                        result["out_of_range"] += 1
                        continue
                    if row["url"] not in by_url or len(row["feed_text"]) > len(by_url[row["url"]]["feed_text"]):
                        by_url[row["url"]] = row
            except (FetchFailure, ValueError) as error:
                result["errors"].append({"url": feed_url, "reason": str(error)[:200]})

        candidates = list(by_url.values())
        if max_items is not None:
            candidates = candidates[:max_items]
        for row in candidates:
            result["details_attempted"] += 1
            item = None
            if _article_path_allowed(row["url"]):
                try:
                    markup, final_url, content_type = client.get(row["url"])
                    if content_type in {"text/html", "application/xhtml+xml"} and _article_path_allowed(final_url):
                        item = _item_from_detail(markup, final_url, row)
                        if item:
                            item = _pdf_item(client, item, markup)
                except (FetchFailure, ValueError) as error:
                    row["detail_fetch_error"] = str(error)[:200]
            if item is None:
                excerpt = row["feed_text"].strip()
                if len(excerpt) < 10:
                    result["errors"].append({"url": row["url"], "reason": "official_rss_excerpt_missing"})
                    continue
                item = {
                    "url": row["url"],
                    "title_original": row["title"],
                    "content_text": excerpt[:MAX_ITEM_CHARS],
                    "content_hash": hashlib.sha256(excerpt.encode("utf-8")).hexdigest(),
                    "published_date": row["published_date"],
                    "metadata": {
                        "parser_version": "oecd-webcms-rss-excerpt-v2",
                        "read_scope": "official_rss_summary",
                        "source_feed_url": row["source_feed_url"],
                        "raw_feed_date": row["feed_date_raw"],
                        "date_observations": row["date_observations"],
                        "detail_fetch_error": row.get("detail_fetch_error"),
                        "requires_review": True,
                        "ai_ready": False,
                        "date_range_status": "unknown_date_retained_for_review" if not row["published_date"] else "official_rss_date_in_window",
                        "factual_status": "official_rss_excerpt_not_full_article",
                    },
                }
            item["metadata"].update({
                "collector": "oecd-webcms-rss-v2",
                "collector_transport": "scrapling.fetchers.Fetcher",
                "requires_review": True,
                "ai_ready": False,
                "source_route": "official_webcms_rss_api",
            })
            published = item.get("published_date")
            if published and not since <= published <= until:
                result["out_of_range"] += 1
                continue
            if not published:
                item["metadata"]["date_range_status"] = "unknown_date_retained_for_review"
            result["items"].append(item)
    finally:
        result["requests"] = getattr(client, "requests", None)
        result["robots_requests"] = getattr(client, "robots_requests", None)
        result["downloaded_bytes"] = getattr(client, "bytes_received", None)
    if result["items"]:
        result["status"] = "partial" if result["errors"] else "success"
    elif result["pages"] and not result["errors"]:
        result["status"] = "no_candidates"
    else:
        result["status"] = "failed"
    return result
