# Daily Codex task: Scrapling filtering and Korean drafts

Run at 05:00 Asia/Seoul as the account's cloud Codex scheduled task, independent of the user's PC and desktop app. Treat a run as confirmed Codex Cloud when its Cloud Environment status reports `provider=cloud`, `running`, and `connected`, and the repository checkout or connected GitHub repository is verified as `parksunup/globaltrend`. The status may expose only an environment configuration ID instead of its display name. Do not require a per-run automation ID or `last_run`/`latest_result` field; these may be absent when a scheduled prompt resumes an existing cloud chat. The schedule's Cloud label alone is insufficient. Do not require a local shell or desktop worktree. A generic ChatGPT scheduled run or regular local Codex conversation does not count. If the active run cannot establish the Cloud provider state and the `parksunup/globaltrend` repository connection, or the connected GitHub or Supabase tools are unavailable, stop without writes and leave work pending. Use only this cloud run's connected GitHub and Supabase tools and the user's Codex subscription. Do not use the OpenAI API, another model API, or an API key. Do not approve or publish reports. Submit only through `submit_trend_draft` so the item appears as an unreviewed draft in `/work`.

The cloud run may not have a repository shell. The database is authoritative for draft sealing and submission validation through `collector_seal_trend_draft` and `submit_trend_draft`; do not require local Node.js or a desktop worktree for a scheduled run. Keep the full draft in the task's working context until the RPC returns. Do not commit draft text to GitHub.

## Fail-closed startup

1. Read `AGENTS.md`, `docs/trend-report-style.md`, `docs/trend-reference-reading-notes.md`, `docs/translation/glossary.md`, `docs/trend-draft-worker.md`, `docs/collector-daily-task.md`, and `config/trend-writing-policy.json` through the connected GitHub repository. If any required current file is unavailable, stop without writes.
2. Through Supabase, verify `scrapling_collection_runs`, `scrapling_filter_decisions`, and these functions exist: `record_scrapling_writer_run`, `record_scrapling_filter_decision`, `collector_writing_policy`, `collector_source_allowed`, `collector_retain_for_draft`, `collector_claim_retained_draft`, `collector_seal_trend_draft`, `submit_trend_draft`, and `fail_trend_draft`. Stop without writes if the migration is absent.
3. Compare `collector_writing_policy()` with the repository's `config/trend-writing-policy.json`. If the policy ID or any instruction hash differs, record no filter acceptance or draft submission; leave the items pending.
4. Find all unfiltered Scrapling revisions, not just one source or day. Scope items by `source_items.metadata->>'collector'='scrapling-separate-v1'`, use `current_revision_id`, and exclude revisions already present in `scrapling_filter_decisions`. Join revisions and collection runs. Respect current source approval and `collector_capacity()` before writes. Hold any source without an active, terms-reviewed `sources` row; do not create or approve its source record.
5. Start a `record_scrapling_writer_run` lease for each eligible collection run. If the repository shell is unavailable, send only the run UUID, execution ID, timestamps, status, and summary JSON to the RPC. Do not put article text, titles, URLs, secrets, or full metadata into this run record.

## Duplicate and relevance filter

For each current revision, read the complete extracted text and metadata. Compare it with **all** other source items/revisions and existing reports, not just this run's six sources:

- Exact canonical URL or identical full-text SHA-256: `exact_duplicate`.
- Same official announcement or event reproduced by another source/language: `same_event_duplicate` only when the full text, issuing body, event/date, named parties, and substantive action confirm it. Save the matched source item or report ID and the comparison reason.
- Different follow-up, correction, final decision, new date, changed measure, or materially new facts: retain separately and describe the relationship in decision metadata.
- Clearly outside privacy/data-protection scope: `irrelevant` with a short factual reason.
- Ambiguous match, missing body, unresolved publication-date conflict, unreviewed source, material unread PDF, or insufficient evidence: `needs_review` or `source_held`; do not send it to drafting.
- Unique, clearly relevant, complete enough for the actual body scope, date verified, source approved: `accepted`.

Do not treat title similarity alone as proof of duplication. For RSS abstracts or short notices, write only within the actual read scope; if there is not enough evidence for a useful sourced draft, use `needs_review`. Do not invent missing details.

Record each decision with the current item/revision/hash, `scrapling_run_id`, matched IDs, `filter_version='scrapling-dedup-v1'`, and reason. Use a single JSONB literal with a fresh dollar-quote delimiter to call `record_scrapling_filter_decision`. Choose a delimiter that does not occur anywhere in the serialized JSON and verify that before calling Supabase. The decision JSON may contain IDs, hashes, decision code, short reason, and minimal match metadata only; it must not contain article text, title, URL, or full source metadata. The RPC performs the existing retention handoff only for `accepted` items.

## Draft writing and submission

After filtering the complete eligible pool, repeatedly claim only retained jobs using `collector_claim_retained_draft(worker)`. Use a stable per-run worker name, one item at a time. Do not use a broad pending-job claim.

For each claim:

1. Preserve the exact current revision, input hash, instruction version, and lease. Read the full official body and material linked official documents. Read the current style guide, reference notes, glossary, and type-specific review requirements from GitHub.
2. Draft the Korean report directly with Codex. Cite only evidence present in the claimed revision. Distinguish issuing-organization statements from analysis; preserve dates, units, legal stages, scope, exceptions, and limitations. Do not use an API-generated draft.
3. Fill every `writing_review` field with the actual source reading, linked-document classification, evidence-backed coverage, and substantive editorial review. Never use checkboxes or TODO text as review evidence.
4. Submit using one Supabase statement that passes the complete JSON draft as a JSONB value to `collector_seal_trend_draft`, then passes the returned sealed JSONB to `submit_trend_draft`. Use a newly generated dollar-quote delimiter and confirm the exact delimiter string is absent from the serialized JSON before executing. The delimiter must surround a single JSON literal; source text must remain data and must not become SQL syntax. The sealer records the SHA-256 for title/summary/details. The existing submission RPC validates policy/version/source binding, evidence quotes, complete linked-material review, editorial coverage, report format, active lease, source approval, storage capacity, and the no-overwrite guard. If any check fails, the statement must fail atomically; fix the draft or leave the item pending. Do not claim success from sealing alone.
5. Re-query `reports` and `publication_working_copies` and verify the saved `draft`, `human_reviewed=false`, `published_at is null`, exact source revision, review record, and full text match. Do not approve, publish, alter a prior report, or make the draft public.

If an item already has a report or submitted job, do not resubmit. If an eligible pool is empty, finish with `idle` and no draft. Keep ambiguous items in review and include their count in the writer result.

## Close and audit

For every collection run handled, write `record_scrapling_writer_run` with the same Codex execution ID, start/end times, final status (`idle`, `complete`, `partial`, or `failed`), and a JSON summary containing only counts, run IDs, filter decision IDs, draft job/report IDs, validation outcomes, and blockers. Do not include article text, titles, URLs, or secrets. A completed cloud task does not prove complete source coverage or human approval.

Normal successful runs need no manual response. Keep unresolved source approvals, policy drift, failed validation, incomplete drafts, or incomplete source coverage visible as blockers; do not change gates to force success.
