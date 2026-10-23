-- Reuse one outstanding failed URL across daily range extensions. Historical
-- resolved rows and every collection event remain available.
alter table public.collector_edge_backlog drop constraint if exists collector_edge_backlog_source_id_url_range_start_range_end_key;
create unique index collector_edge_backlog_one_open_url on public.collector_edge_backlog(source_id,url) where not resolved;
create or replace function public.collector_edge_finish(p_msg_id bigint,p_read_ct integer,p_source_id uuid,p_state jsonb,p_result jsonb,p_execution_id text,p_started_at timestamptz,p_continue boolean,p_delay integer default 0) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare event_id uuid; m record; backlog_id uuid;
begin
 if octet_length(p_state::text)>250000 or octet_length(p_result::text)>100000 or p_delay not between 0 and 86400 then raise exception 'bounded state required'; end if;
 -- Expired or superseded consumers cannot commit a cursor or delete another lease.
 select * into m from pgmq.q_trend_collect where msg_id=p_msg_id and read_ct=p_read_ct and vt>now() and (message->>'source_id')::uuid=p_source_id for update;
 if not found then raise exception 'active queue lease required'; end if;
 if m.message ? 'backlog_id' then
  update public.collector_edge_backlog set state=p_state,resolved=not p_continue,updated_at=now() where id=(m.message->>'backlog_id')::uuid;
 else
  if p_state ? 'parked' then
   insert into public.collector_edge_backlog(source_id,url,range_start,range_end,state)
    values(p_source_id,p_state#>>'{parked,rows,0,url}',(p_state#>>'{parked,since}')::date,(p_state#>>'{parked,until}')::date,p_state->'parked')
    on conflict(source_id,url) where not resolved do nothing returning id into backlog_id;
   if backlog_id is null then
    update public.collector_edge_backlog set
     range_start=least(range_start,(p_state#>>'{parked,since}')::date),
     range_end=greatest(range_end,(p_state#>>'{parked,until}')::date),
     state=state || jsonb_build_object('since',least(range_start,(p_state#>>'{parked,since}')::date),'until',greatest(range_end,(p_state#>>'{parked,until}')::date)),
     updated_at=now()
    where source_id=p_source_id and url=p_state#>>'{parked,rows,0,url}' and not resolved;
   end if;
   if backlog_id is not null then perform pgmq.send('trend_collect',jsonb_build_object('source_id',p_source_id,'kind','backlog-retry','backlog_id',backlog_id),3600); end if;
  end if;
  update public.collector_edge_sources set state=p_state-'parked',queued=p_continue,updated_at=now() where source_id=p_source_id;
 end if;
 insert into public.collector_edge_events(source_id,msg_id,execution_id,trigger_kind,started_at,result)
 values(p_source_id,p_msg_id,p_execution_id,m.message->>'kind',p_started_at,p_result) returning id into event_id;
 perform pgmq.delete('trend_collect',p_msg_id);
 if p_continue then perform pgmq.send('trend_collect',m.message,p_delay);end if;
 return event_id;
end; $$;

