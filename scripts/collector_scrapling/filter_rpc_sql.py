"""Build safe SQL calls for Codex's connected Supabase SQL tool.

Inputs are JSON files containing identifiers and classification metadata only.
The entire JSON payload is base64 encoded, so article text and quoted values are
never interpolated into SQL syntax.
"""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path


def build_sql(mode: str, payload: dict) -> str:
    if not isinstance(payload, dict):
        raise ValueError("payload_must_be_object")
    encoded = base64.b64encode(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")
    cte = "with payload as (select convert_from(decode('" + encoded + "','base64'),'UTF8')::jsonb as j)\n"
    if mode == "decision":
        required = ("run_id", "source_item_id", "revision_id", "input_hash", "decision", "reason", "filter_version")
        if any(not payload.get(key) for key in required):
            raise ValueError("filter_decision_payload_missing_field")
        if "content_text" in payload or "body" in payload or "article" in payload:
            raise ValueError("source_text_must_not_be_sent_to_sql_tool")
        return cte + "select public.record_scrapling_filter_decision(\n" + ",\n".join([
            "  (j->>'run_id')::uuid",
            "  (j->>'source_item_id')::uuid",
            "  (j->>'revision_id')::uuid",
            "  j->>'input_hash'",
            "  j->>'decision'",
            "  nullif(j->>'matched_source_item_id','')::uuid",
            "  nullif(j->>'matched_report_id','')::uuid",
            "  j->>'match_method'",
            "  j->>'reason'",
            "  j->>'filter_version'",
            "  coalesce(j->'metadata','{}'::jsonb)",
        ]) + ") from payload;"
    if mode == "writer":
        required = ("run_id", "execution_id", "started_at", "finished_at", "status", "result")
        if any(key not in payload for key in required):
            raise ValueError("writer_run_payload_missing_field")
        if not isinstance(payload["result"], dict):
            raise ValueError("writer_run_result_must_be_object")
        return cte + "select public.record_scrapling_writer_run(\n" + ",\n".join([
            "  (j->>'run_id')::uuid",
            "  j->>'execution_id'",
            "  (j->>'started_at')::timestamptz",
            "  (j->>'finished_at')::timestamptz",
            "  j->>'status'",
            "  j->'result'",
        ]) + ") from payload;"
    raise ValueError("unsupported_rpc_mode")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("decision", "writer"), required=True)
    parser.add_argument("--input", type=Path, required=True)
    args = parser.parse_args(argv)
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    print(build_sql(args.mode, payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
