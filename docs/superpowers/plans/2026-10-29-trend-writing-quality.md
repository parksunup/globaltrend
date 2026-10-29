# Korean Writing Quality Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; independent review before release.

**Goal:** Make the supplied reference-based style guide a required and traceable part of every automated Korean submission.

**Architecture:** Versioned source packet + substantive review record + checksum-bound client/server submission guard, all on the existing Codex/DB pipeline.

**Tech Stack:** Node/TypeScript, Postgres, existing automations.

**Spec:** docs/superpowers/specs/2026-10-29-trend-writing-quality-design.md

## Global Constraints
- No paid generation API, automatic publishing or bulk overwrite of reports.
- Existing18/daily3/weekly8 and EDPS/EUR-Lex holds preserved.
- Reference articles supply style examples only; current official sources supply facts.
- No mandatory article length, fixed number of bullets or forced headings.

## Review Focus
- Missing or stale review, wrong source revision/hash, or changed draft text must fail.
- Coverage needs evidence references or specific absence reasons, not booleans alone.
- Inaccessible material attachments cannot become successful complete reading.
- Short genuine announcements remain possible with source-grounded rationale.
- Existing leases, evidence quote checks, historical reports and editorial approval remain intact.

### Task1: Source materials and client contract
- [ ] Read supplied guide/analysis/editorial note, catalogue48 PDFs and verify selected original passages.
- [ ] Add config/trend-writing-policy.json and docs/trend-reference-reading-notes.md; preserve private reference bytes outside repository.
- [ ] Write failing tests in tests/trend-writing-quality.test.mjs for digest/source/coverage/attachment failures and legitimate brevity.
- [ ] Add lib/trend-writing-quality.ts; extend scripts/trend-report.mjs with --packet, --seal, --check and --audit writing workflow.
- [ ] Run tests and audit all existing sample drafts without rewriting reports.

### Task2: Server enforcement and operations
- [ ] Add private review validator and collector_writing_policy RPC; patch existing submit RPC with exact checked replacements and retain review metadata.
- [ ] Update two synthetic DB fixtures and add pgTAP tests of missing/stale/changed review and successful unapproved report storage.
- [ ] Update worker/daily/web/weekly docs and automation prompts consistently.
- [ ] Independent review; fix findings and run CI, rollback DB validation, merge/deploy authorized changes and requery actual state.
