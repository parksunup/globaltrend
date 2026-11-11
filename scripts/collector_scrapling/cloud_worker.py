"""Run the separate Scrapling collectors in a cloud runner and ingest centrally.

No model/API calls are made here. Exact URL/revision idempotency uses the
existing ingest_source_item contract. Korean relevance and cross-source event
deduplication remain a separate Codex filter step before retained drafting.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from zoneinfo import ZoneInfo

from .runner import collect_source


ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "scripts" / "collector-scrapling" / "registry.json"
RPC_ALLOWLIST = {
    "collector_source_allowed",
    "collector_capacity",
    "ingest_source_item",
    "record_scrapling_collection_run",
}
DOCUMENT_TYPES = {
    "news", "press_release", "guidance", "decision", "judgment",
    "opinion", "report", "legislation", "other",
}


class WorkerError(RuntimeError):
    pass


def credentials(environ=None):
    env = os.environ if environ is None else environ
    base = (env.get("SUPABASE_URL") or "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    parsed = urllib.parse.urlsplit(base)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise WorkerError("supabase_url_missing_or_invalid")
    if not key or key.startswith("sb_publishable_"):
        raise WorkerError("supabase_secret_key_required")
    return base, key


def rpc_call(name, args, *, environ=None, opener=urllib.request.urlopen):
    if name not in RPC_ALLOWLIST:
        raise WorkerError("rpc_not_allowed")
    base, key = credentials(environ)
    headers = {"apikey": key, "Content-Type": "application/json", "Accept": "application/json"}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = "Bearer " + key
    request = urllib.request.Request(
        base + "/rest/v1/rpc/" + name,
        data=json.dumps(args, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        method="POST",
        headers=headers,
    )
    try:
        with opener(request, timeout=30) as response:
            payload = response.read()
    except urllib.error.HTTPError as error:
        raise WorkerError(name + "_http_" + str(error.code)) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise WorkerError(name + "_network_error") from None
    try:
        return json.loads(payload.decode("utf-8")) if payload else None
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise WorkerError(name + "_invalid_json_response") from None


def source_row_gate(source_id, *, environ=None, opener=urllib.request.urlopen):
    """Read only the authoritative source approval fields when the gate RPC says false.

    This is a fail-closed diagnostic/fallback for mismatches between the RPC and
    the row it evaluates. It never infers approval from registry configuration.
    """
    base, key = credentials(environ)
    query = urllib.parse.urlencode({
        "select": "id,is_active,terms_reviewed_at",
        "id": "eq." + str(source_id),
    })
    headers = {"apikey": key, "Accept": "application/json"}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = "Bearer " + key
    request = urllib.request.Request(base + "/rest/v1/sources?" + query, headers=headers)
    try:
        with opener(request, timeout=30) as response:
            payload = response.read()
    except urllib.error.HTTPError as error:
        raise WorkerError("source_gate_row_http_" + str(error.code)) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise WorkerError("source_gate_row_network_error") from None
    try:
        rows = json.loads(payload.decode("utf-8")) if payload else None
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise WorkerError("source_gate_row_invalid_json") from None
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
        raise WorkerError("source_gate_row_not_found_or_ambiguous")
    row = rows[0]
    if row.get("id") != str(source_id):
        raise WorkerError("source_gate_row_id_mismatch")
    active = row.get("is_active") is True
    terms_reviewed = row.get("terms_reviewed_at") is not None
    return {"row_found": True, "is_active": active,
            "terms_reviewed": terms_reviewed, "allowed": active and terms_reviewed}


def daily_window(now=None, timezone="Asia/Seoul", lookback_days=3):
    current = (now or dt.datetime.now(ZoneInfo(timezone))).astimezone(ZoneInfo(timezone)).date()
    if lookback_days < 1 or lookback_days > 14:
        raise WorkerError("lookback_days_out_of_range")
    return (current - dt.timedelta(days=lookback_days - 1)).isoformat(), current.isoformat()


def _normalize_item(source, row, run_id, fetched_at):
    url = row.get("url")
    title = row.get("title_original")
    content = row.get("content_text")
    if not isinstance(url, str) or not isinstance(title, str) or not title.strip():
        raise WorkerError("scrapling_item_identity_missing")
    if not isinstance(content, str) or len(content.strip()) < 10:
        raise WorkerError("scrapling_item_body_missing")
    if len(content) > 80_000:
        raise WorkerError("scrapling_item_body_over_limit")
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    if row.get("content_hash") and row["content_hash"] != content_hash:
        raise WorkerError("scrapling_item_hash_mismatch")
    metadata = dict(row.get("metadata") or {})
    metadata.update({
        "collector": "scrapling-separate-v1",
        "collector_transport": "scrapling.fetchers.Fetcher",
        "scrapling_run_id": run_id,
        "database_persisted": True,
        "date_conflict": bool(metadata.get("date_conflict")),
    })
    value = row.get("published_date")
    try:
        published_at = dt.date.fromisoformat(value).isoformat() + "T00:00:00Z" if value else None
    except (TypeError, ValueError):
        published_at = None
    document_type = metadata.get("document_type", "press_release")
    if document_type not in DOCUMENT_TYPES:
        document_type = "press_release"
    return {
        "p_source_id": source["source_id"],
        "p_external_id": None,
        "p_canonical_url": url,
        "p_title_original": title.strip(),
        "p_published_at": published_at,
        "p_event_date": None,
        "p_fetched_at": fetched_at,
        "p_language_code": source["language"],
        "p_document_type": document_type,
        "p_content_text": content,
        "p_content_hash": content_hash,
        "p_raw_storage_path": None,
        "p_metadata": metadata,
        "p_instruction_version": "trend-ko-v1",
    }


def _capacity_ok(call_rpc):
    result = call_rpc("collector_capacity", {})
    if not isinstance(result, dict) or result.get("can_write") is not True:
        raise WorkerError("database_storage_capacity_not_verified")


def run(*, now=None, registry_path=REGISTRY_PATH, call_rpc=rpc_call,
        collect=collect_source, source_status=source_row_gate, execution_id=None, git_sha=None):
    registry = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    run_id = str(uuid.uuid4())
    execution_id = execution_id or "scrapling-gha-" + uuid.uuid4().hex
    started = dt.datetime.now(dt.timezone.utc)
    started_text = started.isoformat()
    since, until = daily_window(
        now=now,
        timezone=registry.get("timezone", "Asia/Seoul"),
        lookback_days=registry.get("lookback_days", 3),
    )
    start_record = call_rpc("record_scrapling_collection_run", {
        "p_id": run_id,
        "p_execution_id": execution_id,
        "p_range_start": since,
        "p_range_end": until,
        "p_started_at": started_text,
        "p_finished_at": started_text,
        "p_status": "running",
        "p_git_sha": git_sha,
        "p_result": {"collector": "scrapling-separate-v1", "state": "starting"},
    })
    if not isinstance(start_record, dict) or start_record.get("run_id") != run_id:
        raise WorkerError("scrapling_run_start_not_confirmed")
    per_source = []
    any_failure = False
    any_partial = False
    for source in registry["sources"]:
        slug = source["source"]
        outcome = {"source": slug, "source_id": source["source_id"], "status": "held", "reason": None,
                   "discovered": 0, "saved": 0, "new": 0, "changed": 0,
                   "duplicate": 0, "errors": []}
        try:
            allowed = call_rpc("collector_source_allowed", {"p_source_id": source["source_id"]})
            if allowed is not True:
                try:
                    row_gate = source_status(source["source_id"])
                    outcome["source_gate_diagnostic"] = {
                        "rpc_allowed": False,
                        "row_allowed": row_gate.get("allowed") is True,
                        "row_found": row_gate.get("row_found") is True,
                        "is_active": row_gate.get("is_active") is True,
                        "terms_reviewed": row_gate.get("terms_reviewed") is True,
                    }
                    if row_gate.get("allowed") is not True:
                        outcome["reason"] = "source_not_active_or_terms_not_reviewed"
                        per_source.append(outcome)
                        continue
                    outcome["source_gate_fallback"] = "active_and_terms_reviewed_row"
                except WorkerError as error:
                    outcome["reason"] = "source_gate_rpc_false_and_row_check_failed"
                    outcome["errors"].append(str(error))
                    per_source.append(outcome)
                    any_failure = True
                    continue
            _capacity_ok(call_rpc)
            report = collect(
                slug, since, until,
                max_pages=registry.get("max_pages_per_source", 10),
                max_items=registry.get("max_items_per_source", 30),
            )
            outcome.update({
                "status": report.get("status", "failed"),
                "discovered": report.get("discovered", 0),
                "pages": report.get("pages", 0),
                "details_attempted": report.get("details_attempted", 0),
                "coverage_complete": report.get("coverage_complete", False),
                "errors": [e.get("reason", "unknown") for e in report.get("errors", [])],
            })
            if outcome["status"] == "partial":
                any_partial = True
            if outcome["status"] == "failed":
                any_failure = True
            for item in report.get("items", []):
                try:
                    _capacity_ok(call_rpc)
                    args = _normalize_item(source, item, run_id, dt.datetime.now(dt.timezone.utc).isoformat())
                    saved = call_rpc("ingest_source_item", args)
                    row = saved[0] if isinstance(saved, list) and saved else saved
                    if not isinstance(row, dict):
                        raise WorkerError("ingest_response_invalid")
                    outcome["saved"] += 1
                    field = "new" if row.get("item_created") else "changed" if row.get("content_changed") else "duplicate"
                    outcome[field] += 1
                except WorkerError as error:
                    outcome["errors"].append(str(error))
                    any_failure = True
            if outcome["errors"]:
                any_failure = True
        except WorkerError as error:
            outcome["status"] = "failed"
            outcome["reason"] = str(error)
            any_failure = True
        except Exception as error:
            outcome["status"] = "failed"
            outcome["reason"] = "unexpected_" + type(error).__name__
            any_failure = True
        per_source.append(outcome)

    held = any(row["status"] == "held" for row in per_source)
    status = "failed" if any_failure and not any(row["saved"] for row in per_source) else "partial" if any_failure or any_partial or held else "complete"
    finished = dt.datetime.now(dt.timezone.utc)
    summary = {
        "collector": "scrapling-separate-v1",
        "database_writes": True,
        "filtering": "pending_codex_duplicate_and_relevance_review",
        "sources": per_source,
    }
    result = call_rpc("record_scrapling_collection_run", {
        "p_id": run_id,
        "p_execution_id": execution_id,
        "p_range_start": since,
        "p_range_end": until,
        "p_started_at": started_text,
        "p_finished_at": finished.isoformat(),
        "p_status": status,
        "p_git_sha": git_sha,
        "p_result": summary,
    })
    if not isinstance(result, dict) or result.get("run_id") != run_id:
        raise WorkerError("scrapling_run_record_not_confirmed")
    return {"run_id": run_id, "execution_id": execution_id, "since": since,
            "until": until, "status": status, "sources": per_source}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execution-id")
    parser.add_argument("--git-sha", default=os.environ.get("GITHUB_SHA"))
    args = parser.parse_args(argv)
    try:
        result = run(execution_id=args.execution_id, git_sha=args.git_sha)
    except WorkerError as error:
        print(json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 1 if result["status"] == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
