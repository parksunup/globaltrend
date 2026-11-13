# Source coverage evidence for run 43382161594

This review covers the eleven sources whose summary reported a finished listing traversal with zero unknown dates and zero detail failures. The run's `listing_scan_complete` value says that the adapter reached the end of the listing path it followed. The run does not persist a date-boundary observation or evidence that the listing contains every item published during the requested interval. Consequently none of these eleven runs can be reclassified as a complete date-window scan from this result alone.

| Source | Run evidence | Listing boundary evidence available | Missing proof |
| --- | --- | --- | --- |
| EDPB | 203 discovered, 13 pages, 198 out of range, 5 duplicates | Multi-page listing traversal; no source-level bounded-date query or observed older-than-start boundary in the run record | Verify the source's chronological order and persist each card date through the item that crosses `since` |
| CURIA | 163 discovered, 1 page, 150 out of range, 13 duplicates | One listing page exhausted | Establish whether this page is the complete interval result or only a latest-items page; a single page count is not an interval boundary |
| CNIL | 807 discovered, 33 pages, 794 out of range, 13 duplicates | Page traversal with card dates; the adapter explicitly warns that card dates do not prove archive ordering | Verify chronological monotonicity and an older-than-start boundary, or use a bounded archive/query |
| DPC | 199 discovered, 40 pages, all 199 out of range | Multi-page latest-news route reached its current end | Persist listing dates and prove the feed is ordered and was followed through an item older than the interval start |
| EDPS | 20 RSS entries, 1 feed page, 1 out of range, 19 duplicates | The RSS response ended | Verify feed item cap/retention and a date boundary. RSS exhaustion alone does not establish archive coverage |
| CA-OPC | 20 discovered, 2 pages, 9 out of range, 11 duplicates | Two paginated listing routes were traversed | Demonstrate that both routes cover the requested date interval and record their date boundary observations |
| TC260 | 200 discovered, 20 pages, 198 out of range, 1 duplicate | The adapter follows observed `list_N.shtml` pagination | Verify date ordering across every page and persist the first older-than-start item; page traversal itself is not a date filter |
| NPC Philippines | 9 RSS entries, 1 feed page, 6 out of range, 3 duplicates | The RSS response ended | Confirm feed retention/continuation and an interval boundary. Its linked HTML route is not used because it returned 403 |
| FPF | 9 discovered, 1 page, 3 out of range, 6 duplicates | One blog page was read | Verify pagination/archive bounds or a date-ordered boundary; no such proof was stored in the run |
| Global CBPR | 12 discovered, 1 page, all 12 out of range | One page, and the source catalog explicitly says pagination is incomplete | Implement/verify official archive pagination or another complete source route |
| Netherlands AP | 10 RSS entries, 1 feed page, 5 out of range, 5 duplicates | A rolling RSS feed ended; source catalog says it has no continuation and coverage is incomplete | Use a complete archive or date-bounded query; this RSS feed cannot certify the interval |

## Status rule

Keep these run results `partial` until the collector records source-specific proof that the queried listing covers the requested interval. A useful proof is a server-side date filter reflected in the request and response, enumeration of every official daily archive in the interval, or verified newest-first ordering with every listing date checked through the first item older than `since`. The last condition also requires no unknown dates, detail failures, excluded required items, or unresolved holds.

This review deliberately does not change status logic. The current run has no boundary observations to validate such a change, and treating pagination completion as interval completeness would misclassify rolling RSS feeds and incomplete listings.
