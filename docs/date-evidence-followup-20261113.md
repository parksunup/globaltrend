# Date evidence follow-up for the 2026-11-13 collector run

Run `43382161594` produced unknown publication dates for ICO, PPC, Spain AEPD, JPDP Malaysia, IAPP, GPA, G7 DPA, ISO/IEC SC 27, noyb, Freevacy, and overview.legal.

## Implemented

GPA article pages expose an explicit publication timestamp in `time.entry-date.published[datetime]`. A live official article returned `2026-11-03T18:52:50+08:00`, while the separate `time.updated` element returned `2026-11-04T07:26:09+08:00`. The publication parser now accepts only the published element, not the updated element. A regression test verifies that distinction.

G7 DPA's official Canada detail page exposes `meta[name="dcterms.issued"]` with `content="2026-07-08"` (and a separate `dcterms.modified` value). The generic publication extractor now reads the issued field. The page body says the communiqué was adopted June 25–26; that meeting/adoption date is not substituted for the publication date. A regression test verifies the distinction.

Freevacy detail pages expose an explicit `Published: dd/mm/yyyy` label. The parser accepts that labeled value; no date is inferred from the syndicated publisher or an article URL.

## Still unresolved

- Freevacy cards do not carry a date, so the candidate remains undated until the detail fetch succeeds. Its detail page has explicit publication metadata as described above; publisher dates are not a substitute.
- overview.legal listing dates omit the year, and the inspected detail page has no published-date metadata. Assigning the current or inferred year would be speculative.
- IAPP and noyb listings show explicit full calendar dates for the sampled rows; these are retained as listing publication evidence. A detail-page date is not necessary when the official listing date is present. The noyb news listing displays `29.10.2026`; the IAPP listing displays `6 Nov. 2026`.
- ICO and PPC require their respective source-specific listing/date evidence; AEPD and JPDP Malaysia require the date observation from their official listing or detail responses. Do not use incident, meeting, decision, or updated dates as publication dates.
- ISO/IEC SC 27's official news listing gives only `2025-05` for the sampled item. Its linked PDF's September 2023 date is the technical standard's publication date, not the news post date. The news item must remain undated until a full posting date is available.
- GPA listing cards omit dates, but its article detail carries an explicit published timestamp, which the collector can now use.

A source remains incomplete when any listed item has an unresolved publication date. A date parser change by itself does not establish listing coverage.
