# Date evidence follow-up for the 2026-11-13 collector run

Run `43382161594` produced unknown publication dates for ICO, PPC, Spain AEPD, JPDP Malaysia, IAPP, GPA, G7 DPA, ISO/IEC SC 27, noyb, Freevacy, and overview.legal.

## Implemented

GPA article pages expose an explicit publication timestamp in `time.entry-date.published[datetime]`. A live official article returned `2026-11-03T18:52:50+08:00`, while the separate `time.updated` element returned `2026-11-04T07:26:09+08:00`. The publication parser now accepts only the published element, not the updated element. A regression test verifies that distinction.

## Still unresolved

- Freevacy detail pages and its listing candidates examined in the source-catalog probe do not expose a recognized publication date. The listing is syndicated content, so source dates must be retained from publisher evidence or explicit Freevacy metadata.
- overview.legal listing dates omit the year, and the inspected detail page has no published-date metadata. Assigning the current or inferred year would be speculative.
- IAPP, noyb, and the remaining sources need exact runtime item evidence and their official detail markup checked before broad date extraction changes are safe. Probe sample dates produced by Trafilatura are candidates, not verified publication dates.
- ISO/IEC SC 27's observed listing gives only a month, not the publication day.
- GPA listing cards omit dates, but its article detail carries an explicit published timestamp, which the collector can now use.

A source remains incomplete when any listed item has an unresolved publication date. A date parser change by itself does not establish listing coverage.
