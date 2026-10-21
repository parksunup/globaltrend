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
