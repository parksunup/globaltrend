# Collector v2 progress and activation gates — 2026-11-06

The legacy collector remains in place. New code is under `scripts/collector_v2`; the manual workflow is opt-in only and has no schedule trigger.

## Implemented

- Crawlee 1.11 HTTP and Playwright transports with approved-host checks, robots disallow checks, one-request crawler instances, zero internal retries, request timeouts, and a shared per-host minimum interval carried over from the legacy adapter configuration.
- GET/POST support for existing observed listing APIs.
- Existing source-specific `cloud_step.prepare` bundle contract wrapped by v2; the worker calls the existing `collector_cloud_take` and `collector_cloud_commit` RPCs and keeps the one-document atomic commit behavior.
- Trafilatura 2.3.1 fallback only when an HTML source parser raises. Such fallback records unknown publication date and `requires_review=true`, so it cannot qualify as an automatic draft.
- An opt-in `crawlee-worker` workflow-dispatch mode. This workflow has no schedule and must be manually dispatched; no live write run was made.

## Verification

- Existing Python collector regression suite plus the new v2 diagnostic exit-contract tests: 167 tests passed locally.
- Trafilatura fallback smoke sample produced 806 characters with an extractor/version marker.
- Crawlee cloud probe, run https://github.com/parksunup/globaltrend/actions/runs/42140432084: OAIC, Canada OPC, CAC, TC260, and AEPD yielded parsed samples. ICO HTTP and browser probes returned 403. California Privacy, EC, EU Parliament, EU Council and PCPD did not produce parsed samples; see raw action logs for exact request/schema errors. This probe checked one listing/detail sample per enabled config and does not prove full-window coverage.
- A route-aware Crawlee probe then parsed PCPD (5,095 characters) in run https://github.com/parksunup/globaltrend/actions/runs/42141228174. A Playwright probe of EU Council received 403 in run https://github.com/parksunup/globaltrend/actions/runs/42141331186. That run appeared green because the diagnostic did not propagate failed samples to the process exit code; v2 now returns partial exit code 3 on any failed or empty probe and prints its result JSON in the Actions summary.
- Chromium Playwright initially SIGTRAPed; after headless launch flags it ran but ICO still returned 403.
- Crawlee 1.11 explicitly warns that robots.txt `Crawl-delay` directives are not enforced without its `ThrottlingRequestManager`. The per-host minimum interval limits repeated requests, but is not a substitute for reading and applying a larger site-specific robots delay.
- Existing Supabase preflight run https://github.com/parksunup/globaltrend/actions/runs/42140900099 performed no writes and failed with `http_403`. This environment therefore did not verify DB authorization/connectivity, active route ownership, or worker commit behavior.
- The v2 worker remains unexecuted because preflight did not establish connectivity. No schedule was enabled and no source data was written by v2.

## Remaining activation requirements

1. Resolve authorized Supabase network/auth access and verify current routes, capacity, and worker permissions using read-only preflight.
2. Correct source-specific failures and run per-source Crawlee HTTP/browser tests. Do not claim all-source collection from a sample probe.
3. Run the worker only after preflight succeeds, then validate claim lease, durable commit, restart recovery, and duplicate behavior in the authorized target environment.
4. Connect the existing retained-draft writer to automated execution and verify packet, source review, seal/check, `submit_trend_draft`, and working-copy readback. Crawlee only acquires documents; the worker currently does not author Korean drafts.
5. Verify the existing 03:00/05:00 schedule state and only propose scheduler ownership changes after v2 passes source and end-to-end acceptance. The current workflow does not schedule itself.
