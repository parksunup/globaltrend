# Cloud queue visibility before the daily producer

## Observed issue

A read-only query of the existing Supabase function on 2026-10-26 showed that a completed OECD/FTC scan with a null cursor is requeued after 86,400 seconds. That delay starts when the previous commit finishes. The daily producer runs around 04:00 KST and can finish later, so the following run may start before its queue message becomes visible. Moving the fixed schedule alone does not solve a delay measured from completion.

## Change in this PR

The generated migration `20261026002438_cloud_daily_requeue.sql` changes only the null-cursor recheck to 72,000 seconds (20 hours). It leaves failed-step retries at one hour, in-pass steps immediate, existing leases, source approval/capacity checks, backlog ownership, cursor preservation, and `coverage_complete=false` unchanged. It does not reset routes or queue state.

`scripts/collector/cloud_connector_check.sql` adds a transaction-rollback check that a regular completed route returns `retry_after_seconds=72000`. Run it only inside an explicit transaction that is rolled back.

## Acceptance after PR approval and migration deployment

This PR is not deployed by this change. Verify the live SQL function returns a 20-hour delay, then compare the next scheduled run's completion, queue visibility, take, and commit times. Success requires the next scheduled worker to see and process the queued OECD/FTC work without changing its lease or cursor. This timing change does not itself prove full-period coverage or fix source discovery.
