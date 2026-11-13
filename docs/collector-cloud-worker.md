# Cloud Python collector worker

`.github/workflows/trend-cloud-python.yml` drains the existing durable
Supabase collection queue for sources whose registry entry is enabled with the
`cloud-python` executor. It runs daily at 06:00 Korea time, after the 04:00
Edge collection run and before the 07:00 daily producer, and can also be started
manually from GitHub Actions.

The workflow reuses the repository secrets already referenced by
`trend-collector.yml`:

- `COLLECTOR_SUPABASE_URL`
- `COLLECTOR_SUPABASE_SECRET_KEY`

The key must have the existing service role needed to call the private collector
RPCs. The workflow maps these values to environment variables only. The worker
does not write credentials, lease tokens, or RPC error bodies to its output.

For each enabled source, the worker claims the next queue item through
`collector_cloud_take`, runs one existing `scripts.collector.cloud_step`
preparation, and submits the returned bundle through `collector_cloud_commit`.
The commit RPC remains responsible for validating the lease and atomically
storing results and advancing the cursor. The worker does not edit queue rows or
cursors directly. A source with no claim reports `idle`; an error for one source
is reported as `failed` while the worker still attempts every other enabled
cloud-Python source in that run.

The workflow tests the collector before making a claim. It does not imply that
every item in `config/trend-source-catalog.json` has been admitted to the
production queue. Edge sources continue to use their existing Supabase Edge
schedule. Held sources stay held. This branch enables the European Commission,
European Parliament, and EDPS on the cloud-Python executor. The existing
source-expansion migration already admits the Commission and Parliament to the
cloud-claim and cursor-host allowlists. A new additive migration enrolls the
EDPS official Mastodon RSS route and allows only its verified status URL
pattern. The feed probe returned 20 RSS entries and a full post text plus
publication date; scheduled production collection remains unverified. This
code change has not itself been run against production Supabase.

To inspect the worker, open GitHub **Actions → Daily cloud Python collector**.
The run output distinguishes idle claims, successful commits, and per-source
failures. A green workflow means the configured cloud-Python queue was drained
without a worker error; it does not certify that every source in the 37-source
catalog is production-ready.
