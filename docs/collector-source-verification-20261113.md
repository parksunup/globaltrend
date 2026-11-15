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
- A dedicated read-only GitHub-hosted probe was run from the PR branch on
  2026-11-13 (Actions runs `43370474048` and `43373510323`). The first run
  confirmed PublicNow `robots.txt` returned HTTP 403 and the actual source
  archive also returned HTTP 403. The follow-up used the production Crawlee
  HTTPX client at a 6-second per-host interval and tested the official listing,
  the PublicNow source archive, an EBS/PublicNow source archive, and a known
  full-text EBS/PublicNow OAIC release. Every actual request returned HTTP 403;
  no candidates or article body were received. Thus neither the official route
  nor these alternate routes are reachable from the current GitHub-hosted
  runner. PR #135 remains unmerged.
- Search indexing confirms `ebs.publicnow.com` carries full OAIC releases with
  OAIC and Public Technologies attribution (for example, its IAID 2026 release),
  so it is a real syndication candidate. Direct HTTP access from the production
  runner is also blocked, so it is not yet an operational route.
- Other candidate repositories were checked: FOI Monitor indexes OAIC FOI
  disclosure-log documents, not the OAIC media-release stream; OAIC's monthly
  Information Matters newsletter and joint announcements on partner agency
  sites are selective and do not provide a complete media-centre archive.
  They therefore cannot replace a full OAIC news route. PublicNow remains the
  only full-content republication platform identified so far, but both of its
  tested public domains are blocked from the GitHub runner.
- On 2026-11-13 the user directed that OAIC be removed from the Crawlee daily
  source set. The shared/legacy Edge registry entry is retained with its
  official OAIC host; PublicNow fallback code and its temporary probe job are
  removed from the Crawlee collector.

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
