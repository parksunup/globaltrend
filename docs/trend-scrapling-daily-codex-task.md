# Daily Codex task: Scrapling filtering and Korean drafts

Run at 05:00 Asia/Seoul as a cloud Codex subscription automation, independent of the user's PC and desktop app. A local Codex automation or local cron is not an acceptable fallback. Use the cloud execution's authorized Supabase connection and the user's Codex account. Do not use the OpenAI API, any separate model API, or an API key. Do not publish or approve reports. Submit only through the existing draft RPC so the item appears as an unreviewed draft in `/work`. If this task is not running in a confirmed cloud automation with the required repository and database access, stop without writes and leave the job pending.

## Fail-closed startup

1. Read `AGENTS.md`, `docs/trend-report-style.md`, `docs/trend-reference-reading-notes.md`, `docs/translation/glossary.md`, `docs/trend-draft-worker.md`, `docs/collector-daily-task.md`, and `config/trend-writing-policy.json` from the project repository. If the project root does not contain these current files, stop without writes.
2. Through the connected Supabase tool, verify that `scrapling_collection_runs`, `scrapling_filter_decisions`, and these functions exist: `record_scrapling_writer_run`, `record_scrapling_filter_decision`, `collector_writing_policy`, `collector_source_allowed`, `collector_retain_for_draft`, `collector_claim_retained_draft`, and the existing draft submit/fail functions. If the migration is absent, stop without writes.
3. Compare `collector_writing_policy()` with `config/trend-writing-policy.json`. If the policy ID or hash differs, record no filter acceptance or draft submission; leave the items pending for a later run.
4. Find all unfiltered Scrapling revisions, not just one source or one day. Scope items by `source_items.metadata->>'collector'='scrapling-separate-v1'`, use `current_revision_id`, and exclude revisions that already have a row in `scrapling_filter_decisions`. Join their `source_item_revisions` and `scrapling_collection_runs`. Respect current source approval and `collector_capacity()` before any write. A source without an active `sources` row or reviewed terms is held; do not create its source record or alter its approval.
5. Start a `record_scrapling_writer_run` lease for each eligible collection run before processing it. Use the helper below to generate the SQL safely. Do not put article body text, titles, URLs, secrets, or full metadata into the SQL command. The Supabase connector receives only IDs, hashes, decision codes, a short reason, and minimal match metadata.

## Duplicate and relevance filter

For each current revision, read the complete extracted text and metadata. Compare with **all** other source items/revisions and existing reports, not just this run's six sources:

- Exact canonical URL or identical full-text SHA-256: `exact_duplicate`.
- Same official announcement or event reproduced by another source/language: `same_event_duplicate` only when the full text, issuing body, event/date, named parties, and substantive action confirm it. Save the matched source item or report ID and the comparison reason.
- Different follow-up, correction, final decision, new date, changed measure, or materially new facts: retain as a separate item and describe the relationship in decision metadata. Do not merge it away.
- Clearly outside privacy/data-protection scope: `irrelevant` with a short factual reason.
- Ambiguous match, missing body, unresolved publication-date conflict, unreviewed source, material unread PDF, or insufficient evidence: `needs_review` or `source_held`; do not send it to drafting.
- Unique, clearly relevant, complete enough for the actual body scope, date verified, source approved: `accepted`.

Do not treat title similarity alone as proof of duplication. For RSS abstracts or short notices, write only within the actual read scope; if there is not enough evidence to create a useful, sourced draft, use `needs_review`. Do not invent missing details.

Record every decision with the current item/revision/hash, `scrapling_run_id`, IDs for matches, `filter_version='scrapling-dedup-v1'`, and the reason. Use `scripts/collector_scrapling/filter_rpc_sql.py --mode decision --input work/scrapling-filter-decision.json` to build a base64-safe `record_scrapling_filter_decision` call, then execute the generated statement using the connected Supabase tool. The database permits a draft job only after an `accepted` decision; the RPC also performs the existing retention handoff.

## Draft writing and submission

After filtering the complete eligible pool, repeatedly claim only retained jobs using `collector_claim_retained_draft(worker)`. Use a stable per-run worker name, one item at a time. Do not use a broad pending-job claim for these items.

For each claim:

1. Preserve the exact current revision, input hash, instruction version, and lease. Read the full official body and material linked official documents. Read the current style guide, reference notes, glossary, and the worker's type-specific review requirements.
2. Draft the Korean report body directly with Codex. Cite only evidence present in the claimed revision. Distinguish the issuing organization's statements from analysis; preserve dates, units, legal stages, scope, exceptions, and limitations. Do not write an API-generated or public draft.
3. Save the complete payload under ignored `work/`, fill the real `writing_review`, then run both `node scripts/trend-report.mjs --seal <payload>` and `node scripts/trend-report.mjs --check <payload> --source <claim>`. Fix failures and rerun both checks.
4. Submit with the existing `submit_trend_draft` RPC only after the checks pass. On a failed attempt, use the existing fail RPC; never fabricate success or steal a live lease.
5. Re-query `reports` and `publication_working_copies` to verify a saved `draft`, `human_reviewed=false`, `published_at is null`, correct source revision and review record. Do not approve, publish, alter a prior report, or make the draft public.

If an item already has a report or a submitted job, do not re-submit. If the run finds no eligible new material, finish with `idle` and no draft. If any item remains ambiguous, keep it in review and report that count in the stored run result rather than silently discarding it.

## Close and audit

For each collection run handled, write `record_scrapling_writer_run` with the same Codex execution ID, start/end times, final status (`idle`, `complete`, `partial`, or `failed`) and JSON summary containing only counts, run IDs, filter decision IDs, draft job/report IDs, validation outcomes, and remaining blockers. Generate the call with `scripts/collector_scrapling/filter_rpc_sql.py --mode writer --input work/scrapling-writer-run.json`. Do not include article text or secrets. A completed Codex task is not proof of complete source coverage or human approval.

Normal successful runs need no manual response. Leave unresolved source approvals, policy hash changes, missing tooling, failed validation, and incomplete drafts visible as blockers; do not change their gates to force success.
