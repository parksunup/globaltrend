-- Preserve deterministic authorization failures without issuing the same
-- disallowed request every hour. The row remains unresolved for review.
alter table public.collector_edge_backlog
 add column retryable boolean not null default true;

create or replace function public.collector_edge_finish(
 p_msg_id bigint,p_read_ct integer,p_source_id uuid,p_state jsonb,p_result jsonb,
 p_execution_id text,p_started_at timestamptz,p_continue boolean,p_delay integer default 0
) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare event_id uuid; m record; backlog_id uuid; retry boolean; parked jsonb;
begin
 if octet_length(p_state::text)>250000 or octet_length(p_result::text)>100000 or p_delay not between 0 and 86400 then
  raise exception 'bounded state required';
 end if;
 select * into m from pgmq.q_trend_collect
  where msg_id=p_msg_id and read_ct=p_read_ct and vt>now()
   and (message->>'source_id')::uuid=p_source_id for update;
 if not found then raise exception 'active queue lease required'; end if;

 if m.message ? 'backlog_id' then
  select retryable into strict retry from public.collector_edge_backlog
   where id=(m.message->>'backlog_id')::uuid for update;
  retry := retry and (p_result->>'reason' is distinct from 'unapproved_url');
  update public.collector_edge_backlog set
   state=case when retry then p_state else p_state||jsonb_build_object('retry_blocked_reason','unapproved_url') end,
   retryable=retry,
   resolved=case when retry then not p_continue else false end,
   updated_at=now()
   where id=(m.message->>'backlog_id')::uuid;
 else
  if p_state ? 'parked' then
   parked=p_state->'parked';
   retry := p_result->>'reason' is distinct from 'unapproved_url';
   if not retry then parked=parked||jsonb_build_object('retry_blocked_reason','unapproved_url'); end if;
   insert into public.collector_edge_backlog(source_id,url,range_start,range_end,state,retryable)
    values(p_source_id,parked#>>'{rows,0,url}',(parked->>'since')::date,(parked->>'until')::date,parked,retry)
    on conflict(source_id,url) where not resolved do nothing returning id into backlog_id;
   if backlog_id is null then
    update public.collector_edge_backlog set
     range_start=least(range_start,(parked->>'since')::date),
     range_end=greatest(range_end,(parked->>'until')::date),
     state=state||jsonb_build_object('since',least(range_start,(parked->>'since')::date),
      'until',greatest(range_end,(parked->>'until')::date))||
      case when retry then '{}'::jsonb else jsonb_build_object('retry_blocked_reason','unapproved_url') end,
     retryable=retryable and retry,updated_at=now()
     where source_id=p_source_id and url=parked#>>'{rows,0,url}' and not resolved
     returning retryable into retry;
   end if;
   if backlog_id is not null and retry then
    perform pgmq.send('trend_collect',jsonb_build_object('source_id',p_source_id,'kind','backlog-retry','backlog_id',backlog_id),3600);
   end if;
  end if;
  update public.collector_edge_sources set state=p_state-'parked',queued=p_continue,updated_at=now()
   where source_id=p_source_id;
 end if;

 insert into public.collector_edge_events(source_id,msg_id,execution_id,trigger_kind,started_at,result)
  values(p_source_id,p_msg_id,p_execution_id,m.message->>'kind',p_started_at,
   case when m.message ? 'backlog_id' and not retry then p_result||jsonb_build_object('retry_suppressed',true) else p_result end)
  returning id into event_id;
 perform pgmq.delete('trend_collect',p_msg_id);
 if p_continue and (not (m.message ? 'backlog_id') or retry) then
  perform pgmq.send('trend_collect',m.message,p_delay);
 end if;
 return event_id;
end; $$;
