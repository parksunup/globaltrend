# Source coverage evidence for run 43382161594

This review covers the eleven sources whose summary reported a finished listing traversal with zero unknown dates and zero detail failures. The run's `listing_scan_complete` value says that the adapter reached the end of the listing path it followed. The run does not persist a date-boundary observation or evidence that the listing contains every item published during the requested interval. Consequently none of these eleven runs can be reclassified as a complete date-window scan from this result alone.

| Source | Run evidence | Listing boundary evidence available | Missing proof |
| --- | --- | --- | --- |
| EDPB | 203 discovered, 13 pages, 198 out of range, 5 duplicates | The official `date` filter accepts publication years and paginates with `page`; the collector now scopes the request to all years touched by the requested window and requires terminal pagination plus zero unknown dates/failures/exclusions | The previous run used the unfiltered route. A fresh run on the new code is needed to verify the bounded query and terminal-page result |
| CURIA | 163 discovered, 1 page, 150 out of range, 13 duplicates | One listing page exhausted | Establish whether this page is the complete interval result or only a latest-items page; a single page count is not an interval boundary |
| CNIL | 807 discovered, 33 pages, 794 out of range, 13 duplicates | Page traversal with card dates; the adapter explicitly warns that card dates do not prove archive ordering | Verify chronological monotonicity and an older-than-start boundary, or use a bounded archive/query |
| DPC | 199 discovered, 40 pages, all 199 out of range | Multi-page latest-news route reached its current end | Persist listing dates and prove the feed is ordered and was followed through an item older than the interval start |
| EDPS | 20 RSS entries, 1 feed page, 1 out of range, 19 duplicates | The RSS response ended | Verify feed item cap/retention and a date boundary. RSS exhaustion alone does not establish archive coverage |
| CA-OPC | 20 discovered, 2 pages, 9 out of range, 11 duplicates | Two paginated listing routes were traversed | Demonstrate that both routes cover the requested date interval and record their date boundary observations |
| TC260 | 200 discovered, 20 pages, 198 out of range, 1 duplicate | The adapter follows observed `list_N.shtml` pagination | Verify date ordering across every page and persist the first older-than-start item; page traversal itself is not a date filter |
| NPC Philippines | 9 RSS entries, 1 feed page, 6 out of range, 3 duplicates | The RSS response ended | Confirm feed retention/continuation and an interval boundary. Its linked HTML route is not used because it returned 403 |
| FPF | 9 discovered, 1 page, 3 out of range, 6 duplicates | One blog page was read | Verify pagination/archive bounds or a date-ordered boundary; no such proof was stored in the run |
| Global CBPR | 12 discovered, 1 page, all 12 out of range | The official WordPress listing now follows its observed `Next` link. Page 2 is terminal; the original run predates this pagination fix | A fresh run is needed to verify the two-page archive traversal and date-window coverage |
| Netherlands AP | 10 RSS entries, 1 feed page, 5 out of range, 5 duplicates | A rolling RSS feed ended; source catalog says it has no continuation and coverage is incomplete | Use a complete archive or date-bounded query; this RSS feed cannot certify the interval |

## Status rule

Keep these run results `partial` until the collector records source-specific proof that the queried listing covers the requested interval. A useful proof is a server-side date filter reflected in the request and response, enumeration of every official daily archive in the interval, or verified newest-first ordering with every listing date checked through the first item older than `since`. The last condition also requires no unknown dates, detail failures, excluded required items, or unresolved holds.

Only EDPB has a verified date-filter route now, and Global CBPR's observed next-page link is followed. Their original run results remain `partial` because they predate these changes and need a fresh run to produce boundary evidence. Other routes remain `partial` until the specific range proof described above is collected. Treating generic pagination completion as interval completeness would misclassify rolling RSS feeds and incomplete listings.
