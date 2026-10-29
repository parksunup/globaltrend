# Monthly Week Labels and Multiple Podcast Editions

## Intent

Make weekly issues easy to recognize across the site, allow multiple podcast editions in one calendar week, provide an administrator control to unpublish a podcast, and make Chrome production the default.

## Goals

- Replace visible `YYYY-Wnn` labels on all user-facing pages with Korean month/week labels such as `2026년 10월 1주`.
- Number podcast editions within the same week as `2026년 10월 1주-1`, `2026년 10월 1주-2`, and so on. Written weekly issues have no edition suffix.
- Let administrators unpublish a podcast without unpublishing or changing its selected written weekly issue, reports, or stored audio.
- Default the production mode selector to the user's Chrome browser; keep cloud as an explicit alternative.
- Recalculate stored weekly identifiers from each Monday date. Written weekly IDs use `YYYY-MM-Wn`; podcast IDs use `YYYY-MM-Wn-N`.
- Preserve stored audio paths, updating database rows and references without moving audio objects.

## Non-goals

- Moving stored audio objects.
- Changing the content-selection or audio-generation rules.
- Unpublishing or changing the written weekly issue when a podcast is unpublished.

## Approaches

1. Keep ISO week keys internally and format visible labels. This avoids migration work but can leave IDs inconsistent with Monday-based labels.
2. **Recalculate stored IDs from Monday dates. (Selected.)** Written weekly IDs use `YYYY-MM-Wn`; podcast IDs append an edition number. Rewrite linked IDs and job packets while keeping audio object paths intact.

## Date convention

The Monday in the Monday-to-Sunday issue week determines its display month and week-of-month. Week numbering is `ceil(Monday day / 7)`, so October 5–11 is October week 1 and October 12–18 is October week 2. A week crossing a month boundary stays with the month containing its Monday. Labels include the year to distinguish archives across years.

## User-visible behavior

- Public written weekly pages, public podcast pages and selectors, podcast home/player labels, the podcast studio, production history, direct-upload form, and weekly editor all use the shared monthly-week formatter wherever an issue label is shown.
- Podcast production and direct upload both reserve the next edition number from one database allocator. Cancelled and unpublished editions keep their number so an identifier is never reused.
- An administrator can unpublish a published podcast from its production-history card. The public podcast listings and audio access stop exposing that episode; the written weekly issue and audio object remain stored.
- The studio initially selects Chrome production. Administrators may still switch to cloud production.

## Implementation scope

- Add a transaction-safe per-week edition allocator, used by both studio production and direct upload, plus a shared date/key formatter.
- Update podcast production and direct upload to allocate/validate unique per-week edition keys.
- Add an administrator-only transactional unpublish RPC and endpoint action, with a visible unpublished state in the studio.
- Update user-facing week labels across the app and default the studio selector to browser mode.
- Add a migration that renames weekly issue IDs and linked rows from their Monday dates, permits numbered podcast editions, and adds the unpublished production phase.
- Add unit tests for month boundaries, migration consistency, multiple editions, and unpublish visibility; verify migration replay and full CI.

## Constraints and risks

- `weekly_issues`, `weekly_issue_reports`, and `weekly_podcast_episodes` use the podcast issue key as their relationship key. The migration must update their IDs together and retain existing storage paths.
- Public podcast readers and audio policies already require the episode to be published. Unpublishing the episode row hides only the podcast while leaving the shared issue row untouched.
- Direct upload and automated production must share the same edition allocator to prevent duplicate numbers or keys.
- The migration derives every stored key from the row's Monday date, normalizing legacy IDs that do not match their stored date.
