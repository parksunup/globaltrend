"""Separate, read-only-by-default Scrapling collector for six official sources."""
from __future__ import annotations

import argparse
import importlib
import inspect
import io
import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from scripts.collector.parsers import parse_date
from scripts.collector.parsers import extract_pdf

from .transport import FetchFailure, SafeScraplingClient


ROOT = Path(__file__).resolve().parents[2]
ADAPTERS = {
    "oecd": "oecd",
    "cn-cac": "cac",
    "hk-pcpd": "pcpd",
    "vn-gov": "vn_gov",
    "ftc": "ftc",
    "calprivacy": "calprivacy",
}
HOSTS = {
    "oecd": {"api.oecd.org", "www.oecd.org", "www.oecd-ilibrary.org"},
    "cn-cac": {"www.cac.gov.cn", "cac.gov.cn"},
    "hk-pcpd": {"www.info.gov.hk"},
    "vn-gov": {"en.baochinhphu.vn"},
    "ftc": {"search.ftc.gov", "www.ftc.gov"},
    "calprivacy": {"privacy.ca.gov"},
}
LISTINGS = {
    "oecd": "https://www.oecd.org/en/topics/privacy-and-data-protection.html",
    "cn-cac": "https://www.cac.gov.cn/wxzw/sjzl/A093708index_1.htm",
    "hk-pcpd": "https://www.info.gov.hk/gia/general/today.htm",
    "vn-gov": "https://en.baochinhphu.vn/",
    "ftc": "https://search.ftc.gov/news-events/news/press-releases?search=privacy&field_mission%5B29%5D=29",
    "calprivacy": "https://privacy.ca.gov/category/content-types/news/press-release/",
}


class CollectionError(RuntimeError):
    pass


def _adapter(source_id):
    name = ADAPTERS.get(source_id)
    if not name:
        raise ValueError("unknown_scrapling_source")
    return importlib.import_module("scripts.collector_scrapling.adapters." + name)


def _in_range(row, since, until):
    value = row.get("published_date")
    if not value:
        observations = row.get("date_observations") or []
        for observation in observations:
            value = observation.get("date") or observation.get("value")
            if value:
                parsed = parse_date(str(value))
                if parsed:
                    value = parsed
                    break
    if not value:
        return None
    try:
        normalized = date.fromisoformat(str(value)[:10]).isoformat()
    except ValueError:
        normalized = parse_date(str(value))
    if not normalized:
        return None
    return since <= normalized <= until


def _validate_candidate(url, hosts):
    parsed = urlsplit(url)
    return (parsed.scheme == "https" and parsed.hostname in hosts and not parsed.username
            and not parsed.password and parsed.port in (None, 443))


def _pdf_urls(item, hosts):
    metadata = item.get("metadata") or {}
    candidates = list(metadata.get("verified_pdf_urls") or [])
    candidates.extend(metadata.get("unread_attachments") or [])
    for document in metadata.get("related_documents") or []:
        if isinstance(document, dict) and document.get("url"):
            candidates.append(document["url"])
    seen = set()
    for url in candidates:
        if not isinstance(url, str) or url in seen:
            continue
        seen.add(url)
        parsed = urlsplit(url)
        if (parsed.path.lower().endswith(".pdf") and _validate_candidate(url, hosts)):
            yield url


def _replace_with_official_pdf(item, pdf_bytes, pdf_url, source_id):
    if len(pdf_bytes) > 5_000_000:
        raise CollectionError("official_pdf_response_too_large")
    from pypdf import PdfReader
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes), strict=True)
        if reader.is_encrypted or not 1 <= len(reader.pages) <= 300:
            raise CollectionError("official_pdf_page_or_encryption_limit")
    except CollectionError:
        raise
    except Exception as error:
        raise CollectionError("official_pdf_preflight_failed:" + type(error).__name__) from None
    extracted = extract_pdf(pdf_bytes, pdf_url)
    body = "\n\n".join(page["text"].strip() for page in extracted["pages"] if page.get("text", "").strip())
    if not body:
        raise CollectionError("official_pdf_text_missing_or_ocr_required")
    metadata = item.setdefault("metadata", {})
    metadata.update({
        "html_body_characters": len(item.get("content_text", "")),
        "parser_version": source_id + "-verified-pdf-v1",
        "read_scope": "official_linked_pdf_text",
        "pdf_url": pdf_url,
        "pdf_pages": extracted["pages"],
        "pdf_extraction_method": "pypdf",
        "pdf_ocr_performed": False,
        "requires_review": True,
        "ai_ready": False,
    })
    related = list(metadata.get("related_documents", []))
    for document in related:
        if document.get("url") == pdf_url:
            document["read"] = True
    known = {document.get("url") for document in related}
    related.extend(document for document in extracted["related_documents"]
                   if document.get("url") not in known)
    metadata["related_documents"] = related
    metadata["unread_attachments"] = [
        document["url"] for document in related
        if document.get("read") is not True and document.get("url")
    ]
    item["content_text"] = body
    import hashlib
    item["content_hash"] = hashlib.sha256(body.encode("utf-8")).hexdigest()


