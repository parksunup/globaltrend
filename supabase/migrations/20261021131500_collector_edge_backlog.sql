-- Preserve failed details independently so one unsupported document cannot
-- prevent the rest of an approved source from being collected. No report changes.
create table public.collector_edge_backlog (
 id uuid primary key default gen_random_uuid(), source_id uuid not null references public.sources(id),
 url text not null, range_start date not null, range_end date not null,
 state jsonb not null, resolved boolean not null default false, updated_at timestamptz not null default now(),
 unique(source_id,url,range_start,range_end)
);
alter table public.collector_edge_backlog enable row level security;
revoke all on public.collector_edge_backlog from public,anon,authenticated;
grant select on public.collector_edge_backlog to service_role;
create or replace function public.collector_edge_take() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare m record; s public.collector_edge_sources; st jsonb;
begin
 if not (select enabled from public.collector_edge_control where singleton) then return null; end if;
 select * into m from pgmq.read('trend_collect',120,1); if not found then return null; end if;
 select * into s from public.collector_edge_sources where source_id=(m.message->>'source_id')::uuid;
 if m.message ? 'backlog_id' then
  select state into st from public.collector_edge_backlog where id=(m.message->>'backlog_id')::uuid;
 else
  st=s.state || jsonb_build_object('until',greatest(s.state->>'until',((now() at time zone 'Asia/Seoul')::date)::text));
 end if;
 return jsonb_build_object('msg_id',m.msg_id,'read_ct',m.read_ct,'source_id',s.source_id,'slug',s.slug,'state',st,'kind',m.message->>'kind');
end; $$;

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
    on conflict(source_id,url,range_start,range_end) do nothing returning id into backlog_id;
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

