-- Execute in a transaction after the runtime migration; caller must roll back.
do $$
declare n integer; m jsonb; event_id uuid; rejected boolean=false;
begin
 if public.collector_edge_enqueue('test')<>0 then raise exception 'disabled enqueue wrote'; end if;
 update public.collector_edge_control set enabled=true;
 n=public.collector_edge_enqueue('test');
 if n<>9 then raise exception 'expected nine approved sources, got %',n; end if;
 if public.collector_edge_enqueue('test')<>0 then raise exception 'duplicate enqueue';end if;
 m=public.collector_edge_take();
 if m is null or m->>'source_id' is null then raise exception 'missing message';end if;
 begin
  perform public.collector_edge_finish((m->>'msg_id')::bigint,(m->>'read_ct')::integer+1,(m->>'source_id')::uuid,m->'state','{}','test-stale',now(),true,0);
 exception when others then rejected=true;
 end;
 if not rejected then raise exception 'stale lease accepted';end if;
 event_id=public.collector_edge_finish((m->>'msg_id')::bigint,(m->>'read_ct')::integer,(m->>'source_id')::uuid,(m->'state')||'{"offset":0,"failures":1}',
  '{"status":"failed","coverage_complete":false}','test',now(),true,120);
 if not exists(select 1 from public.collector_edge_events where id=event_id and result->>'status'='failed') then raise exception 'failure was lost';end if;
 if (select count(*) from pgmq.q_trend_collect)<>9 then raise exception 'retry disappeared or duplicated';end if;
 if exists(select 1 from pgmq.q_trend_collect where msg_id=(m->>'msg_id')::bigint) then raise exception 'old message not removed';end if;
end; $$;
select 'runtime disabled/dedup/lease/retry checks passed' as result;
do $$
declare m jsonb; eid uuid;
begin
 update public.collector_edge_sources set state=jsonb_build_object('since','2026-09-21','until',((now() at time zone 'Asia/Seoul')::date-1)::text);
 m=public.collector_edge_take();
 if m#>>'{state,until}' <> ((now() at time zone 'Asia/Seoul')::date)::text then raise exception 'range end frozen';end if;
 eid=public.collector_edge_finish((m->>'msg_id')::bigint,(m->>'read_ct')::int,(m->>'source_id')::uuid,
 (m->'state')||jsonb_build_object('parked',jsonb_build_object('since','2026-09-21','until','2026-10-21','rows',jsonb_build_array(jsonb_build_object('url','https://example.test/unread','title','synthetic rollback-only')),'is_backlog',true,'offset',0)),
 '{"status":"failed","coverage_complete":false}','rollback-test',now(),true,0);
 if (select count(*) from public.collector_edge_backlog)<>1 then raise exception 'failed item lost';end if;
 if (select count(*) from pgmq.q_trend_collect)<>10 then raise exception 'main or retry message lost';end if;
end; $$;
select 'range expansion and independent durable failed-item retry passed' as result;
do $$
declare b public.collector_edge_backlog; m record; new_state jsonb;
begin
 select * into b from public.collector_edge_backlog limit 1;
 select * into m from pgmq.q_trend_collect where message->>'source_id'=b.source_id::text and not(message ? 'backlog_id') limit 1;
 perform pgmq.set_vt('trend_collect',m.msg_id,120);
 new_state=jsonb_build_object('since',b.range_start,'until',b.range_end+1,'rows',b.state->'rows','offset',0,'is_backlog',true);
 perform public.collector_edge_finish(m.msg_id,m.read_ct,b.source_id,jsonb_build_object('since',b.range_start,'until',b.range_end+1,'parked',new_state),
  '{"status":"failed","coverage_complete":false}','duplicate-rollback-test',now(),true,0);
 if (select count(*) from public.collector_edge_backlog where not resolved)<>1 then raise exception 'failed URL duplicated on range extension';end if;
 if (select range_end from public.collector_edge_backlog where id=b.id)<>b.range_end+1 then raise exception 'pending range lost';end if;
 if (select count(*) from pgmq.q_trend_collect where message ? 'backlog_id')<>1 then raise exception 'duplicate retry message';end if;
end; $$;
select 'failed URL deduplication across range extensions passed' as result;
