# Monthly Week Labels and Podcast Editions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show intuitive month/week names throughout the site, support multiple podcast editions in one week, enable podcast-only unpublishing, and default production to Chrome.

**Architecture:** Recalculate stored IDs from each issue's Monday date using the shared monthly-week formatter. Written weekly IDs are `YYYY-MM-Wn`; podcast IDs are `YYYY-MM-Wn-N`. A transactional allocator reserves numbered podcast editions for both studio and direct upload. Existing audio paths stay unchanged. Unpublishing changes only the podcast episode and production-job state.

**Tech Stack:** Next.js 15, TypeScript, Supabase/Postgres migrations and RPCs, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-29-monthly-week-labels-podcast-editions-design.md`

## Global Constraints

- Recalculate existing weekly IDs from stored Monday dates and update linked references. Keep existing audio object paths intact.
- Week labels use the Monday date; week-of-month is `ceil(monday.day / 7)` and includes the year. Weeks run Monday–Sunday.
- Podcasts display an edition suffix (`-1`, `-2`, …); written weekly issues do not.
- Podcast unpublish preserves the written weekly issue, its reports, and the stored audio.
- Studio production defaults to Chrome; cloud remains selectable.
- Direct upload and studio production must use the same atomic edition allocator.

## Review Focus

- Weeks crossing a month/year boundary → formatter tests use the Monday anchor.
- Existing ISO podcast keys → migration recalculates IDs from stored Monday dates and numbers editions without moving audio.
- Two reservations for one week → database RPC serializes allocation and produces distinct keys.
- Direct upload and studio races → both call the same allocator; key constraints remain the final guard.
- Podcast unpublish → public episode and audio access disappear while written weekly publication stays visible.

### Task 1: Shared monthly-week formatter

**Files:** Create `lib/weekly-label.ts`; test `tests/weekly-label.test.mjs`.

- [x] Write tests for `2026-10-05 → 2026년 10월 1주`, `2026-10-12 → 2026년 10월 2주`, a September-to-October crossing week, and a year boundary.
- [x] Run `node --test tests/weekly-label.test.mjs`; confirm missing-module/formatter failures.
- [x] Implement `formatMonthlyWeek(weekStart: string): string`, `monthlyWeekIssueKey(weekStart: string): string`, `podcastIssueKey(weekStart, edition)`, and `podcastEditionNumber(issueKey)`, using the Monday anchor.
- [x] Re-run the formatter tests.

### Task 2: Visible labels on written weekly and podcast pages

**Files:** Modify `app/public/weekly/weekly-issue-picker.tsx`, `app/public/weekly/written-weekly-report.tsx`, `app/public/weekly/podcast/page.tsx`, `app/public/home-podcast-player.tsx`, `app/work/weekly/weekly-editor.tsx`; relevant tests `tests/public-weekly.test.mjs`, `tests/weekly-editor.test.mjs`.

- [x] Add regression assertions that public written issue headings/selectors show month/week labels, podcast selectors/cards show month/week plus edition number, and no rendered user-facing label contains a raw `YYYY-Wnn` key.
- [x] Run the relevant tests and confirm each fails against current `Wnn` display.
- [x] Use the shared formatter at all visible issue-label sites; canonical month/week IDs remain in API values and URL query parameters.
- [x] Run `node --test tests/public-weekly.test.mjs tests/weekly-editor.test.mjs`.

### Task 3: Atomic per-week podcast edition allocation

**Files:** Create `supabase/migrations/<timestamp>_podcast_week_editions.sql` and `supabase/tests/podcast_week_editions.test.sql`; modify `app/api/podcast/production/route.ts`, `app/api/podcast/publish/route.ts`, `app/work/podcast/studio.tsx`, `app/work/podcast/upload-form.tsx`; create `app/api/podcast/next-issue/route.ts`; test `tests/podcast-production.test.mjs` plus migration replay in CI.

- [x] Add SQL coverage for Monday-based identifiers, migration consistency, reservation permissions, and allocation serialization.
- [x] Recalculate written and podcast IDs from Monday dates, update all references and job packets, and preserve audio paths.
- [x] Add a per-week reservation table and admin-only `reserve_weekly_podcast_issue_key(p_week_start date)` RPC. Serialize reservations, seed the first sequence from existing podcast issue/job keys, and never reuse cancelled/unpublished numbers.
- [x] Studio prepare and direct upload call the shared RPC for server-generated keys. Remove the editable issue-key field and show the computed monthly-week label instead.
- [ ] Run Supabase local migration replay; Docker is not installed in this environment.
- [x] Run targeted tests and typecheck.

### Task 4: Podcast-only unpublish

**Files:** Extend the migration with `unpublish_podcast_production_job(uuid)`; modify `app/api/podcast/production/route.ts`, `app/work/podcast/studio.tsx`, `lib/public-podcast.ts`; test `supabase/tests/podcast_week_editions.test.sql`, `tests/public-weekly.test.mjs`, and studio rendering.

- [x] Add regression tests for the `unpublished` terminal state and its studio action presentation.
- [x] Implement an administrator-only transaction that withdraws the podcast episode and sets the production job phase to `unpublished`, leaving `weekly_issues`, report links, and storage untouched. Handle repeated unpublish idempotently; add “게시 취소” and an “공개 취소” action for published podcast jobs.
- [x] Add an unpublish path for all published episodes, including rows without a production job.
- [ ] Run migration-backed database behavior tests; local Supabase is unavailable without Docker.

### Task 5: Chrome default and full visible-label audit

**Files:** Modify `app/work/podcast/studio.tsx`, `app/work/podcast/upload-form.tsx`, and any additional user-facing components found by repository-wide `YYYY-Wnn`/`issue_key` output audit; test studio initial rendering plus all affected page renderers.

- [x] Add a test proving the initial studio mode is browser/Chrome and that cloud remains an available option.
- [x] Set the initial mode to `browser`; replace user-facing raw-key labels/placeholders, including production history and direct-upload controls.
- [x] Search `app/**` for visible direct interpolation of ISO week keys and rerun affected tests.

### Task 6: Full verification and review

- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm validate:data`, `pnpm build`, and Supabase local migration replay.
- [x] Review every changed page/component against the spec and confirm audio paths were not rewritten.
- [ ] Record local verification limits: one existing policy-hash test fails, Next.js build output is blocked by EPERM, and Docker is not installed for migration replay.

