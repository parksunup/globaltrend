# Collector Web Fallback Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; implement inline, independent review at the end.

**Goal:** Four held sources receive actual scheduled web discovery, evidence-gated ingest and Korean production handoff.

**Architecture:** Web access remains with the scheduled ChatGPT agent. A private SQL RPC validates source, official paths, explicit date, complete-body evidence and content hash, then delegates to existing ingest. Existing events store every web attempt including failed URLs; no new queue/table. Edge enqueue/take exclude web executors.

**Tech Stack:** Python 3, Postgres, existing ChatGPT automation and web search tools.

**Spec:** docs/superpowers/specs/2026-10-29-collector-web-design.md

## Global Constraints
- Daily three Korean calendar dates; weekly approximately eight completed Korean reports.
- No automatic public publication, no paid API, no source/cursor resets.
- Discovery and failed body access never equal completed collection.

## Review Focus
- Third-party host, encoded path tricks and legal-full-text routes rejected.
- Search snippet/challenge/undated content rejected; RSS brief cannot claim full underlying text.
- Web rows never enter Edge/Python queues.
- Date windows, revision deduplication, storage and existing source gates preserved.
- Failed discovery is recorded as partial, never successful no-material or coverage=true.

### Task 1: Evidence adapter and private ingest
- [ ] Add tests/test_collector_web.py rejecting wrong hosts, scopes, dates, snippets and challenges; run red.
- [ ] Add config/collector-web.json and scripts/collector/web.py with normalize_document(source,document,since,until) producing existing ingest arguments.
- [ ] Add additive SQL migration with collector_web_ingest(text,jsonb,text) and collector_web_record_attempt(text,date,date,jsonb,text); private grants only and web routing exclusions.
- [ ] Add pgTAP tests for hostile inputs, valid rollback ingest and no public RPC grants; run green.

### Task 2: Operational integration
- [ ] Update four registry/config entries with conditional web status, explicit limitations, paths and official fallback hosts.
- [ ] Document current source results and exact execution contract in docs/collector-web-task.md.
- [ ] Run Python suite and CI, obtain independent review, publish PR; apply with prior deployment authorization.
- [ ] Update existing daily/weekly prompts to tested merged SHA and 12 Edge + 4 Python + 4 web attempts. Requery actual DB and automation state. Do not claim first scheduled run complete.
