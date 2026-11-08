"""Evidence-based PDF attachment discovery for verified official sources.

This module only discovers links present in an explicitly supported HTML page.
It does not fetch or extract a PDF. The normal collector body-extraction chain
must still try Trafilatura first for HTML; when the discovered URL is fetched
as ``application/pdf``, the caller should pass its bytes to the shared
``scripts.collector.parsers.extract_pdf`` implementation (pypdf).

The narrow URL allowlists below are based on observed JPDP, Global CBPR Forum,
and ISO/IEC SC 27 pages. They intentionally reject lookalike URLs, unrelated
attachments, and generic extensionless links.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup


_SOURCE_RULES = {
    "jpdp-my": {
        "host": "www.pdp.gov.my",
        "page_paths": {
            "/en/public-consultation-paper-no-1-2026-artificial-intelligence-ai-and-personal-data-protection-framework/",
        },
        "asset_paths": {
            "/wp-content/uploads/2026/10/Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework.pdf",
        },
    },
    "global-cbpr": {
        "host": "www.globalcbpr.org",
        "page_paths": {
            "/the-forum-releases-its-annual-report-2025-2026-and-annual-work-program-for-2026-2027/",
        },
        "asset_paths": {
            "/wp-content/uploads/GlobalCBPRForum-Annual-Report-2025-2026.pdf",
            "/wp-content/uploads/Global-CBPR-Forum-Work-Program-2026-2027.pdf",
        },
    },
    "iso-iec-sc27": {
        "host": "committee.iso.org",
        "page_paths": {"/sites/jtc1sc27/home/news.html"},
        "asset_paths": {
            "/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023.pdf",
        },
    },
    "ppc": {
        "host": "www.ppc.go.jp",
        "page_paths": {"/news/press/2026/261007_houdou", "/news/press/2026/261007_houdou/"},
        "asset_paths": {"/files/pdf/261007_houdou.pdf"},
    },
}

_GENERIC_LINK_TEXT = {"download", "pdf", "view", "open", "read more"}


def supports_pdf_source_page(source: str, page_url: str) -> bool:
    """Whether this exact observed page has a verified PDF-link rule."""
    rules = _SOURCE_RULES.get(source)
    if not rules:
        return False
    page = urlsplit(page_url)
    return (
        page.scheme == "https"
        and page.hostname == rules["host"]
        and page.username is None
        and page.password is None
        and page.port in (None, 443)
        and page.path in rules["page_paths"]
    )


def _normalized_https_url(raw_url: str, base_url: str, expected_host: str) -> str | None:
    """Resolve only HTTPS links on the evidence-backed exact host."""
    if not isinstance(raw_url, str) or not raw_url.strip():
        return None
    absolute = urljoin(base_url, raw_url.strip())
    parsed = urlsplit(absolute)
    if (
        parsed.scheme != "https"
        or parsed.hostname != expected_host
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port not in (None, 443)
        or parsed.query
        or parsed.fragment
    ):
        return None
    return urlunsplit(("https", expected_host, parsed.path, "", ""))


def _listing_date_observations(source: str, anchor: Any) -> list[dict[str, str]]:
    """Read an explicit date from the source's known listing-card markup.

    Dates are preserved as displayed; this function does not interpret or
    promote them to a PDF publication date.
    """
    raw_date = ""
    locator = ""
    if source == "jpdp-my":
        card = anchor.find_parent("article", class_="elementor-post")
        date_node = card.select_one(".elementor-post-date") if card else None
        if date_node:
            raw_date = date_node.get_text(" ", strip=True)
            locator = "JPDP listing article card .elementor-post-date"
    elif source == "global-cbpr":
        card = anchor.find_parent("article", class_="elementor-post")
        date_node = card.select_one(".elementor-post-date") if card else None
        if date_node:
            raw_date = date_node.get_text(" ", strip=True)
            locator = "Global CBPR listing article card .elementor-post-date"
    elif source == "iso-iec-sc27":
        row = anchor.find_parent("tr")
        cells = row.find_all("td", recursive=False) if row else []
        if len(cells) >= 2:
            raw_date = cells[-1].get_text(" ", strip=True)
            locator = "ISO/IEC SC27 listing table row date cell"
    elif source == "ppc":
        card = anchor.find_parent(lambda node: node.name in ("li", "div") and node.select_one("time[datetime]"))
        date_node = card.select_one("time[datetime]") if card else None
        if date_node:
            raw_date = date_node.get("datetime", "")
            locator = "PPC press archive row time@datetime"

    if not raw_date:
        return []
    return [{
        "meaning": "expansion_listing_published",
        "locator": locator,
        "value": raw_date,
    }]


def _copied_listing_dates(listing_row: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Copy only date observations explicitly supplied by the listing row."""
    if not isinstance(listing_row, dict):
        return []
    observations = listing_row.get("date_observations", [])
    if not isinstance(observations, list):
        return []
    return deepcopy(observations)


def discover_pdf_links(
    source: str,
    html: str | bytes,
    page_url: str,
    listing_row: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Return evidence-backed PDF links from one supported official page.

    ``listing_row`` is an optional collector row obtained from the source's
    listing page. Its date observations are copied unchanged, never inferred
    from the attachment filename, PDF metadata, or article-detail metadata.
    When no row is supplied, dates are read only from the known listing card
    markup represented in ``html``.

    Results have the shape expected by the collector's listing rows:
    ``{url, title, date_observations, discovered_from}``.
    Unknown source IDs or wrong page hosts/paths raise ``ValueError``; links
    outside each source's exact observed asset paths are ignored.
    """
    rules = _SOURCE_RULES.get(source)
    if not rules:
        raise ValueError("pdf_source_not_supported")
    if not supports_pdf_source_page(source, page_url):
        raise ValueError("pdf_page_not_evidence_backed")

    soup = BeautifulSoup(html, "html.parser")
    found: dict[str, dict[str, Any]] = {}
    for anchor in soup.select("a[href]"):
        target = _normalized_https_url(anchor.get("href"), page_url, rules["host"])
        if not target:
            continue
        target_path = urlsplit(target).path
        if target_path not in rules["asset_paths"]:
            continue

        title = " ".join((anchor.get_text(" ", strip=True) or anchor.get("title") or "").split())
        if title.casefold() in _GENERIC_LINK_TEXT:
            title = ""
        if not title:
            # Duplicate WordPress attachment controls often say only
            # “Download”; prefer a descriptive duplicate anchor. If none is
            # present, the observed file label is a neutral fallback.
            title = target_path.rsplit("/", 1)[-1].removesuffix(".pdf").replace("_", " ").replace("-", " ")

        existing = found.get(target)
        if existing:
            if len(title) > len(existing["title"]):
                existing["title"] = title
            continue

        dates = _copied_listing_dates(listing_row)
        if not dates:
            dates = _listing_date_observations(source, anchor)
        found[target] = {
            "url": target,
            "title": title,
            "date_observations": dates,
            "discovered_from": page_url,
        }
    return list(found.values())


__all__ = ["discover_pdf_links", "supports_pdf_source_page"]
