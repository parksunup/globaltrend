"""China CAC source adapter for the separate Scrapling collector."""
from __future__ import annotations

import hashlib
import re
from datetime import date
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup


CAC_LISTING = "https://www.cac.gov.cn/wxzw/sjzl/A093708index_1.htm"
_ARTICLE_PATH = re.compile(r"^/\d{4}-\d{2}/\d{2}/c_\d+\.htm$")
_PRIVACY = re.compile(r"个人信息|数据安全|网络数据|个人隐私|个人信息保护|数据出境|数据治理", re.I)


def _text(node) -> str:
    return " ".join(node.get_text(" ", strip=True).split()) if node else ""


def _date(value: str) -> tuple[str | None, dict | None]:
    value = " ".join((value or "").split())
    match = re.search(r"(20\d{2})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?", value)
    if not match:
        return None, ({"meaning": "listing_or_detail_date_unparsed", "value": value} if value else None)
    try:
        parsed = date(int(match[1]), int(match[2]), int(match[3]))
    except ValueError:
        return None, {"meaning": "listing_or_detail_date_unparsed", "value": value}
    return parsed.isoformat(), {"meaning": "published_display_candidate", "value": value}


def _trusted_url(url: str, *, article: bool) -> bool:
    parsed = urlsplit(url)
    return (
        parsed.scheme == "https"
        and parsed.hostname == "www.cac.gov.cn"
        and (bool(_ARTICLE_PATH.fullmatch(parsed.path)) if article else parsed.path == "/wxzw/sjzl/A093708index_1.htm")
    )


def parse_listing(source_id: str, html: str, listing_url: str) -> list[dict]:
    """Parse CAC's verified personal-information governance list page."""
    if source_id != "cn-cac":
        raise ValueError("cac_adapter_source_mismatch")
    if not _trusted_url(listing_url, article=False):
        raise ValueError("cac_listing_route_not_verified")
    soup = BeautifulSoup(html, "html.parser")
    rows: dict[str, dict] = {}
    for link in soup.select("#loadingInfoPage li h5 a[href]"):
        title = _text(link)
        target = urljoin(listing_url, link.get("href", ""))
        if not title or not _trusted_url(target, article=True) or not _PRIVACY.search(title):
            continue
        card = link.find_parent("li")
        date_node = card.select_one(".times") if card else None
        published, observation = _date(_text(date_node))
        row = {"url": target, "title": title, "source_adapter": "cac-official-list-v1"}
        if observation:
            observation["locator"] = "#loadingInfoPage li .times"
            row["date_observations"] = [observation]
        if published:
            row["published_date"] = published
        rows[target] = row
    return list(rows.values())


def parse_detail(source_id: str, html: str, url: str, row: dict) -> dict:
    """Read CAC's title, visible publication date, body, and linked assets.

    Short notices are retained as short notices. The adapter does not invent
    missing paragraphs or label a 271-character announcement as a long-form
    article. Linked assets remain explicitly unread for downstream handling.
    """
    if source_id != "cn-cac":
        raise ValueError("cac_adapter_source_mismatch")
    if not _trusted_url(url, article=True):
        raise ValueError("cac_detail_route_not_verified")
    soup = BeautifulSoup(html, "html.parser")
    title_node = soup.select_one(".main-title h1.title") or soup.select_one("h1")
    body_node = soup.select_one("#BodyLabel")
    if not title_node or not body_node:
        raise ValueError("cac_article_template_missing")
    title = _text(title_node)
    body_soup = BeautifulSoup(str(body_node), "html.parser")
    for unwanted in body_soup.select("script,style,nav,footer,.share,.editor,.function"):
        unwanted.decompose()
    body = _text(body_soup)
    if not body:
        raise ValueError("cac_article_body_empty")

    date_node = soup.select_one("#pubtime")
    date_text = _text(date_node)
    published, observation = _date(date_text)
    observations = list(row.get("date_observations", []))
    if observation:
        observation["locator"] = "#pubtime"
        observations.append(observation)

    linked_assets = []
    for anchor in body_soup.select("a[href]"):
        href = urljoin(url, anchor.get("href", ""))
        parsed = urlsplit(href)
        if parsed.scheme != "https" or parsed.hostname not in {"www.cac.gov.cn", "cac.gov.cn"}:
            continue
        linked_assets.append({"url": href, "title": _text(anchor), "read": False})
    attachments = [asset for asset in linked_assets if re.search(r"\.pdf(?:$|\?)", urlsplit(asset["url"]).path, re.I)]
    short_notice = len(body) < 500

    return {
        "title_original": title,
        "content_text": body,
        "content_hash": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        "published_date": published or row.get("published_date"),
        "metadata": {
            "parser_version": "cac-official-article-v1",
            "read_scope": "official_cac_notice_html",
            "date_observations": observations,
            "requires_review": True,
            "ai_ready": False,
            "short_notice": short_notice,
            "short_notice_reason": "original_notice_is_brief_or_needs_attachment_review" if short_notice else None,
            "related_documents": linked_assets,
            "unread_attachments": [asset["url"] for asset in attachments],
            "factual_status": "official_notice_not_independent_legal_finding",
        },
    }