def _next_page(adapter, html, final_url, since):
    function = getattr(adapter, "next_page_url", None)
    if function is None:
        return None
    parameters = inspect.signature(function).parameters
    if "since" in parameters:
        return function(html, final_url, since=since)
    return function(html, final_url)


def collect_source(source_id, since, until, *, client=None, max_pages=None, max_items=None):
    """Collect matching official pages without writing to the database."""
    since_date = date.fromisoformat(since)
    until_date = date.fromisoformat(until)
    if since_date > until_date:
        raise ValueError("since_must_not_exceed_until")
    adapter = _adapter(source_id)
    hosts = HOSTS[source_id]
    client = client or SafeScraplingClient(hosts)
    if hasattr(adapter, "listing_urls"):
        initial = adapter.listing_urls(since, until)
    else:
        initial = [getattr(adapter, "LISTING_URL", None)
                   or getattr(adapter, "CAC_LISTING", None)
                   or LISTINGS[source_id]]
    if not isinstance(initial, list) or not initial:
        raise CollectionError("source_listing_urls_empty")

    queue = list(initial)
    queued = set(queue)
    visited = set()
    item_by_url = {}
    detail_seen = set()
    result = {
        "source": source_id,
        "since": since,
        "until": until,
        "status": "partial",
        "coverage_complete": False,
        "pages": 0,
        "discovered": 0,
        "out_of_range": 0,
        "details_attempted": 0,
        "items": [],
        "errors": [],
        "transport": "upstream_scrapling_fetcher",
        "database_writes": False,
    }
    while queue:
        page_url = queue.pop(0)
        if page_url in visited:
            continue
        if max_pages is not None and result["pages"] >= max_pages:
            result["errors"].append({"url": page_url, "reason": "explicit_page_limit_reached"})
            break
        if not _validate_candidate(page_url, hosts):
            result["errors"].append({"url": page_url, "reason": "listing_url_outside_allowlist"})
            continue
        visited.add(page_url)
        try:
            body, final_url, content_type = client.get(page_url)
            if content_type not in ("text/html", "application/xhtml+xml", "application/rss+xml", "application/xml", "text/xml"):
                raise CollectionError("unsupported_listing_content_type:" + (content_type or "unknown"))
            html = body.decode("utf-8", "replace")
            rows = adapter.parse_listing(source_id, html, final_url)
            result["pages"] += 1
            result["discovered"] += len(rows)
        except (FetchFailure, CollectionError, ValueError) as error:
            result["errors"].append({"url": page_url, "reason": str(error)[:240]})
            continue

        next_url = None
        try:
            next_url = _next_page(adapter, html, final_url, since)
        except ValueError as error:
            result["errors"].append({"url": page_url, "reason": str(error)[:240]})
        if next_url and next_url not in visited and next_url not in queued:
            queue.append(next_url)
            queued.add(next_url)

        for row in rows:
            url = row.get("url")
            if not isinstance(url, str) or not _validate_candidate(url, hosts):
                result["errors"].append({"url": str(url)[:240], "reason": "candidate_url_outside_allowlist"})
                continue
            if url in item_by_url:
                continue
            if url in detail_seen:
                continue
            window = _in_range(row, since, until)
            if window is False:
                result["out_of_range"] += 1
                continue
            if max_items is not None and len(detail_seen) >= max_items:
                result["errors"].append({"url": url, "reason": "explicit_item_limit_reached"})
                queue.clear()
                break
            result["details_attempted"] += 1
            detail_seen.add(url)
            try:
                detail_bytes, detail_url, detail_type = client.get(url)
                detail_html = detail_bytes.decode("utf-8", "replace")
                item = adapter.parse_detail(source_id, detail_html, detail_url, row)
                if not isinstance(item, dict) or not item.get("content_text"):
                    raise CollectionError("adapter_returned_empty_item")
                # A linked official PDF is the primary document when present;
                # parse it with pypdf instead of keeping only an HTML teaser.
                # Only exact PDF links surfaced by the source-specific parser
                # are followed, and each request still passes robots/host checks.
                for pdf_url in _pdf_urls(item, hosts):
                    try:
                        pdf_bytes, pdf_final, pdf_type = client.get(pdf_url)
                        if pdf_type != "application/pdf" and not pdf_bytes.startswith(b"%PDF-"):
                            raise CollectionError("linked_asset_not_pdf")
                        if source_id == "oecd":
                            item = adapter.extract_pdf(
                                pdf_bytes, pdf_final,
                                {"html_item": item, "title": row.get("title", "")},
                            )
                            for document in item.get("metadata", {}).get("related_documents", []):
                                if document.get("url") == pdf_final:
                                    document["read"] = True
                        else:
                            _replace_with_official_pdf(item, pdf_bytes, pdf_final, source_id)
                        break
                    except (FetchFailure, CollectionError, ValueError) as error:
                        item.setdefault("metadata", {}).setdefault("pdf_errors", []).append(
                            {"url": pdf_url, "reason": str(error)[:200]})
                        # Keep the verified HTML/abstract, but do not hide that
                        # its linked primary PDF remains unread.
                        break
                # Vietnam relevance is checked against the detail body so a
                # title-only filter cannot hide the known Decree 363 article.
                if source_id == "vn-gov" and not item.get("metadata", {}).get("privacy_relevant"):
                    continue
                item["metadata"].update({
                    "collector": "scrapling-separate-v1",
                    "collector_transport": "scrapling.fetchers.Fetcher",
                    "source_listing_url": final_url,
                    "database_writes": False,
                })
                if not item.get("published_date") and window is None:
                    item["metadata"]["requires_review"] = True
                    item["metadata"]["ai_ready"] = False
                    item["metadata"]["date_range_status"] = "unknown_date_retained_for_review"
                item_by_url[url] = {"url": url, **item}
            except (FetchFailure, CollectionError, ValueError) as error:
                # OECD's official RSS API is a verified alternative source.
                # If its linked article is blocked, retain only the publisher's
                # explicit feed excerpt and keep that scope visible.
                if source_id == "oecd" and row.get("feed_text"):
                    try:
                        item = adapter.parse_detail(source_id, "", url, row)
                        item["metadata"]["detail_fetch_error"] = str(error)[:200]
                        item["metadata"].update({
                            "collector": "scrapling-separate-v1",
                            "collector_transport": "scrapling.fetchers.Fetcher",
                            "source_listing_url": row.get("source_feed_url"),
                            "database_writes": False,
                        })
                        item_by_url[url] = {"url": url, **item}
                    except (CollectionError, ValueError) as fallback_error:
                        result["errors"].append({"url": url, "reason": str(fallback_error)[:240]})
                else:
                    result["errors"].append({"url": url, "reason": str(error)[:240]})

    result["items"] = list(item_by_url.values())
    result["requests"] = getattr(client, "requests", None)
    result["robots_requests"] = getattr(client, "robots_requests", None)
    result["downloaded_bytes"] = getattr(client, "bytes_received", None)
    # Only PCPD's exact inclusive daily-archive enumeration proves its tested
    # date window was fully visited. A page with no next link elsewhere is not
    # evidence that the source archive is exhaustive.
    result["coverage_complete"] = (
        source_id == "hk-pcpd" and not result["errors"]
        and len(visited) == len(initial)
    )
    if result["items"]:
        result["status"] = "success" if result["coverage_complete"] else "partial"
    elif result["pages"] and result["discovered"] == 0 and not result["errors"]:
        result["status"] = "empty_window" if source_id == "hk-pcpd" else "no_candidates"
    elif result["pages"] and result["details_attempted"] == 0 and result["discovered"]:
        result["status"] = "no_in_range_candidates"
    elif result["pages"] and result["out_of_range"] and not result["errors"]:
        result["status"] = "no_in_range_candidates"
    else:
        result["status"] = "failed" if result["errors"] else "empty_window"
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="Separate read-only Scrapling collectors")
    parser.add_argument("--source", choices=["all", *sorted(ADAPTERS)], default="all")
    parser.add_argument("--since", required=True)
    parser.add_argument("--until", required=True)
    parser.add_argument("--output", type=Path, default=Path("work/scrapling-collector-result.json"))
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--max-items", type=int)
    args = parser.parse_args(argv)
    date.fromisoformat(args.since)
    date.fromisoformat(args.until)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    selected = sorted(ADAPTERS) if args.source == "all" else [args.source]
    report = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "method": "Scrapling upstream Fetcher; robots-aware; minimum 5 seconds per host",
        "results": [],
    }
    for source_id in selected:
        try:
            report["results"].append(collect_source(source_id, args.since, args.until,
                                                    max_pages=args.max_pages,
                                                    max_items=args.max_items))
        except Exception as error:
            report["results"].append({"source": source_id, "status": "failed",
                                      "coverage_complete": False,
                                      "errors": [{"reason": type(error).__name__ + ":" + str(error)[:200]}],
                                      "database_writes": False})
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = [{key: value for key, value in item.items() if key != "items"} | {"item_count": len(item.get("items", []))}
               for item in report["results"]]
    print(json.dumps({"output": str(args.output), "results": summary}, ensure_ascii=False))
    return 1 if any(result["status"] in ("failed", "partial") for result in report["results"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
