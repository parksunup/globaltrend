# Separate Scrapling collectors

This package adds a source collector beside the existing Crawlee/Edge
pipelines. It does not replace, edit, or delete those pipelines. It uses the
upstream pinned Scrapling `Fetcher` API for ordinary HTTP requests and
source-specific HTML/RSS/PDF parsers in `scripts/collector_scrapling/adapters`.

## Included sources

- OECD: the official WebCMS privacy-topic and English-publications RSS APIs
  are the primary alternate routes. The PR #42 HTML topic path remains a
  separately labelled legacy route. The historical 2026-10-22 977-character
  abstract came from the PR #42 `urllib.request` client, not Crawlee. Exact
  official PDF links are fetched through Scrapling and parsed with pypdf when
  allowed.
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

Use `--source oecd|cn-cac|hk-pcpd|vn-gov|ftc|calprivacy` to run one source.
The result records body text and the request/error outcomes. HTTP success alone
does not prove complete period coverage; `coverage_complete` is only true for
the exact inclusive PCPD daily-archive window when every requested day was
read successfully. Other sources remain partial until pagination/window
completeness has been independently established.

The cloud ingestion entry point is
`python -m scripts.collector_scrapling.cloud_worker`. Its GitHub workflow is
manual-only until it is wired into the existing Supabase Cron + Queues contract
and the migration is deployed. It is not yet a daily production schedule. The
daily Codex writer/filter task is defined in
`docs/trend-scrapling-daily-codex-task.md`; it must use a cloud Codex
subscription automation at 05:00 Asia/Seoul and does not call an OpenAI API.
That cloud schedule is not configured or verified yet; do not substitute a
local desktop task.
