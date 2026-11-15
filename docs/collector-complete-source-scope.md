# Complete source collector scope

This is a fresh implementation based on `main`, with the complete requested
source inventory. It does not inherit the closed PR #113 branch history and
does not narrow collection to the first 19.

## Requested inventory

| Cohort | Count | Included sources |
|---|---:|---|
| Original tested sources | 19 | EDPB, OECD, CURIA, CNIL, ICO via WiredGov, Ireland DPC, Singapore PDPC, Japan PPC, FTC, European Commission, California Privacy Protection Agency, OAIC, Canada OPC, Hong Kong PCPD via its government republication route, European Parliament, Council of the EU, China CAC, China TC260, Spain AEPD |
| Additional candidate sources | 12 | EDPS via its Mastodon RSS feed, Brazil ANPD, Philippines NPC, Malaysia PDP Commissioner, NIST, IAPP, Future of Privacy Forum, GPA, G7 DPA Roundtable, Global CBPR Forum, RIPD, ISO/IEC JTC 1/SC 27 |
| Separately requested sources | 5 | noyb, Netherlands AP, Vietnam Government Online Newspaper, Freevacy, overview.legal |
| Previously held source | 1 | EUR-Lex News; inventoried, but explicitly excluded from all probes and collection until the user lifts the hold. |
| **Inventory total** | **37** | **36 requested probe candidates + 1 user-held inventory entry. Unique IDs are in `config/trend-source-catalog.json`.** |

RD Privacy Watch is excluded at the user's direction. Repeated mentions of the
Netherlands AP, Vietnam government news, and the three discovery publications
are represented once each. The three publications are first-class monitored
sources; their items retain the fact that they are aggregators/publications.

## Collection cadence

Daily sources use the daily schedule. GPA, G7 DPA Roundtable, Global CBPR,
RIPD, ISO/IEC JTC 1/SC 27, and overview.legal are weekly in the catalog.
Changes to cadence do not imply that a source has passed runtime verification.

## Crawlee catalog probe

The `catalog-probe` mode runs a read-only smoke check of every eligible source (36 entries). It never contacts EUR-Lex while its explicit user hold remains:

```sh
python -m scripts.catalog_probe --output work/source-catalog-probe.json
```

By default it excludes entries explicitly marked `explicit_user_hold`, `verification_status: held_by_user`, `cohort: previously-tested-held`, or `hold_reason: user_deferred_*`. A separate operational hold does not remove a requested source from the probe. Explicitly selecting the user-held entry fails before any request. It checks the configured listing, attempts to identify an item, and fetches one
detail body when a candidate is found. Results separately record listing and
detail failures. A probe does not write to Supabase, certify date-window or
pagination completeness, or imply that a source is ready for automatic
publication. It uses the pinned Crawlee transport already used by this project;
it does not add stealth, proxy rotation, CAPTCHA solving, or access-control
bypass behavior.

Run it from GitHub Actions: **Actions → Source catalog probe (read only) →
Run workflow → source `all`**. The JSON result is in the
run output workspace; the run summary marks the whole pass partial if any
source could not yield both a listing and detail sample. Other sources are
still attempted after an individual source fails.

## Operational boundary

The existing durable Supabase worker still claims source slugs registered in
the production registry and must pass source approval before it writes. The
catalog probe deliberately does not enroll new sources, grant approvals, or
write article records. A source is not described as fully operational until
its source-specific listing/detail adapter, date evidence, pagination or feed
continuation, durable cursor/retry behavior, and end-to-end draft handoff are
verified. Do not turn a successful HTTP response into a successful collection
claim without those checks.

The catalog includes explicit source URLs and allowed hosts. For any source
where the first candidate URL or page structure changes, update that source's
entry only after verifying the official/current route. Do not silently replace
the requested source with a search-engine result or an unrelated publisher.

The latest full-scope run is recorded in
[`source-catalog-probe-36-current-2026-11-09.md`](source-catalog-probe-36-current-2026-11-09.md)
and its per-source evidence is in
[`evidence/source-catalog-probe-36-current-2026-11-09.json`](evidence/source-catalog-probe-36-current-2026-11-09.json).
It attempted all 36 eligible sources sequentially, with 28 listing/body samples
and 8 failures or empty relevance windows. It remains partial: a one-item
sample does not prove relevance, pagination completeness, or scheduled
collection readiness.
