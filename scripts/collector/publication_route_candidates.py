"""Candidate discovery for six observed public privacy-news listings.

This module only reads anchors already present in supplied listing HTML. It
does not fetch pages, infer pagination, construct article URLs, or assert that
an item is relevant/complete. Detail parsing and human review remain separate.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup


_ROUTES = {
    "iapp": {
        "hosts": {"iapp.org", "www.iapp.org"},
        "listing_paths": {"/news"},
        "article_path": re.compile(r"^/news/a/[a-z0-9][a-z0-9-]*/?$", re.I),
        "card_tag": "div",
        "card_class": "chakra-linkbox",
        "source_type": "professional_publication",
        "source_name": "IAPP",
        "date_patterns": (
            (re.compile(r"(?<!\d)\d{1,2}\s+[A-Za-z]{3,9}\.\s*\d{4}(?!\d)"), "visible IAPP news card date", 0),
            (re.compile(r"(?<!\d)\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?!\d)"), "visible IAPP news card date", 0),
        ),
    },
    "fpf": {
        "hosts": {"fpf.org", "www.fpf.org"},
        "listing_paths": {"/blog", "/blog/"},
        "article_path": re.compile(r"^/blog/[a-z0-9][a-z0-9-]+/?$", re.I),
        "card_tag": None,
        "card_class": None,
        "source_type": "research_organization",
        "source_name": "Future of Privacy Forum",
        "date_patterns": (
            (re.compile(r"(?<![A-Za-z])(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}", re.I), "visible FPF blog card date", 0),
        ),
    },
    "gpa": {
        "hosts": {"globalprivacyassembly.com", "www.globalprivacyassembly.com"},
        "listing_paths": {"/news-events/latest-news", "/news-events/latest-news/"},
        "article_path": re.compile(r"^/[a-z0-9][a-z0-9-]+/?$", re.I),
        "card_tag": "div",
        "card_class": "vc_grid-item-mini",
        "source_type": "international_network",
        "source_name": "Global Privacy Assembly",
        "date_patterns": (),
    },
    "noyb": {
        "hosts": {"noyb.eu", "www.noyb.eu"},
        "listing_paths": {"/en/news", "/en/news/"},
        "article_path": re.compile(r"^/en/[a-z0-9][a-z0-9-]+/?$", re.I),
        "card_tag": "article",
        "card_class": "node--article--card",
        "source_type": "civil_society_organization",
        "source_name": "noyb",
        "date_patterns": (
            (re.compile(r"(?<!\d)\d{2}\.\d{2}\.\d{4}(?!\d)"), "visible noyb news card date", 0),
        ),
    },
    "freevacy": {
        "hosts": {"freevacy.com", "www.freevacy.com"},
        "listing_paths": {"/news", "/news/"},
        "article_path": re.compile(r"^/news/[a-z0-9-]+/[a-z0-9-]+/\d+/?$", re.I),
        "card_tag": "article",
        "card_class": "article-card",
        "source_type": "syndicated_news_aggregator",
        "source_name": "Freevacy",
        "date_patterns": (),
    },
    "overview-legal": {
        "hosts": {"overview.legal"},
        "listing_paths": {"/this-week"},
        "article_path": re.compile(r"^/posts/\d+/?$", re.I),
        "card_tag": "li",
        "card_class": None,
        "source_type": "third_party_legal_case_aggregator",
        "source_name": "overview.legal",
        "date_patterns": (
            # The visible listing label omits the year; preserve it as raw
            # evidence without turning it into a publication date.
            (re.compile(r"(?:^|\s)[·•]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2})\s+[A-Z]{2}(?:\s|$)", re.I), "visible overview.legal post label; year absent", 1),
        ),
    },
}

_GENERIC_LINK_TEXT = {
    "read more", "read more »", "continue reading", "continue reading →",
    "read more →", "more", "details", "view article",
}


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _canonical_anchor_url(anchor, base_url: str, route: dict) -> str | None:
    raw = anchor.get("href")
    if not isinstance(raw, str) or not raw.strip():
        return None
    target = urljoin(base_url, raw.strip())
    parsed = urlsplit(target)
    if parsed.scheme != "https" or parsed.hostname not in route["hosts"]:
        return None
    if parsed.username or parsed.password:
        return None
    if parsed.path not in route["listing_paths"] and not route["article_path"].fullmatch(parsed.path):
        return None
    # Keep only the observed URL itself; fragments are browser positions, not
    # article identity. Queries are not observed for these article routes.
    return urlunsplit((parsed.scheme, parsed.netloc.lower(), parsed.path, parsed.query, ""))


def _article_card(anchor, route):
    source = route["source_name"]
    selectors = {
        "IAPP": "div.chakra-linkbox",
        "Future of Privacy Forum": "div.spotlight__colum--post",
        "Global Privacy Assembly": "div.vc_grid-item-mini",
        "noyb": "article.node--article--card",
        "Freevacy": "article.article-card",
        "overview.legal": "li",
    }
    selector = selectors[source]
    for node in anchor.parents:
        if node.select_one("a[href]") and node in anchor.parents and _matches_selector(node, selector):
            return node
    return anchor.parent


def _matches_selector(node, selector: str) -> bool:
    tag, _, class_name = selector.partition(".")
    if node.name != tag:
        return False
    return all(part in node.get("class", []) for part in class_name.split(".") if part)


def _visible_title(anchor, card, source: str) -> str:
    anchor_text = _clean_text(anchor.get_text(" ", strip=True))
    if source in {"fpf", "gpa", "freevacy", "noyb"}:
        for heading in card.select("h1, h2, h3, h4"):
            heading_text = _clean_text(heading.get_text(" ", strip=True))
            if heading_text and heading_text.casefold() not in _GENERIC_LINK_TEXT:
                return heading_text
    if anchor_text and anchor_text.casefold() not in _GENERIC_LINK_TEXT:
        if source == "overview-legal":
            return anchor_text
        # noyb uses a whole-card link; prefer the visible heading to avoid
        # mixing its date, category and excerpt into the article title.
        return anchor_text

    # Image overlays on FPF, GPA and Freevacy point to the same article as a
    # text link in the card. Use that existing text anchor, never synthesize a
    # headline from a URL slug.
    target = _canonical_anchor_url(anchor, anchor.get("href", ""), _ROUTES[source])
    if target:
        sibling_titles = []
        for sibling in card.select("a[href]"):
            sibling_target = _canonical_anchor_url(sibling, target, _ROUTES[source])
            sibling_text = _clean_text(sibling.get_text(" ", strip=True))
            if sibling_target == target and sibling_text and sibling_text.casefold() not in _GENERIC_LINK_TEXT:
                sibling_text = re.sub(r"^(?:continue reading|read more)\s+", "", sibling_text, flags=re.I).strip()
                if sibling_text and sibling_text.casefold() not in _GENERIC_LINK_TEXT:
                    sibling_titles.append(sibling_text)
        if sibling_titles:
            return max(sibling_titles, key=len)
    for heading in card.select("h1, h2, h3, h4"):
        text = _clean_text(heading.get_text(" ", strip=True))
        if text and text.casefold() not in _GENERIC_LINK_TEXT:
            return text
    return ""


def _date_observations(card, source: str) -> list[dict]:
    observations = []
    seen = set()
    for node in card.select("time[datetime], time, [itemprop='datePublished'], [data-date]"):
        value = _clean_text(node.get("datetime") or node.get("content") or node.get("data-date") or node.get_text(" ", strip=True))
        if value and value not in seen:
            seen.add(value)
            locator = node.name + ("." + ".".join(node.get("class", [])) if node.get("class") else "")
            observations.append({"meaning": "listing_published_display", "locator": locator, "value": value})
    if observations:
        return observations
    text = _clean_text(card.get_text(" ", strip=True))
    route = _ROUTES[source]
    for pattern, locator, group in route["date_patterns"]:
        match = pattern.search(text)
        if match:
            value = match.group(group).strip()
            meaning = "listing_published_display"
            if source == "overview-legal":
                meaning = "listing_date_unqualified"
            return [{"meaning": meaning, "locator": locator, "value": value}]
    return []


def _publisher_label(card, candidate_url: str, article_title: str) -> str | None:
    labels = []
    for anchor in card.select("a[href]"):
        text = _clean_text(anchor.get_text(" ", strip=True))
        if not text or text.casefold() in _GENERIC_LINK_TEXT or text == article_title:
            continue
        target = urlsplit(urljoin(candidate_url, anchor.get("href", "")))
        if target.hostname in ("freevacy.com", "www.freevacy.com"):
            labels.append(text)
    # Preserve only an unambiguous visible label. Freevacy is the source
    # aggregator; this field records what the card visibly credits.
    distinct = list(dict.fromkeys(labels))
    return distinct[0] if len(distinct) == 1 else None


def discover_publication_route_candidates(source: str, listing_html: str | bytes, listing_url: str) -> list[dict]:
    """Return observed article links and card evidence for one supported source.

    The result intentionally has no ``next_url`` or coverage-complete flag.
    The caller must treat an empty date list as unknown and must not infer a
    date from a URL, the current year, or another item.
    """
    route = _ROUTES.get(source)
    if route is None:
        raise ValueError("publication_route_source_unsupported")
    listing = urlsplit(listing_url)
    if listing.scheme != "https" or listing.hostname not in route["hosts"] or listing.path not in route["listing_paths"]:
        raise ValueError("publication_route_listing_url_unverified")
    soup = BeautifulSoup(listing_html, "html.parser")
    rows = {}
    for anchor in soup.select("a[href]"):
        target = _canonical_anchor_url(anchor, listing_url, route)
        if not target or not route["article_path"].fullmatch(urlsplit(target).path):
            continue
        if source == "iapp" and "chakra-linkbox__overlay" not in anchor.get("class", []):
            continue
        if source == "fpf" and not anchor.find_parent("div", class_="spotlight__colum--post"):
            continue
        if source == "gpa" and not anchor.find_parent("div", class_="vc_grid-item-mini"):
            continue
        if source == "noyb" and not anchor.find_parent("article", class_="node--article--card"):
            continue
        if source == "freevacy" and not anchor.find_parent("article", class_="article-card"):
            continue
        if source == "overview-legal" and not anchor.find_parent("ul", class_="post-list"):
            continue
        card = _article_card(anchor, route)
        title = _visible_title(anchor, card, source)
        if not title or title.casefold() in _GENERIC_LINK_TEXT:
            continue
        row = {
            "url": target,
            "title": title,
            "listing_title": _clean_text(anchor.get_text(" ", strip=True)) or title,
            "date_observations": _date_observations(card, source),
            "source_name": route["source_name"],
            "source_type": route["source_type"],
            "source_listing_url": listing_url,
        }
        if source == "freevacy":
            row["publisher_label"] = _publisher_label(card, target, title)
            row["content_origin_kind"] = "syndicated_summary"
        elif source == "overview-legal":
            row["content_origin_kind"] = "third_party_aggregated_record"
            row["primary_source_verified_by_this_listing"] = False
        rows.setdefault(target, row)
    return list(rows.values())

