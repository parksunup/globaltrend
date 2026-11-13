"""Vietnam Government News listing and article parser for the Scrapling worker."""
from __future__ import annotations

import hashlib
import re
from datetime import date, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

HOST = "en.baochinhphu.vn"
HOME = f"https://{HOST}/"
POLICIES = f"https://{HOST}/policies.htm"
TIMELINE = f"https://{HOST}/timelinelist/11151"
ARTICLE_RE = re.compile(r"^/[a-z0-9-]+-\d{18}\.htm$", re.I)
TIMELINE_RE = re.compile(r"^/timelinelist/11151/(\d+)\.htm$")
PRIVACY_TERMS = re.compile(
    r"\b(?:privacy|personal data|personal information|data protection|data privacy|"
    r"Decree\s+(?:No\.?\s*)?363|Nghị định\s+(?:số\s*)?363|dữ liệu cá nhân|bảo vệ dữ liệu)\b",
    re.I,
)


def listing_urls(start_date: str, end_date: str) -> list[str]:
    """Begin with official spotlight and policy pages; pagination is followed by next_page_url."""
    if date.fromisoformat(start_date) > date.fromisoformat(end_date):
        raise ValueError("vn_invalid_date_window")
    return [HOME, POLICIES]


def _safe_article_url(href: str, base: str) -> str | None:
    target = urljoin(base, href)
    parts = urlsplit(target)
    if parts.scheme != "https" or parts.hostname != HOST or not ARTICLE_RE.fullmatch(parts.path):
        return None
    return target


