# OECD WebCMS RSS collector

The scheduled OECD collector is a new, isolated implementation under
`scripts/collector_oecd_rss/`. It uses only the two official WebCMS RSS API
routes in `collector.py`. It does not import the previous OECD adapter, the
PR #42 HTML topic parser, or the 977-character Python/urllib diagnostic.

For each scheduled three-day window it reads the privacy topic RSS and the
English publications RSS. It filters publication-feed items for privacy
terms, validates each item URL against OECD's official hosts, and deduplicates
the two feeds by URL. It then requests the official article and any exact PDF
link found on that article, using Scrapling's ordinary `Fetcher` through the
shared HTTPS/robots/rate-limit transport. The transport enforces a five-second
minimum per host and fails closed when robots cannot be read or denies a path.
It uses no stealth, proxy rotation, CAPTCHA handling, or browser session.

When detail HTML or its linked PDF is available, that exact content is stored
with its extraction scope and date evidence. If OECD denies a detail/PDF
request, the worker may retain the publisher's RSS excerpt as an excerpt;
metadata states `official_rss_summary`, `requires_review=true`, and
`ai_ready=false`. An excerpt is never described as the full article. Dates
outside the scheduled window are skipped; unknown dates remain review-only.

The scheduled writer is `python -m scripts.collector_oecd_rss.cloud_worker`.
It uses the OECD source row, the existing capacity and ingest RPCs, and the
same Codex duplicate/relevance review boundary. The general six-source
Scrapling worker no longer includes OECD, preventing duplicate daily requests.
Both workers run in `.github/workflows/scrapling-daily-collector.yml` at 03:00
KST. The collector itself does not call an OpenAI API or draft Korean copy.
