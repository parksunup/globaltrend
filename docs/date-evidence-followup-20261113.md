# Date evidence follow-up for the 2026-11-13 collector run

Run `43382161594` produced unknown publication dates for ICO, PPC, Spain AEPD, JPDP Malaysia, IAPP, GPA, G7 DPA, ISO/IEC SC 27, noyb, Freevacy, and overview.legal.

## ICO, PPC, AEPD, and JPDP run diagnosis

The run summary recorded `unknown_date=1` for ICO, `2` for PPC, `4` for AEPD, and `1` for JPDP Malaysia. The summary and retained run row do not include the candidate URL for each unknown item, so individual PPC candidates cannot all be mapped to the two counters after the fact. The concrete page/parser failures below are established from the actual stored rows and official page markup.

- **ICO:** The run's stored candidate was WiredGov's `UK health sector warned to tackle medical record snooping` page. Its official ICO page carries `Date 12 November 2026`; WiredGov itself also exposes `meta[name="DC.Date"]="Thursday, November 12, 2026"`. The `ico` route had only host/path validation, so extraction fell through to generic `main h1`/`main article` selectors and never read the publication metadata. The dormant ICO-specific parser was bypassed by the expansion-route dispatch. The WiredGov route now has exact headline/body/date selectors and reads the `DC.Date` value.
- **PPC:** The official notice page for the 28 October study-group announcement displays `令和８年10月28日` followed by the Commission name, and links to its official PDF. The PDF attachment extractor previously used only the listing row's date; when that row carried no date, it did not invoke the PPC HTML notice-date parser. The PDF path now reads the same dedicated notice dateline from the official HTML and keeps the PDF for body text. Conflicting listing and detail dates remain unresolved instead of selecting one. Because the run summary omitted candidate URLs, this establishes a concrete route defect but does not prove both of its two null-date rows were that exact page.
- **Spain AEPD:** The run recorded four unknown dates. Stored AEPD pages show the cause: the full-page selector matched the main item's `time[datetime]` plus dates from related-content blocks. For example, the 4 November item included the primary `2026-11-04T12:30:35Z` and older related dates `2026-09-08`, `2024-03-01`, and `2023-11-22`, so the parser treated those as a conflict and returned null. The selector now reads only `.layout__region--first`, where the official article's publication field appears; the listing date remains independently checked.
- **JPDP Malaysia:** The run recorded one unknown date. The official JPDP listing and the detail page for “List of Compound Cases Under the Personal Data Protection Act 2010 (Act 709)” both display `November 2, 2026`. That item had no official PDF, so the old HTML detail parser ignored the explicit listing observation, unlike the PDF attachment path. The parser now preserves and uses the full date from the official `.elementor-post-date` listing card, and still leaves conflicts unresolved.
- **overview.legal:** The listing displays `Nov 5` without a year, but the corresponding official aggregator detail page at `/posts/607721` publishes JSON-LD `datePublished=2026-11-05T00:00:00.000Z` and a separate `dateModified=2026-11-13T06:00:34.986Z`. The source parser accepts only `datePublished`, so the sampled candidate now has an explicit publication date; it does not infer a year from the listing. The run summary did not retain all 33 candidate URLs, so a new run is still needed to determine whether other records also expose published metadata.

The 11/13 run itself remains an immutable historical result. These fixes apply to the next collection execution; they do not retroactively change its counters.

## Implemented

GPA article pages expose an explicit publication timestamp in `time.entry-date.published[datetime]`. A live official article returned `2026-11-03T18:52:50+08:00`, while the separate `time.updated` element returned `2026-11-04T07:26:09+08:00`. The publication parser now accepts only the published element, not the updated element. A regression test verifies that distinction.

G7 DPA's official Canada detail page exposes `meta[name="dcterms.issued"]` with `content="2026-07-08"` (and a separate `dcterms.modified` value). The G7 route reads this issued field and ignores arbitrary body/event dates. The page body says the communiqué was adopted June 25–26; that adoption date is not substituted for the publication date. A regression test verifies the distinction.

Freevacy detail pages expose an explicit `Published: dd/mm/yyyy` label. The parser accepts that labeled value; no date is inferred from the syndicated publisher or an article URL.

## Remaining verification scope

- The historical Freevacy, IAPP, noyb, GPA, and overview.legal counters are unchanged. Their now-supported explicit detail or listing dates require a fresh run to verify all candidates, since the historical summary did not preserve every candidate URL.
- ISO/IEC SC 27's [official news listing](https://committee.iso.org/sites/jtc1sc27/home/news.html) gives only `2025-05` for the sampled item. Its [linked PDF](https://committee.iso.org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023.pdf)'s September 2023 date is the technical standard's publication date, not the news post date. The news item must remain undated until a full posting date is available.

A source remains incomplete when any required candidate has an unresolved publication date. These parser fixes do not establish broader listing coverage by themselves.
