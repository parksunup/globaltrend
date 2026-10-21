# 2026-10-20 collector draft run

This is an operational record, not a publication or an approval. All counts
below were checked against the existing Supabase `globaltrend` project.

## Policy and submission

- Applied `remove_daily_draft_limit`; `collector_draft_policy()` returned
  `trend-draft-unlimited-v2`, `daily_claim_limit: null`, and
  `targeted_claim_supported: true`.
- Fixed the initial 49-item, no-report cohort in `draft_jobs` order
  (`created_at`, `id`). The cohort ended at
  `2026-10-19 14:00:24.115359+00`; later-arriving jobs were not included.
- Submitted 43 source-grounded Korean drafts by claiming one exact job ID at a
  time and calling `submit_trend_draft`. Each resulting report is `draft`,
  `human_reviewed = false`, and `published_at is null`.
- The 10 pending jobs that already had reports were not claimed or rewritten.
  No claim from this run remains leased.
- Applied `keep_collector_drafts_in_review`. The review RPC, called with an
  active reviewer context, returned all 43 new drafts. It includes all
  unreviewed draft reports plus the 100 most recent other source items.

## Six jobs withheld from drafting

These jobs remain pending and have no report. They were not claimed merely to
reach a numeric target.

| Job ID | Source item | Reason |
| --- | --- | --- |
| `607aa6b4-69f8-457c-8634-10fda6a775dc` | CJEU C-70/25, *Tukowiecka* | Payment-service refund dispute, not a personal-data development. |
| `fa5b7148-98de-476e-99e5-57c408db6d49` | French EDPB smart-glasses announcement | Substantively duplicates the EDPB smart-glasses draft already submitted. |
| `a0b43741-5bcc-4800-b2fd-ea6c0086a4fc` | ICO FOI public-interest guidance | Freedom-of-information issue, outside the personal-data collection scope. |
| `427bef71-00b8-40d3-8653-fc989c772b72` | DPC HSE paper-record decision | Duplicate official account of the HSE case already summarized from EDPB. |
| `368ada39-bf2c-49ae-96f1-c5a93ace1398` | FTC ticket-broker lawsuit | Ticket-purchase limits and resale, not a privacy development. |
| `efc73665-7560-47d4-ba3b-e0ac5e2a5c82` | FTC sextortion-relief lawsuit | Deceptive consumer-service claims; no substantive personal-data policy issue established by the captured source. |

## Verification and limits

- The database checks found 43 submitted cohort jobs, each with one report in
  the expected unpublished/unreviewed state, and six pending jobs with no
  report. Existing report-linked jobs remained at 10.
- The actual `get_trend_collector_review()` response contained all 43 new
  reports. This verifies the data path; it does not claim a browser screenshot
  from a human team account.
- The Korean articles are machine-assisted drafts for human review. Their
  `limitations` fields identify abstracts, press releases, unreviewed linked
  documents, and non-final legal opinions where applicable. No article was
  approved or published.
- No paid API, external service, scheduled execution, deployment, or main
  merge was used for this run.
