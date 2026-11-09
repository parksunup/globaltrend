# Scrapling probe for eight unresolved sources

This diagnostic is separate from the production Crawlee worker. It uses the
upstream Scrapling `Fetcher` HTTP API directly. It does not use
`StealthyFetcher`, browser fingerprinting, proxies, CAPTCHA handling, or any
other access-control workaround.

## Scope

The selectable IDs are OECD (`oecd`), FTC (`ftc`), California CPPA
(`calprivacy`), Hong Kong PCPD (`hk-pcpd`), European Parliament
(`eu-parliament`), China CAC (`cn-cac`), RIPD (`ripd`), and Vietnam Government
(`vn-gov`). EUR-Lex and RD Privacy Watch are outside this probe.

## Safety and request rules

- The configured listing URL must be HTTPS and its host must be in that
  source's allowlist.
- `robots.txt` is fetched first and evaluated for `GlobalTrendResearch`.
- The per-host pause is at least five seconds, or longer when robots.txt
  specifies a longer crawl delay.
- If the listing path is disallowed, it is not requested. HTTP 401, 403, or
  429 ends that source's attempt; the tool does not retry a denial through a
  different client or browser.
- Redirects must remain HTTPS on an allowlisted host.
- For reachable listings, the command checks at most one candidate detail
  page. Each detail URL independently passes the same robots, host, and pace
  checks.
- No database writes are made.

## Run

Install the isolated collector dependencies, then run:

```powershell
python -m pip install -r scripts/collector-crawlee/requirements.txt
python -m scripts.scrapling_probe --source all --output work/scrapling-eight-source.json
```

An individual source can be selected with `--source oecd` (or another ID in
the eight-source scope). The JSON records HTTP outcome, extracted listing
text length, and a short preview. Listing success does not establish article
coverage, relevance, article-body completeness, or scheduled readiness.

## Previous Crawlee probe baseline

The PR #114 baseline had OECD, CalPrivacy, European Parliament, and China CAC
return HTTP 403; FTC was stopped by the prior robots evaluation before a
request; PCPD returned HTTP 200 but yielded zero relevant candidates; RIPD
returned HTTP 503; and Vietnam Government yielded 32 candidates but zero
keyword-matched candidates. These are distinct conditions and must remain
distinct in follow-up results. In particular, the FTC result is not evidence
that every FTC path is disallowed. Re-evaluate each intended path under the
actual robots rules and crawl delay.

## Measured results (2026-11-09)

The full eight-source listing run is recorded in
`docs/evidence/scrapling-eight-source-2026-11-09.json`; a later detail-sample
run is in `docs/evidence/scrapling-eight-source-detail-2026-11-09.json`.
Both are read-only. The detailed run used the existing source selectors and
attempted at most one detail URL per source, with a fresh robots check and
minimum five-second per-host delay before every request.

| Source | Listing | Detail sample | Interpretation |
|---|---|---|---|
| OECD | HTTP 200, 15 candidates (3 privacy-title matches) | HTTP 403 | Public topic page fetched; the first privacy candidate detail was denied. Stop there. |
| FTC | HTTP 200, 7 privacy-title candidates | HTTP 200, 6,069 chars | Official search listing works without the robots-disallowed `items_per_page` parameter. Both requests passed robots, with at least five seconds between them. Sample: relevant Hims & Hers privacy-practices release. |
| CalPrivacy | HTTP 200, 10 candidates (6 privacy-title matches) | HTTP 200, 2,494 chars | Official detail is fetchable through Scrapling HTTP. |
| PCPD | HTTP 200, date archive; 0 candidates that day | none | Route is reachable; no PCPD item in the sampled archive date. |
| European Parliament | HTTP 403 | none | Access denied; no alternate client or browser retry. |
| CAC | HTTP 200, 20 candidates (14 privacy-title matches) | HTTP 200, 271 chars | Listing/detail are fetchable; body sample remains too short for a full article claim. |
| RIPD | HTTP 503 | none | Temporary/server failure; no retry loop. |
| Vietnam Government | HTTP 200, 28 candidates (0 privacy-title matches) | none | The homepage route returned candidates, but title relevance filtering found none; no unrelated article detail was fetched. |

This establishes transport and a relevant full-body sample for FTC and
CalPrivacy. It establishes transport feasibility for some other routes, but it does not
establish complete date-window coverage, full pagination, or scheduled
readiness. FTC now has an allowed, sampled article route. OECD detail, EP, and
RIPD remain unresolved under this run's source responses.

## Recheck of short-body results

`docs/evidence/short-body-recheck-2026-11-09.json` records the four-source
Crawlee/Trafilatura comparison. PDPC increased from 20 to 7,616 characters
through its existing embedded-RSC parser. PPC increased from 56 to 1221
characters by following the exact official press-release PDF link (two pages)
and extracting it with pypdf. TC260 increased from 262 to 274 characters in
the listing probe; the full five-page, article-ID-matched official PDF was
independently fetched and yielded 2,767 characters, recorded in
`docs/evidence/tc260-dedicated-parser-live-2026-11-09.json`. These PDF results
remain review-required and are not marked AI-ready. EU Council remains an
explicit 106-character RSS summary because the prior detail route returned
403 and no permitted full-text route was verified.
