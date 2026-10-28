begin;
select plan(8);
select ok(not has_function_privilege('anon','private.podcast_dispatch_tick()','execute'),'anonymous callers cannot start workflows');
select ok(not has_function_privilege('authenticated','private.podcast_dispatch_tick()','execute'),'team logins cannot start workflows');
select ok(not has_function_privilege('service_role','private.podcast_dispatch_tick()','execute'),'web worker cannot invoke the clock');
select ok(not has_table_privilege('authenticated','private.podcast_dispatch_state','select'),'dispatcher metadata is private');
select is(private.podcast_dispatch_tick(),null::bigint,'migration leaves dispatch disabled');
update private.podcast_dispatch_state set enabled=true;
update private.podcast_session_state set enabled=true,test_until=now()-interval '1 minute',consecutive_failures=0;
select is(private.podcast_dispatch_tick(),null::bigint,'expired trial never dispatches');
select ok(not (select enabled from private.podcast_session_state where id),'expiry pauses session maintenance');
do $$
declare r bigint; n integer;
begin
  -- pg_net sends only after COMMIT; this entire test rolls back.
  perform vault.create_secret(repeat('synthetic-test-only-',3),'globaltrend_podcast_github_dispatch');
  update private.podcast_dispatch_state set enabled=true,last_requested_at=null;
  update private.podcast_session_state set enabled=true,test_until=now()+interval '1 hour',
    consecutive_failures=0,last_verified_at=null,lease_until=null;
  r=private.podcast_dispatch_tick();
  select count(*) into n from net.http_request_queue where id=r
    and url='https://api.github.com/repos/parksunup/globaltrend/actions/workflows/podcast-cloud.yml/dispatches'
    and convert_from(body,'UTF8')::jsonb='{"ref":"main"}'::jsonb;
  if n<>1 then raise exception 'fixed dispatch route or branch mismatch'; end if;
  if private.podcast_dispatch_tick() is not null then raise exception 'duplicate clock request'; end if;
end; $$;
select pass('dispatch is restricted to the fixed main workflow and deduplicated');
select * from finish();
rollback;
