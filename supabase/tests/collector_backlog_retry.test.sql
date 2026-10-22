begin;
select plan(4);

select has_column('public','collector_edge_backlog','retryable',
 'backlog records distinguish retryability from resolution');

create temporary table test_blocked_backlog(id uuid primary key) on commit drop;
do $$
declare sid uuid; bid uuid; claim jsonb;
begin
 -- Local seeds generate source IDs; production-only PDPC IDs are not fixtures.
 select id into strict sid from public.sources where name='EDPB 뉴스·보도자료';
 insert into public.collector_edge_sources(source_id,slug) values(sid,'test-backlog-retry')
  on conflict(source_id) do nothing;
 update public.collector_edge_control set enabled=true where singleton;
 insert into public.collector_edge_backlog(source_id,url,range_start,range_end,state)
 values(sid,'https://www.mci.gov.sg/example',date '2026-10-21',date '2026-10-22','{"rows":[{"url":"https://www.mci.gov.sg/example"}]}'::jsonb)
 returning id into bid;
 insert into test_blocked_backlog values(bid);
 perform pgmq.send('trend_collect',jsonb_build_object('source_id',sid,'kind','backlog-retry','backlog_id',bid));
 claim:=public.collector_edge_take();
 perform public.collector_edge_finish((claim->>'msg_id')::bigint,(claim->>'read_ct')::integer,
  sid,coalesce(claim->'state','{}'::jsonb),'{"status":"failed","reason":"unapproved_url"}'::jsonb,
  'pgTap-blocked-backlog','2026-10-22T00:00:00Z',true,3600);
end $$;

select is((select b.retryable from public.collector_edge_backlog b join test_blocked_backlog t using(id)),false,
 'an unapproved URL remains available for review and is no longer retried');
select is((select b.resolved from public.collector_edge_backlog b join test_blocked_backlog t using(id)),false,
 'a blocked URL is not mislabeled as successfully resolved');
select is((select count(*)::integer from pgmq.q_trend_collect q join test_blocked_backlog t
 on q.message->>'backlog_id'=t.id::text),0,'the deterministic failure is not re-enqueued');

select * from finish();
rollback;
