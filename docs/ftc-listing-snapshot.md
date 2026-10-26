# FTC cloud listing snapshots

The FTC RSS listing can reorder or replace cards while a cloud run handles one
article per lease. A cursor offset alone is therefore not a safe way to resume:
the same offset can point to a different article after the feed changes.

The cloud worker now uses this sequence:

1. It reads the official FTC feed and validates a bounded snapshot (at most 100
   rows, only canonical `https://www.ftc.gov/` URLs).
2. It commits the ordered rows to the database before requesting any article
   page. This commit leaves the cursor at snapshot offset zero.
3. Each later claim receives the exact next stored row. A failed or crashed
   claim leaves the cursor on that row; an expired lease can be reclaimed with
   a new token and the same staged URL.
4. A successful row commit advances the cursor and preserves any detail-fetch
   failure in the existing backlog. Only the final row completes the snapshot.
   The next scan can then compare URLs with the last completed listing.

The old `processed_url_hashes` cursor remains accepted through its existing
50-hash, 4 KB limit and is combined with the durable last completed listing.
The database snapshot is authoritative when it contains more than 50 URLs;
hashes are not truncated from the stored snapshot. A list above 100 rows stops
without fetching detail pages or advancing the cursor. The daily worker can
retry after its normal backoff, but an operator must review a persistent
capacity failure rather than silently skipping rows.

This protects the exact listing across a committed scan. It does not prove that
the FTC feed contains every announcement for a date range: this adapter still
reads a bounded RSS listing, keeps `coverage_complete=false`, and records date
conflicts, unknown dates, and failed detail pages for review or retry.

The migration must be applied before enabling the worker's snapshot protocol.
This code change alone does not alter a live database or deploy a worker.
