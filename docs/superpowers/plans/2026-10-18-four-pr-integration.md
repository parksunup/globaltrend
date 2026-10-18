# Four PR integration implementation plan

> Execute inline with superpowers:executing-plans. User authorized execution of the reviewed integration design on 2026-10-18.

**Goal:** Deliver one reviewable PR combining #15, #16, #30, and #32 with current source data and working publication boundaries.

**Architecture:** Repository files retain submitted corpus and provenance. Shared readers connect the improved UI to draft Preview and Supabase published content. Existing editorial actions and collector contracts remain authoritative.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase Postgres, Python collector.

**Spec:** docs/superpowers/specs/2026-10-18-four-pr-integration-design.md

## Global constraints

- Latest main, isolated checkout, one new integration PR; no main merge.
- Exact legal/trend source snapshots from #15/#16; no unreviewed public release.
- No paid AI API or automated collection activation.
- Preserve review pages and existing feedback.

## Review focus

Stale copied data overwrites; missing non-APPI provisions/recitals; branch-specific 404s; publication leaking drafts; importer duplicate/version changes.

## Tasks

- [ ] 1. Transplant #32 collector and #30 UI changes without reverting main feedback, then replace all submitted legal/trend data with #15/#16 snapshots. Pin provenance and test completeness.
- [ ] 2. Combine legal readers and article linking; retain recitals, appendices, alphanumeric articles and jurisdiction lookup. Test full corpus and actual links.
- [ ] 3. Remove branch-name gating, introduce explicit preview-vs-public content mode, and connect legal publication/import and existing trend workflow with Supabase. Add failing contract/publication tests before implementation.
- [ ] 4. Reconcile database migration history and collector CI blocked result. Run all app, corpus, collector, database and build checks; fix actual failures.
- [ ] 5. Verify local and deployed browser flows, create one PR, attach it, and report preview and remaining operational switches accurately.
