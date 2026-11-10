"""OECD adapter for the separate Scrapling collector.

The official WebCMS RSS API is the primary alternate route. The PR #42 HTML
topic route remains available as a separately labelled legacy route. The
2026-10-22 977-character diagnostic used the PR #42 Python urllib client.
"""
from __future__ import annotations

import hashlib
import io
import re
import xml.etree.ElementTree as ET
from datetime import date
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup


LEGACY_LISTING_URL = "https://www.oecd.org/en/topics/privacy-and-data-protection.html"
RSS_LISTING_URLS = (
    "https://api.oecd.org/webcms/search/rss?siteName=oecd&interfaceLanguage=en&path=%2Fcontent%2Foecd%2Fen%2Ftopics%2Fprivacy-and-data-protection&facets=oecd-languages%3Aen",
    "https://api.oecd.org/webcms/search/rss?siteName=oecd&interfaceLanguage=en&path=%2Fcontent%2Foecd%2Fen%2Fpublications&facets=oecd-languages%3Aen",
)
_ARTICLE_PATHS = (
    re.compile(r"^/en/publications/[^?#]+\.html$"),
    re.compile(r"^/en/about/news/press-releases/[^?#]+/?$"),
)
_MONTHS = {
    name.casefold(): index for index, name in enumerate(
        ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"), 1
    )
}
_PRIVACY = re.compile(
    r"\bprivacy\b|personal data|data protection|data privacy|digital security|"
    r"protection des données|vie privée|données personnelles|privacidad|"
    r"datos personales|protección de datos",
    re.I,
)


def _normal(value: str) -> str:
    return " ".join((value or "").split())


def _parse_date(value: str) -> str | None:
    value = _normal(value)
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError, OverflowError):
        pass
    iso = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?", value)
    try:
        if iso:
            return date(int(iso[1]), int(iso[2]), int(iso[3])).isoformat()
        patterns = (
            re.compile(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})"),
            re.compile(r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})"),
        )
        for index, pattern in enumerate(patterns):
            match = pattern.search(value)
            if not match:
                continue
            if index == 0:
                day, month, year = int(match[1]), _MONTHS.get(match[2].casefold()), int(match[3])
            else:
                month, day, year = _MONTHS.get(match[1].casefold()), int(match[2]), int(match[3])
            if month:
                return date(year, month, day).isoformat()
    except ValueError:
        return None
    return None


def _is_official_listing(url: str) -> bool:
    parsed = urlsplit(url)
    return (
        parsed.scheme == "https"
        and parsed.hostname == "www.oecd.org"
        and parsed.path == "/en/topics/privacy-and-data-protection.html"
        and not parsed.query
    )


def _is_official_rss(url: str) -> bool:
    return url in RSS_LISTING_URLS


def _is_official_article(url: str) -> bool:
    parsed = urlsplit(url)
    return parsed.scheme == "https" and parsed.hostname == "www.oecd.org" and any(
        pattern.fullmatch(parsed.path) for pattern in _ARTICLE_PATHS
    )


def parse_listing(source_id: str, html: str, listing_url: str) -> list[dict]:
    """Parse an official WebCMS RSS route or the PR #42 topic listing."""
    if source_id != "oecd":
        raise ValueError("oecd_adapter_source_mismatch")
    if _is_official_rss(listing_url):
        return _parse_rss_listing(html, listing_url)
    if not _is_official_listing(listing_url):
        raise ValueError("oecd_listing_route_not_verified")
    soup = BeautifulSoup(html, "html.parser")
    selectors = "main a[href*='/publications/'], main a[href*='/about/news/press-releases/']"
    rows: dict[str, dict] = {}
    for link in soup.select(selectors):
        target = urljoin(listing_url, link.get("href", ""))
        if not _is_official_article(target):
            continue
        title = _normal(link.get_text(" ", strip=True))
        if not title:
            continue
        rows[target] = {
            "url": target,
            "title": title,
            "source_adapter": "oecd-pr42-topic-listing-v1",
            "listing_url": listing_url,
            "read_scope_expected": "official_abstract" if "/publications/" in urlsplit(target).path else "press_release_html_not_report",
        }
    return list(rows.values())


def listing_urls(since: str, until: str) -> list[str]:
    """Try the two verified English WebCMS RSS APIs before the older HTML path."""
    # These APIs are rolling official indexes. Their entries carry source dates;
    # date-window filtering happens in the runner after parsing each feed.
    return list(RSS_LISTING_URLS)


