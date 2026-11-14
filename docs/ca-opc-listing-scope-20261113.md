# CA-OPC official listing scope and coverage boundary (2026-11-13)

The Edge collector's CA-OPC route now enumerates the three requested official content families:

1. News and announcements: `https://www.priv.gc.ca/en/opc-news/news-and-announcements/?o=d&Page=1&Filter=True`
2. Speeches and statements: `https://www.priv.gc.ca/en/opc-news/speeches-and-statements/?o=d&Page=1&Filter=True`
3. Advice to Parliament: `https://www.priv.gc.ca/en/opc-actions-and-decisions/advice-to-parliament/?o=d&Page=1&Filter=True`

The route parser accepts article URLs from all three paths and deduplicates the same URL across listing streams. Live official HTML was fetched on 2026-11-13. All three routes returned HTTP 200, ten date-stamped items on page 1, a `rel="next"` page link, a `Last page` link, and an explicit item total:

| Listing | Official total shown | Last page | Page 1 date sample |
|---|---:|---:|---|
| News and announcements | 790 | 79 | 2026-11-10 through 2026-10-20 |
| Speeches and statements | 122 | 13 | 2026-11-10 through 2026-04-01 |
| Advice to Parliament | 236 | 24 | 2026-11-02 through 2026-05-22 |

The listings expose an `o=d` parameter in page links and their first pages were observed in descending publication-date order. This does not prove that every page boundary is ordered by publication date. In particular, the speeches page 13 returned date observations `2015-04-29, 2015-03-27, 2015-03-31, 2015-02-26`; the third item breaks strict date-descending order. The official page labels pagination and totals but the fetched HTML does not define `o=d` as publication-date sorting or promise a stable date boundary.

Therefore the configured collector now reaches all three named families through their official paginated routes, but it must not report the CA-OPC source-wide date window complete solely because a page appears older than `since`. A defensible boundary requires a documented official ordering guarantee or a bounded date filter, neither verified here. Exhausting every page in all three lists would enumerate the displayed archives, but would not be a practical daily date-window scan and has not been validated against records outside those listing families.
