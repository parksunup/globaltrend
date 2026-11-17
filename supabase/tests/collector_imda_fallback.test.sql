begin;
select plan(6);

select has_function('public','collector_imda_fallback_due',array['timestamp with time zone'],
  'IMDA fallback decision function exists');
select ok(not has_function_privilege('anon',
  'public.collector_imda_fallback_due(timestamp with time zone)','execute'),
  'anonymous users cannot inspect or invoke the fallback decision');
select ok(public.collector_imda_fallback_due('2026-11-20 12:00:00+00'),
  'missing PDPC run record enables the alternate route');

insert into public.collector_runs(id,started_at,finished_at,result) values
 ('f1a4cf29-7635-4b37-8e25-f34a31d87001','2026-11-17 00:00:00+00',
  '2026-11-17 00:10:00+00',
  '{"sources":[{"source":"pdpc","status":"failed"}]}'::jsonb),
 ('f1a4cf29-7635-4b37-8e25-f34a31d87002','2026-11-18 01:00:00+00',
  '2026-11-18 01:10:00+00',
  '{"sources":[{"source":"pdpc","status":"complete"}]}'::jsonb),
 ('f1a4cf29-7635-4b37-8e25-f34a31d87003','2026-11-19 00:00:00+00',
  '2026-11-19 00:10:00+00',
  '{"sources":[{"source":"pdpc","status":"partial"}]}'::jsonb);

select ok(public.collector_imda_fallback_due('2026-11-17 12:00:00+00'),
  'failed PDPC collection enables IMDA fallback');
select ok(not public.collector_imda_fallback_due('2026-11-18 13:00:00+00'),
  'completed PDPC collection skips IMDA');
select ok(public.collector_imda_fallback_due('2026-11-19 12:00:00+00'),
  'partial PDPC collection enables IMDA fallback');

select * from finish();
rollback;
