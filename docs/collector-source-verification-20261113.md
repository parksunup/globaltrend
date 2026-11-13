# Collector source verification — 2026-11-13

This note records read-only route checks and collector changes. No collection
results from these checks were written to the database.

## OAIC

- The non-official alternate route is the PublicNow archive for the OAIC
  publisher (source ID 91701). PublicNow republishes OAIC releases with the
  OAIC publisher attribution and identifies Public Technologies as the
  distributor. Example release: `https://www.publicnow.com/view/32AED3FB5E7F6CE28D8B31C7B952C7ADC176E1CB`.
- In the current Crawlee `HttpxHttpClient` environment, the official media
  centre returned HTTP 200 and its existing parser extracted 10 entries plus
  the official `start_rank=11` continuation URL.
- PublicNow's source archive and example release both returned HTTP 403. Its
  `robots.txt` also returned 403 (treated as unavailable under the existing
  robots policy); the actual archive/article request remained blocked. So this
  alternate is identified and wired as a fallback, but it is **not currently
  live-verified as reachable** from this runner. The fallback must not be
  reported as a successful route until an actual cloud run can read it.
- If OAIC's official listing request returns HTTP 403/503, Crawlee now tries
  the PublicNow source archive with the same host allowlist, robots checks,
  request pacing, and source attribution validation. The parser accepts only
  PublicNow `/view/<40-hex-id>` pages and requires visible OAIC and Public
  Technologies attribution in the detail.

## PDPC

- The official API route is still available in this test: 10 entries were
  parsed, with a `page=2` continuation.
- The already-merged PR #134 sitemap fallback was tested directly through the
  existing parser: official `sitemap.xml` returned HTTP 200 and 178 validated
  media-event URLs. The fallback remains in the Crawlee collector for API
  empty/invalid/unavailable responses; an explicit robots denial still stops
  collection.

## Vietnam government

- The 2026-11-11 through 2026-11-13 read-only recheck visited 3 listing pages,
  saw 28 card appearances, and fetched all 25 unique detail pages. The 3 extra card
  appearances were duplicate URLs across listing pages. Thirteen details were
  confirmed outside the requested date range; none of the in-range bodies
  passed the privacy relevance check. The official timeline reached a verified
  end, so the result was `empty_window`, `coverage_complete=true`, with no
  errors—not a failure.
- The local Scrapling Fetcher could not validate the environment's intercepted
  TLS chain. For this read-only verification, Crawlee's HTTPX transport fetched
  the pages while the Scrapling Vietnam adapter performed the listing/detail
  parsing and range/relevance checks. Production continues to use the
  configured Scrapling transport.
- Pagination now stops on a date boundary only if every card has a valid date,
  the page is newest-to-oldest, and the newest card is older than the requested
  range. Otherwise it follows the timeline until an empty fragment. Vietnam
  candidates are all detail-fetched before range exclusion, so listing dates
  alone cannot suppress those detail checks.

## FTC and empty windows

- The 2026-11-11 through 2026-11-13 read-only FTC check followed the official
  privacy-filtered listing with no page-size parameter and no 10-page limit. It
  visited the terminal listing page, found 8 unique candidates, confirmed all
  8 were outside the requested range, and completed with `coverage_complete=true`.
  No detail page was required because every candidate had a verified listing
  date outside the range.
- The default 10-page / 30-item caps are now removed for every Scrapling source;
  the registry uses `null` defaults and the worker passes them through without
  truncation. OECD's separate RSS collector also no longer truncates its
  default candidate set at 30. Optional manual limits remain available when
  explicitly requested for a resumable run. For an early FTC date cutoff, the
  collector requires complete, descending listing dates across pages. Unknown
  or unordered dates cause it to keep following pagination.
- `empty_window` counts as a successful run only when `coverage_complete` is
  true. An empty result without source-specific evidence remains `partial`,
  so missing dates, failed details, or an unknown listing boundary cannot be
  mislabeled as “no publications.”

## ICO status meaning

`wiredgov_ico_listing_no_attributed_items` means the WiredGov listing request
was parsed, but the selector found no card that both matched the expected
article-link pattern and had the exact visible channel text
`Information Commissioner's Office`. It does not prove that WiredGov returned
no ICO article. The likely causes are an attribution/markup mismatch or no ICO
item in that particular weekly index; the collector has no evidence to choose
between them.
