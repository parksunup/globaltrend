# Separate Scrapling collectors

This package adds a source collector beside the existing Crawlee/Edge
pipelines. It does not replace, edit, or delete those pipelines. It uses the
upstream pinned Scrapling `Fetcher` API for ordinary HTTP requests and
source-specific HTML/RSS/PDF parsers in `scripts/collector_scrapling/adapters`.

## Included sources

- CAC: official privacy list and exact article path. A short official notice
  remains short and is marked for review; it is not padded or mislabeled.
- PCPD: inclusive daily official ISD archive traversal. An empty individual
  day is recorded as an empty day, not a failed collector.
- Vietnam Government: official homepage, policies list, and verified timeline
  fragment pagination; article relevance is checked against the body.
- FTC: official privacy search without the robots-disallowed
  `items_per_page` parameter, preserving the five-second minimum.
- CalPrivacy: official press-release category and verified next pages.

## Policy and execution

The transport validates HTTPS and exact host allowlists, reads and checks
robots before each page, honors the longest published crawl delay with a
five-second minimum, and manually validates every redirect hop. It does not
use proxies, CAPTCHA handling, stealth headers, or browser sessions. A 401,
403, or 429 is a terminal result for that request. The `runner` command below
is read-only. The separate `cloud_worker` command writes fetched records to
the existing Supabase `source_items` pool through allowlisted RPCs and should
only run in the configured GitHub Actions workflow with repository secrets.
Every ingested item is marked not AI-ready and is held out of `draft_jobs`
until the Codex duplicate/relevance filter records an accepted decision.

```powershell
python -m venv .venv-scrapling
.\.venv-scrapling\Scripts\Activate.ps1
python -m pip install -r scripts/collector-scrapling/requirements.txt
python -m scripts.collector_scrapling.runner --source all --since 2026-11-09 --until 2026-11-09 --output work/scrapling-result.json
```

Use `--source cn-cac|hk-pcpd|vn-gov|ftc|calprivacy` to run one source.
The result records body text and the request/error outcomes. HTTP success alone
does not prove complete period coverage; `coverage_complete` is only true for
the exact inclusive PCPD daily-archive window when every requested day was
read successfully. Other sources remain partial until pagination/window
completeness has been independently established.

The cloud ingestion entry point for these five sources is
`python -m scripts.collector_scrapling.cloud_worker`. OECD has a separate
WebCMS RSS-only collector in `scripts/collector_oecd_rss/`; it does not import
the previous OECD adapter or the PR #42 HTML route. The GitHub Actions workflow
runs both workers daily at 03:00 Asia/Seoul (`0 18 * * *`) and can also be
started manually. It runs only from `main`, writes to the central Supabase
source pool, and stops before requesting any source that fails the existing
source-approval or capacity checks. GitHub may delay scheduled starts; the run
ledger records the actual execution and result. The 05:00 Codex-account filter/writer task is
defined in `docs/trend-scrapling-daily-codex-task.md`; it must run in cloud,
use the user's subscription rather than an OpenAI API, and submit only
unreviewed drafts. Do not substitute a local desktop task.