def _parse_rss_listing(xml_text: str, listing_url: str) -> list[dict]:
    if not _is_official_rss(listing_url):
        raise ValueError("oecd_rss_route_not_verified")
    try:
        root = ET.fromstring(xml_text.lstrip("\ufeff \t\r\n"))
    except ET.ParseError as error:
        raise ValueError("oecd_official_rss_xml_invalid") from error
    rows: dict[str, dict] = {}
    for entry in root.findall(".//item"):
        title_node = entry.find("title")
        link_node = entry.find("link")
        summary_node = entry.find("description")
        if summary_node is None:
            summary_node = entry.find("{http://purl.org/rss/1.0/modules/content/}encoded")
        date_node = entry.find("pubDate")
        if date_node is None:
            date_node = entry.find("{http://purl.org/dc/elements/1.1/}date")
        title = _xml_text(title_node)
        target = _xml_text(link_node)
        summary = _xml_text(summary_node)
        if not title or not _is_official_article(target):
            continue
        if not _PRIVACY.search(title + " " + summary):
            continue
        raw_date = _xml_text(date_node)
        published = _parse_date(raw_date)
        observations = ([{"meaning": "official_rss_published", "locator": "RSS item date", "value": raw_date}]
                        if raw_date else [])
        rows[target] = {
            "url": target,
            "title": title,
            "feed_text": summary,
            "feed_date_raw": raw_date,
            "source_feed_url": listing_url,
            "source_adapter": "oecd-webcms-rss-api-v1",
            "read_scope_expected": "official_rss_summary",
            "date_observations": observations,
            "feed_only": True,
            **({"published_date": published} if published else {}),
        }
    return list(rows.values())


def _xml_text(node: ET.Element | None) -> str:
    if node is None:
        return ""
    raw = " ".join("".join(node.itertext()).split())
    return _normal(BeautifulSoup(raw, "html.parser").get_text(" ", strip=True)) if "<" in raw else raw


def next_page_url(html: str, listing_url: str, *, since: str | None = None) -> str | None:
    """Follow only an observed official next-page link from the topic page."""
    if _is_official_rss(listing_url):
        return None
    if not _is_official_listing(listing_url):
        raise ValueError("oecd_listing_route_not_verified")
    soup = BeautifulSoup(html, "html.parser")
    link = soup.select_one("a[rel~='next'], .pager__item--next a[href], .pager-next a[href]")
    if not link:
        return None
    target = urljoin(listing_url, link.get("href", ""))
    parsed = urlsplit(target)
    if parsed.scheme != "https" or parsed.hostname != "www.oecd.org" or parsed.path != urlsplit(listing_url).path:
        raise ValueError("oecd_next_page_outside_verified_topic_route")
    return target


def parse_detail(source_id: str, html: str, url: str, row: dict) -> dict:
    """Extract a report abstract, article body, or clearly labelled RSS excerpt."""
    if source_id != "oecd":
        raise ValueError("oecd_adapter_source_mismatch")
    if not _is_official_article(url):
        raise ValueError("oecd_detail_route_not_verified")
    if not html.strip():
        excerpt = _normal(str(row.get("feed_text", "")))
        if not excerpt:
            raise ValueError("oecd_detail_html_missing_and_rss_excerpt_empty")
        return {
            "title_original": _normal(str(row.get("title", ""))),
            "content_text": excerpt,
            "content_hash": hashlib.sha256(excerpt.encode("utf-8")).hexdigest(),
            "published_date": row.get("published_date"),
            "metadata": {
                "parser_version": "oecd-webcms-rss-excerpt-v1",
                "read_scope": "official_rss_summary",
                "source_feed_url": row.get("source_feed_url"),
                "date_observations": row.get("date_observations", []),
                "requires_review": True,
                "ai_ready": False,
                "factual_status": "official_rss_excerpt_not_full_article",
            },
        }

    soup = BeautifulSoup(html, "html.parser")
    path = urlsplit(url).path
    is_release = "/en/about/news/press-releases/" in path
    if is_release:
        article = soup.select_one("main [itemtype='https://schema.org/Article']")
        title_node = article.select_one("h1.cmp-article-header__title") if article else None
        date_node = article.select_one(".cmp-article-header__date time[itemprop='datePublished']") if article else None
        nodes = article.select("[itemprop='articleBody'] .cmp-text") if article else []
        scope = "press_release_html_not_report"
    else:
        # Match the PR #42 publication parser: title + the section explicitly
        # labelled Abstract. Never substitute the full linked PDF/report.
        title_node = soup.select_one("h1.cmp-report-header__title")
        date_node = soup.select_one("time")
        nodes = []
        for heading in soup.select("h2.cmp-title__text"):
            if _normal(heading.get_text()).casefold() != "abstract":
                continue
            container = heading.find_parent(class_="cmp-two-column-container")
            if container:
                nodes = container.select(".cmp-text p")
            if nodes:
                break
        scope = "official_abstract"

    if not title_node:
        raise ValueError("oecd_title_missing")
    title = _normal(title_node.get_text(" ", strip=True))
    related = []
    pdf_urls = []
    main = soup.select_one("main") or soup
    for link in main.select("a[href]"):
        target = urljoin(url, link.get("href", ""))
        parsed_target = urlsplit(target)
        if parsed_target.scheme != "https" or parsed_target.hostname not in {"www.oecd.org", "www.oecd-ilibrary.org"}:
            continue
        label = _normal(link.get_text(" ", strip=True))
        record = {"url": target, "title": label, "read": False}
        if record not in related:
            related.append(record)
        if parsed_target.path.casefold().endswith(".pdf") and target not in pdf_urls:
            pdf_urls.append(target)
    for node in nodes:
        for unwanted in node.select("script,style,nav,footer"):
            unwanted.decompose()
    nodes = [node for node in nodes if not any(parent in nodes for parent in node.parents)]
    body = _normal(" ".join(node.get_text(" ", strip=True) for node in nodes))
    if len(body) < 10:
        raise ValueError("oecd_abstract_or_article_body_missing")

    observations = list(row.get("date_observations", []))
    display_value = _normal(date_node.get_text(" ", strip=True)) if date_node else ""
    attribute_value = _normal(date_node.get("datetime", "")) if date_node else ""
    candidates = []
    if display_value:
        candidates.append(("detail_display_date", "time visible text", display_value))
    if attribute_value:
        candidates.append(("detail_datetime_attribute", "time@datetime", attribute_value))
    parsed_dates = []
    for meaning, locator, value in candidates:
        observations.append({"meaning": meaning, "locator": locator, "value": value})
        parsed = _parse_date(value)
        if parsed:
            parsed_dates.append(parsed)
    for observation in row.get("date_observations", []):
        value = observation.get("value")
        parsed = _parse_date(str(value)) if value else None
        if parsed:
            parsed_dates.append(parsed)
    unique_dates = set(parsed_dates)
    conflict = len(unique_dates) > 1
    published = next(iter(unique_dates)) if len(unique_dates) == 1 else None

    return {
        "title_original": title,
        "content_text": body,
        "content_hash": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        "published_date": published,
        "metadata": {
            "parser_version": "oecd-pr42-abstract-v1",
            "read_scope": scope,
            "date_observations": observations,
            "date_conflict": conflict,
            "requires_review": True,
            "ai_ready": False,
            "related_documents": related,
            "verified_pdf_urls": pdf_urls,
            "unread_attachments": list(pdf_urls),
            "factual_status": "official_abstract_not_full_report" if scope == "official_abstract" else "official_press_release_not_full_report",
        },
    }


