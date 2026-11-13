"""Scheduled DB writer for the new OECD WebCMS RSS collector."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import uuid

from .collector import collect_window
from scripts.collector_scrapling.cloud_worker import (
    WorkerError,
    _capacity_ok,
    daily_window,
    rpc_call,
    source_row_gate,
)


SOURCE = {
    "source": "oecd",
    "source_id": "50ec0b84-7c04-4f85-895e-50bf43219a98",
    "language": "en",
}


def _item_rpc(item, run_id, fetched_at):
    body = item["content_text"]
    metadata = dict(item.get("metadata") or {})
    metadata.update({"oecd_run_id": run_id, "database_persisted": True})
    published = item.get("published_date")
    try:
        published_at = dt.date.fromisoformat(published).isoformat() + "T00:00:00Z" if published else None
    except (TypeError, ValueError):
        published_at = None
    return {
        "p_source_id": SOURCE["source_id"],
        "p_external_id": None,
        "p_canonical_url": item["url"],
        "p_title_original": item["title_original"],
        "p_published_at": published_at,
        "p_event_date": None,
        "p_fetched_at": fetched_at,
        "p_language_code": SOURCE["language"],
        "p_document_type": "report" if item.get("metadata", {}).get("read_scope") == "official_linked_pdf_text" else "press_release",
        "p_content_text": body,
        "p_content_hash": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        "p_raw_storage_path": None,
        "p_metadata": metadata,
        "p_instruction_version": "trend-ko-v1",
    }


def run(*, now=None, call_rpc=rpc_call, source_status=source_row_gate, collect=collect_window,
        execution_id=None, git_sha=None):
    run_id = str(uuid.uuid4())
    execution_id = execution_id or "oecd-webcms-rss-gha-" + uuid.uuid4().hex
    started = dt.datetime.now(dt.timezone.utc)
    since_override = os.environ.get("COLLECTOR_SINCE")
    until_override = os.environ.get("COLLECTOR_UNTIL")
    if bool(since_override) != bool(until_override):
        raise WorkerError("collection_window_requires_both_dates")
    if since_override:
        try:
            since = dt.date.fromisoformat(since_override).isoformat()
            until = dt.date.fromisoformat(until_override).isoformat()
        except ValueError:
            raise WorkerError("collection_window_date_invalid") from None
        if since > until:
            raise WorkerError("collection_window_order_invalid")
    else:
        since, until = daily_window(now=now, lookback_days=3)
    start_result = call_rpc("record_scrapling_collection_run", {
        "p_id": run_id,
        "p_execution_id": execution_id,
        "p_range_start": since,
        "p_range_end": until,
        "p_started_at": started.isoformat(),
        "p_finished_at": started.isoformat(),
        "p_status": "running",
        "p_git_sha": git_sha or os.environ.get("GITHUB_SHA"),
        "p_result": {"collector": "oecd-webcms-rss-v2", "state": "starting"},
    })
    if not isinstance(start_result, dict) or start_result.get("run_id") != run_id:
        raise WorkerError("oecd_run_start_not_confirmed")

    output = {"run_id": run_id, "execution_id": execution_id, "since": since, "until": until,
              "status": "held", "source": SOURCE["source"], "source_id": SOURCE["source_id"],
              "discovered": 0, "saved": 0, "new": 0, "changed": 0, "duplicate": 0,
              "errors": []}
    try:
        allowed = call_rpc("collector_source_allowed", {"p_source_id": SOURCE["source_id"]})
        if allowed is not True:
            gate = source_status(SOURCE["source_id"])
            output["source_gate_diagnostic"] = {
                "rpc_allowed": False,
                "row_allowed": gate.get("allowed") is True,
                "is_active": gate.get("is_active") is True,
                "terms_reviewed": gate.get("terms_reviewed") is True,
            }
            if gate.get("allowed") is not True:
                output["status"] = "held"
                output["reason"] = "source_not_active_or_terms_not_reviewed"
            else:
                output["source_gate_fallback"] = "active_and_terms_reviewed_row"
                allowed = True
        if allowed is True:
            _capacity_ok(call_rpc)
            report = collect(since, until)
            output.update({key: report.get(key) for key in (
                "status", "pages", "discovered", "details_attempted", "out_of_range",
                "requests", "robots_requests", "downloaded_bytes", "errors") if key in report})
            now_text = dt.datetime.now(dt.timezone.utc).isoformat()
            for item in report.get("items", []):
                _capacity_ok(call_rpc)
                saved = call_rpc("ingest_source_item", _item_rpc(item, run_id, now_text))
                row = saved[0] if isinstance(saved, list) and saved else saved
                if not isinstance(row, dict):
                    raise WorkerError("oecd_ingest_response_invalid")
                output["saved"] += 1
                field = "new" if row.get("item_created") else "changed" if row.get("content_changed") else "duplicate"
                output[field] += 1
    except WorkerError as error:
        output["status"] = "failed"
        output["errors"] = list(output.get("errors") or []) + [str(error)]

    finished = dt.datetime.now(dt.timezone.utc)
    if output["status"] in {"success", "no_candidates"}:
        status = "complete"
    elif output["status"] == "held":
        status = "partial"
    else:
        status = output["status"]
    finish_result = call_rpc("record_scrapling_collection_run", {
        "p_id": run_id,
        "p_execution_id": execution_id,
        "p_range_start": since,
        "p_range_end": until,
        "p_started_at": started.isoformat(),
        "p_finished_at": finished.isoformat(),
        "p_status": status,
        "p_git_sha": git_sha or os.environ.get("GITHUB_SHA"),
        "p_result": {"collector": "oecd-webcms-rss-v2", "database_writes": True,
                      "filtering": "pending_codex_duplicate_and_relevance_review", "outcome": output},
    })
    if not isinstance(finish_result, dict) or finish_result.get("run_id") != run_id:
        raise WorkerError("oecd_run_finish_not_confirmed")
    output["status"] = status
    return output


def main():
    try:
        result = run()
    except WorkerError as error:
        print(json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 1 if result["status"] == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
