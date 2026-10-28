begin;
select plan(11);

select has_table('public', 'collector_scan_windows', 'completed listing ranges have an audit ledger');
select ok((select relrowsecurity from pg_class where oid = 'public.collector_scan_windows'::regclass),
  'audit ledger has RLS');
select ok(not has_table_privilege('authenticated', 'public.collector_scan_windows', 'select'),
  'review range ledger is not exposed to ordinary users');

insert into public.collector_edge_sources(source_id, slug, state, queued)
select id, 'test-rolling-window',
  '{"since":"2026-09-21","until":"2026-10-28","page":"https://www.edpb.europa.eu/news_en","offset":0,"exhausted":true}'::jsonb,
  false
from public.sources where name = 'EDPB 뉴스·보도자료'
on conflict (source_id) do update set slug = excluded.slug, state = excluded.state, queued = false;

insert into public.collector_edge_backlog(source_id, url, range_start, range_end, state)
select source_id, 'https://www.edpb.europa.eu/news/test_en', '2026-09-21', '2026-10-28',
  '{"rows":[{"url":"https://www.edpb.europa.eu/news/test_en"}],"is_backlog":true}'::jsonb
from public.collector_edge_sources where slug = 'test-rolling-window';

insert into public.collector_edge_events(source_id, trigger_kind, execution_id, started_at, result)
select source_id, 'daily-cron', 'rolling-edge-test', clock_timestamp(),
  '{"since":"2026-09-21","until":"2026-10-28","listing_scan_complete":true,"coverage_complete":false,"coverage_blockers":["listing_exhaustiveness_unverified"]}'::jsonb
from public.collector_edge_sources where slug = 'test-rolling-window';

select is((select state->>'since' from public.collector_edge_sources where slug = 'test-rolling-window'),
  '2026-10-27', 'next daily scan begins with yesterday');
select is((select count(*)::integer from public.collector_scan_windows w
  join public.collector_edge_sources s using (source_id) where s.slug = 'test-rolling-window'),
  1, 'prior long range remains in the ledger');
select is((select count(*)::integer from public.collector_edge_backlog b
  join public.collector_edge_sources s using (source_id)
  where s.slug = 'test-rolling-window' and not b.resolved),
  1, 'exact failed URL backlog is untouched');

insert into public.collector_edge_events(source_id, trigger_kind, execution_id, started_at, result)
select source_id, 'manual-validation', 'rolling-manual-test', clock_timestamp(),
  '{"since":"2026-10-27","until":"2026-10-28","listing_scan_complete":true}'::jsonb
from public.collector_edge_sources where slug = 'test-rolling-window';
select is((select count(*)::integer from public.collector_scan_windows w
  join public.collector_edge_sources s using (source_id) where s.slug = 'test-rolling-window'),
  1, 'manual scan does not advance the scheduled range');

insert into public.collector_edge_events(source_id, trigger_kind, execution_id, started_at, result)
select source_id, 'daily-cron', 'rolling-unfinished-test', clock_timestamp(),
  '{"since":"2026-10-27","until":"2026-10-28","listing_scan_complete":false}'::jsonb
from public.collector_edge_sources where slug = 'test-rolling-window';
select is((select count(*)::integer from public.collector_scan_windows w
  join public.collector_edge_sources s using (source_id) where s.slug = 'test-rolling-window'),
  1, 'unfinished scan retains its current position');

insert into public.collector_cloud_routes(source_id, enabled, cursor, range_start, range_end)
select source_id, true, '{"page":"https://www.edpb.europa.eu/news_en","offset":0}'::jsonb,
  '2026-10-16', '2026-10-28'
from public.collector_edge_sources where slug = 'test-rolling-window';
insert into public.collector_edge_events(source_id, trigger_kind, execution_id, started_at, result)
select source_id, 'manual-validation', 'rolling-cloud-test', clock_timestamp(),
  '{"since":"2026-10-16","until":"2026-10-28","listing_scan_complete":true,"trigger":"scheduled","coverage_complete":false}'::jsonb
from public.collector_edge_sources where slug = 'test-rolling-window';
select is((select range_start::text from public.collector_cloud_routes r
  join public.collector_edge_sources s using (source_id) where s.slug = 'test-rolling-window'),
  '2026-10-27', 'completed cloud scan advances its next daily range');
select is((select cursor->>'page' from public.collector_cloud_routes r
  join public.collector_edge_sources s using (source_id) where s.slug = 'test-rolling-window'),
  'https://www.edpb.europa.eu/news_en', 'cloud cursor remains unchanged');
select is((select count(*)::integer from public.collector_scan_windows w
  join public.collector_edge_sources s using (source_id) where s.slug = 'test-rolling-window'),
  2, 'both completed ranges remain auditable');

select * from finish();
rollback;