def _date_value(raw: str | None) -> str | None:
    if not raw:
        return None
    value = " ".join(raw.split())
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.date().isoformat()
    except ValueError:
        pass
    for fmt in ("%B %d, %Y %I:%M %p GMT%z", "%B %d, %Y", "%d %B %Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError, OverflowError):
        return None


def _candidate(anchor, base: str, card=None) -> dict | None:
    target = _safe_article_url(anchor.get("href", ""), base)
    if not target:
        return None
    title = " ".join((anchor.get("title") or anchor.get_text(" ", strip=True)).split())
    if not title:
        return None
    row = {"url": target, "title": title, "source_attribution": "Vietnam Government Online Newspaper"}
    date_node = card.select_one("time[datetime], .time-ago, [data-role='publishdate']") if card else None
    if date_node:
        raw = date_node.get("datetime") or date_node.get_text(" ", strip=True)
        if raw:
            row["date_observations"] = [{
                "meaning": "listing_published_display",
                "locator": "Vietnam Government official listing card",
                "value": " ".join(raw.split()),
                "date": _date_value(raw),
            }]
    return row


def parse_listing(source_id: str, html: str, listing_url: str) -> list[dict]:
    if source_id != "vn-gov":
        raise ValueError("vn_source_id_mismatch")
    parsed = urlsplit(listing_url)
    if parsed.scheme != "https" or parsed.hostname != HOST:
        raise ValueError("vn_listing_host_invalid")
    path = parsed.path or "/"
    soup = BeautifulSoup(html, "html.parser")
    rows: dict[str, dict] = {}
    if path == "/":
        anchors = soup.select('a.box-focus-link-title[data-linktype="newsdetail"][href]')
        for anchor in anchors:
            row = _candidate(anchor, listing_url)
            if row:
                rows[row["url"]] = row
        return list(rows.values())
    if path == "/policies.htm":
        zone = soup.select_one("#hdZoneId")
        if zone is None or zone.get("value") != "11151" or "timeline.url" not in html or "/timelinelist/{0}/{1}.htm" not in html:
            raise ValueError("vn_timeline_contract_unverified")
        for anchor in soup.select('div.box-category-item-sub h3.box-category-content a.box-category-link-title[data-linktype="newsdetail"][href]'):
            card = anchor.find_parent("div", class_="box-category-item-sub")
            row = _candidate(anchor, listing_url, card)
            if row:
                rows[row["url"]] = row
        return list(rows.values())
    match = TIMELINE_RE.fullmatch(path)
    if not match:
        raise ValueError("vn_listing_path_unverified")
    for anchor in soup.select('div.box-category-item-sub h3.box-category-content a.box-category-link-title[data-linktype="newsdetail"][href]'):
        card = anchor.find_parent("div", class_="box-category-item-sub")
        row = _candidate(anchor, listing_url, card)
        if row:
            rows[row["url"]] = row
    return list(rows.values())


def next_page_url(html: str, url: str, since: str | None = None) -> str | None:
    """Follow the site's verified path: home -> policies -> timeline pages.

    The timeline has no observed explicit last-page link. Stop when its official
    fragment is empty or when verified card dates have moved before `since`.
    Unknown relative dates do not cause an invented cutoff.
    """
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != HOST:
        raise ValueError("vn_listing_host_invalid")
    path = parsed.path or "/"
    if path == "/":
        return POLICIES
    if path == "/policies.htm":
        soup = BeautifulSoup(html, "html.parser")
        zone = soup.select_one("#hdZoneId")
        if zone is None or zone.get("value") != "11151" or "timeline.url" not in html or "/timelinelist/{0}/{1}.htm" not in html:
            raise ValueError("vn_timeline_contract_unverified")
        return f"{TIMELINE}/2.htm"
    match = TIMELINE_RE.fullmatch(path)
    if not match:
        raise ValueError("vn_listing_path_unverified")
    rows = parse_listing("vn-gov", html, url)
    if not rows:
        return None
    if since:
        dates = [obs.get("date") for row in rows for obs in row.get("date_observations", [])]
        # Only stop when every card has a verified date, the page is newest to
        # oldest, and even its newest item predates the requested window.
        # A single old card on a mixed/undated page must not hide later pages.
        if dates and all(dates):
            normalized = [date.fromisoformat(value).isoformat() for value in dates]
            ordered = all(normalized[index] <= normalized[index - 1]
                          for index in range(1, len(normalized)))
            if ordered and max(normalized) < date.fromisoformat(since).isoformat():
                return None
    page_num = int(match.group(1))
    return f"{TIMELINE}/{page_num + 1}.htm"


def proves_window_exhausted(html: str, url: str, since: str) -> bool:
    """Prove the timeline ended through an empty fragment or a dated cutoff."""
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != HOST:
        return False
    match = TIMELINE_RE.fullmatch(parsed.path)
    if not match:
        return False
    rows = parse_listing("vn-gov", html, url)
    if not rows:
        return True
    dates = [obs.get("date") for row in rows for obs in row.get("date_observations", [])]
    if not dates or any(not value for value in dates):
        return False
    normalized = [date.fromisoformat(value).isoformat() for value in dates]
    ordered = all(normalized[index] <= normalized[index - 1]
                  for index in range(1, len(normalized)))
    return ordered and max(normalized) < date.fromisoformat(since).isoformat()


def is_privacy_relevant(text: str) -> bool:
    """Body-aware topic check; an unrelated title never suppresses detail parsing."""
    return bool(PRIVACY_TERMS.search(text or ""))


def parse_detail(source_id: str, html: str, url: str, row: dict) -> dict:
    if source_id != "vn-gov":
        raise ValueError("vn_source_id_mismatch")
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != HOST or not ARTICLE_RE.fullmatch(parsed.path):
        raise ValueError("vn_detail_url_unverified")
    soup = BeautifulSoup(html, "html.parser")
    title_node = soup.select_one('h1.detail-title[data-role="title"]')
    title = " ".join((title_node.get_text(" ", strip=True) if title_node else row.get("title", "")).split())
    if not title:
        raise ValueError("vn_detail_title_missing")
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
        node = soup.select_one(".detail-content")
        if node:
            for junk in node.select("script, style, nav, footer, .share-tools, .related-news"):
                junk.decompose()
            body = " ".join(node.get_text(" ", strip=True).split())
    if not body:
        raise ValueError("vn_detail_body_missing")
    date_node = soup.select_one('meta[property="article:published_time"]')
    date_value = date_node.get("content") if date_node else None
    published = _date_value(date_value)
    observations = list(row.get("date_observations", []))
    if date_value:
        observations.append({"meaning": "official_published_attribute", "locator": 'meta[property="article:published_time"]@content', "value": date_value})
    visible_date = soup.select_one('[data-role="publishdate"]')
    if visible_date:
        raw_visible = " ".join(visible_date.get_text(" ", strip=True).split())
        observations.append({"meaning": "official_published_display", "locator": "[data-role=publishdate]", "value": raw_visible, "date": _date_value(raw_visible)})
    return {
        "title_original": title,
        "content_text": body,
        "content_hash": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        "published_date": published,
        "metadata": {
            "parser_version": "scrapling-vn-gov-official-detail-v1",
            "read_scope": "official_government_news_detail_body",
            "source_attribution": "Vietnam Government Online Newspaper",
            "date_observations": observations,
            "relevance_checked_against_body": True,
            "privacy_relevant": is_privacy_relevant(title + " " + body),
            "relevance_terms": sorted(set(m.group(0).casefold() for m in PRIVACY_TERMS.finditer(title + " " + body))),
            "requires_review": True,
            "ai_ready": False,
            "extraction_method": "trafilatura" if extracted else "source_selector_fallback",
            "related_documents": [],
            "unread_attachments": [],
        },
    }
