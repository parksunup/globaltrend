begin;
select plan(10);
select ok(not has_function_privilege('anon','private.collector_github_dispatch_tick(text,timestamptz)','execute'),'public cannot dispatch collectors');
select ok(not has_function_privilege('authenticated','private.collector_github_dispatch_tick(text,timestamptz)','execute'),'team cannot dispatch collectors');
select ok(not has_function_privilege('service_role','private.collector_github_dispatch_tick(text,timestamptz)','execute'),'web service cannot dispatch collectors');
select is(private.collector_github_dispatch_tick('03','2026-11-14 17:00:00+00'),0,'wrong local hour does not dispatch');
do $$ begin perform vault.create_secret(repeat('synthetic-test-only-',3),'globaltrend_podcast_github_dispatch'); end $$;
select is(private.collector_github_dispatch_tick('03','2026-11-14 18:00:00+00'),2,'03 KST queues both collectors');
select is(private.collector_github_dispatch_tick('03','2026-11-14 18:00:00+00'),0,'repeat tick does not dispatch twice');
select is(private.collector_github_dispatch_tick('06','2026-11-14 21:00:00+00'),1,'06 KST queues cloud worker');
select is((select count(*)::integer from private.collector_github_dispatches where local_day='2026-11-15'),3,'all workflows have distinct daily records');
select is((select count(*)::integer from net.http_request_queue
  where url like 'https://api.github.com/repos/parksunup/globaltrend/actions/workflows/%/dispatches'),3,'only three fixed GitHub routes were queued');
select is((select convert_from(body,'UTF8')::jsonb->'inputs'->>'actual_collection'
  from net.http_request_queue where url like '%/crawlee-daily-collector.yml/dispatches'),
  'true','Crawlee runs in write mode');
select * from finish();
rollback;
