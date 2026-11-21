# Weekly Podcast Scoring Alignment Plan

> **For agentic workers:** Execute this plan task by task with focused tests.

**Goal:** Use the existing podcast 100-point editorial rubric for weekly trend ranking in both the workspace and Monday cloud schedule.

**Architecture:** Extract the podcast score calculation into a dependency-light shared module. The podcast recommender keeps its candidate eligibility and main-topic recommendation gate; weekly ranking reuses only the score and stable tie-break order, preserving its own weekly candidate contract and eight-item limit.

**Tech Stack:** TypeScript, Next.js, Deno Edge Function, Node test runner.

**Spec:** User request on 2026-11-17; rubric in `docs/weekly-podcast-editorial-guide.md` and `lib/podcast-recommendation.ts`.

## Global Constraints

- Keep weights at change 35, scope 25, practical relevance 25, evidence depth 15.
- Do not apply podcast-only eligibility checks or the 65-point main-topic gate to weekly eight-item selection.
- Keep weekly candidate date window, per-source-item latest revision, eight-item maximum, draft-only save, and existing-issue preservation.
- Preserve unrelated dirty files in the current worktree.

## Review Focus

- A high-priority privacy law change receives the same score in podcast and weekly code.
- A routine event remains low-scored despite recency.
- Equal scores sort by publication date descending, then ID ascending.
- Scheduled Edge Function can import the shared score module in Deno.
- Existing issue and draft-only behavior remains unchanged.

## Tasks

### Task 1: Shared scoring and regression test

**Files:** `supabase/functions/_shared/podcast-scoring.ts`, `lib/podcast-recommendation.ts`, `tests/weekly-priority.test.mjs`

- [x] Export the current exact podcast scoring calculation as a pure shared function.
- [x] Keep podcast eligibility and recommendation threshold in the podcast recommendation adapter.
- [x] Verify the regression test fails on the old 14-point weekly score and passes after delegation.

### Task 2: Workspace and scheduled selection

**Files:** `supabase/functions/_shared/weekly-priority.ts`, `lib/weekly-priority.ts`, `supabase/functions/weekly-digest/index.ts`

- [x] Route both workspace and Edge Function ranking through the shared 100-point score.
- [x] Save the score breakdown as the weekly selection reason.
- [x] Preserve date and ID tie-breaks and the existing maximum of eight.

### Task 3: Documentation and verification

**Files:** `docs/catalog-weekly-contract.md`, `docs/weekly-digest-cloud.md`, `docs/weekly-podcast-editorial-guide.md`

- [x] Replace stale 5+4+3+2-point documentation.
- [x] Clarify the distinction between weekly top-eight selection and the podcast-only main-topic recommendation gate.
- [x] Run focused tests and full test suite; typecheck passes. Deno CLI is unavailable, so the Edge Function import/type path is checked with TypeScript separately.