def extract_pdf(data: bytes, url: str, row: dict) -> dict:
    """Extract an exact official OECD PDF attachment with pypdf.

    ``row`` should include the HTML article result as ``html_item`` (or be the
    HTML result itself). This preserves its title, date observations, and any
    listing/detail date conflict while replacing the abstract body with the
    linked report's PDF text.
    """
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.hostname not in {"www.oecd.org", "www.oecd-ilibrary.org"}
            or not parsed.path.casefold().endswith(".pdf")):
        raise ValueError("oecd_pdf_url_not_official_or_not_pdf")
    if not isinstance(data, bytes) or not data.startswith(b"%PDF-"):
        raise ValueError("oecd_pdf_signature_invalid")
    if len(data) > 5_000_000:
        raise ValueError("oecd_pdf_response_too_large")
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted or not 1 <= len(reader.pages) <= 300:
            raise ValueError("oecd_pdf_page_or_encryption_limit")
        pages = [{"page": index + 1, "text": _normal(page.extract_text() or "")}
                 for index, page in enumerate(reader.pages)]
    except Exception as error:
        raise ValueError("oecd_pdf_parse_failed:" + type(error).__name__) from None
    full_text = "\n\n".join(f"[Page {page['page']}]\n{page['text']}" for page in pages if page["text"]).strip()
    if not full_text:
        raise ValueError("oecd_pdf_has_no_extractable_text")

    html_item = row.get("html_item") if isinstance(row.get("html_item"), dict) else row
    old_metadata = html_item.get("metadata", {}) if isinstance(html_item.get("metadata"), dict) else {}
    related = list(old_metadata.get("related_documents", []))
    unread = [item for item in old_metadata.get("unread_attachments", []) if item != url]
    return {
        "title_original": html_item.get("title_original") or row.get("title", ""),
        "content_text": full_text,
        "content_hash": hashlib.sha256(full_text.encode("utf-8")).hexdigest(),
        "published_date": html_item.get("published_date"),
        "metadata": {
            **old_metadata,
            "parser_version": "oecd-official-pdf-pypdf-v1",
            "read_scope": "official_linked_report_pdf_full_text",
            "date_observations": old_metadata.get("date_observations", row.get("date_observations", [])),
            "date_conflict": bool(old_metadata.get("date_conflict", False)),
            "requires_review": True,
            "ai_ready": False,
            "pdf_pages": pages,
            "pdf_page_count": len(pages),
            "pdf_source_url": url,
            "related_documents": related,
            "unread_attachments": unread,
            "factual_status": "official_pdf_text_not_visual_or_independent_review",
        },
    }
