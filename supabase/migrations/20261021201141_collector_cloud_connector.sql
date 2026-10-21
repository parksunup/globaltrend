-- Existing queues, Edge cursors and backlog remain in place. Opt-in per source.
create table public.collector_cloud_routes (
 source_id uuid primary key references public.collector_edge_sources(source_id),
 enabled boolean not null default false,
 cursor jsonb, range_start date, range_end date,
 worker text, lease_token uuid, lease_until timestamptz,
 msg_id bigint, read_ct integer, updated_at timestamptz not null default now()
);
alter table public.collector_cloud_routes enable row level security;
revoke all on public.collector_cloud_routes from public,anon,authenticated;
grant select on public.collector_cloud_routes to service_role;
insert into public.collector_cloud_routes(source_id)
 select source_id from public.collector_edge_sources where slug in ('oecd','ftc');

create function public.collector_cloud_route(p_slug text,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare s public.collector_edge_sources; progress jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('collector-executor-routing'));
 select * into strict s from public.collector_edge_sources where slug=p_slug and slug in ('oecd','ftc') for update;
 if p_enabled is null then raise exception 'explicit route state required'; end if;
 if exists(select 1 from public.collector_cloud_routes where source_id=s.source_id and lease_until>now())
 or exists(select 1 from pgmq.q_trend_collect where (message->>'source_id')::uuid=s.source_id and read_ct>0 and vt>now()) then
  raise exception 'active source lease; retry after expiry';
 end if;
 progress=public.collector_get_progress(s.source_id);
 update public.collector_cloud_routes set enabled=p_enabled,
  range_start=coalesce(range_start,(s.state->>'since')::date,(progress->>'range_start')::date),
  range_end=greatest(range_end,(s.state->>'until')::date,(now() at time zone 'Asia/Seoul')::date),
  -- A different adapter must restart discovery within the preserved range.
  -- Edge and legacy Python cursor are retained for audit, never copied blindly.
  updated_at=now() where source_id=s.source_id;
 return jsonb_build_object('slug',p_slug,'executor',case when p_enabled then 'cloud-python' else 'edge' end,'edge_state_preserved',true);
end; $$;

-- Same signature: deployed Edge code does not need redeployment to honor routing.
create or replace function public.collector_edge_take() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare m record; s public.collector_edge_sources; st jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('collector-executor-routing'));
 if not (select enabled from public.collector_edge_control where singleton) then return null; end if;
 select q.* into m from pgmq.q_trend_collect q
 where q.vt<=now() and not exists(select 1 from public.collector_cloud_routes r
  where r.source_id=(q.message->>'source_id')::uuid and r.enabled)
 order by q.msg_id limit 1 for update of q skip locked;
 if not found then return null; end if;
 update pgmq.q_trend_collect set vt=now()+interval '120 seconds',read_ct=read_ct+1 where msg_id=m.msg_id returning * into m;
 select * into strict s from public.collector_edge_sources where source_id=(m.message->>'source_id')::uuid;
 if m.message ? 'backlog_id' then
  select state into st from public.collector_edge_backlog where id=(m.message->>'backlog_id')::uuid;
 else
  st=s.state || jsonb_build_object('until',greatest(s.state->>'until',((now() at time zone 'Asia/Seoul')::date)::text));
 end if;
 return jsonb_build_object('msg_id',m.msg_id,'read_ct',m.read_ct,'source_id',s.source_id,'slug',s.slug,'state',st,'kind',m.message->>'kind');
end; $$;

create function public.collector_cloud_take(p_worker text,p_slug text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare r public.collector_cloud_routes; s public.collector_edge_sources; m record;
begin
 if nullif(btrim(p_worker),'') is null or length(p_worker)>160 then raise exception 'bounded worker required'; end if;
 perform pg_advisory_xact_lock(hashtext('collector-executor-routing'));
 if not (select enabled from public.collector_edge_control where singleton) then return null; end if;
 select * into strict s from public.collector_edge_sources where slug=p_slug and slug in ('oecd','ftc');
 select * into strict r from public.collector_cloud_routes where source_id=s.source_id for update;
 if not r.enabled or r.lease_until>now() then return null; end if;
 if not public.collector_source_allowed(s.source_id) or not (public.collector_capacity()->>'can_write')::boolean then
  raise exception 'source approval or capacity gate failed'; end if;
 select q.* into m from pgmq.q_trend_collect q where (q.message->>'source_id')::uuid=s.source_id
  and not (q.message ? 'backlog_id') and q.vt<=now() order by q.msg_id limit 1 for update skip locked;
 if not found then return null; end if;
 update pgmq.q_trend_collect set vt=now()+interval '10 minutes',read_ct=read_ct+1 where msg_id=m.msg_id returning * into m;
 update public.collector_cloud_routes set worker=p_worker,lease_token=gen_random_uuid(),lease_until=m.vt,
  msg_id=m.msg_id,read_ct=m.read_ct,range_end=greatest(range_end,(now() at time zone 'Asia/Seoul')::date),updated_at=now()
  where source_id=s.source_id returning * into r;
 return jsonb_build_object('slug',s.slug,'source_id',s.source_id,'worker',r.worker,'lease_token',r.lease_token,
  'lease_until',r.lease_until,'msg_id',m.msg_id,'read_ct',m.read_ct,'since',r.range_start,'until',r.range_end,'cursor',r.cursor);
end; $$;

create function public.collector_cloud_commit(p_source_id uuid,p_worker text,p_lease_token uuid,p_bundle jsonb,p_execution_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare r public.collector_cloud_routes; m record; op jsonb; saved jsonb='[]'; one_saved jsonb;
 result jsonb; event_id uuid; delay_seconds integer; next_cursor jsonb;
begin
 select * into strict r from public.collector_cloud_routes where source_id=p_source_id for update;
 if not r.enabled or r.worker is distinct from p_worker or r.lease_token is distinct from p_lease_token or r.lease_until<=now() then
  raise exception 'active cloud source lease required'; end if;
 select * into m from pgmq.q_trend_collect where msg_id=r.msg_id and read_ct=r.read_ct and vt>now()
  and (message->>'source_id')::uuid=p_source_id for update;
 if not found then raise exception 'active queue lease required'; end if;
 if not public.collector_source_allowed(p_source_id) or not (public.collector_capacity()->>'can_write')::boolean then
  raise exception 'source approval or capacity gate failed'; end if;
 if octet_length(p_bundle::text)>500000 or jsonb_typeof(p_bundle->'operations') is distinct from 'array'
  or jsonb_array_length(p_bundle->'operations')>1 or nullif(p_execution_id,'') is null or length(p_execution_id)>200
  or p_bundle#>>'{result,since}' is distinct from r.range_start::text
  or p_bundle#>>'{result,until}' is distinct from r.range_end::text then raise exception 'bounded matching bundle required'; end if;
 for op in select value from jsonb_array_elements(p_bundle->'operations') loop
  if op->>'p_source_id' is distinct from p_source_id::text then raise exception 'operation source mismatch'; end if;
  select to_jsonb(x) into one_saved from public.ingest_source_item(
   p_source_id,op->>'p_external_id',op->>'p_canonical_url',op->>'p_title_original',
   (op->>'p_published_at')::timestamptz,(op->>'p_event_date')::date,(op->>'p_fetched_at')::timestamptz,
   op->>'p_language_code',op->>'p_document_type',op->>'p_content_text',op->>'p_content_hash',
   op->>'p_raw_storage_path',op->'p_metadata',op->>'p_instruction_version') x;
  saved=saved||jsonb_build_array(one_saved);
 end loop;
 result=(p_bundle->'result')||jsonb_build_object('saved',saved,'execution_id',p_execution_id,
  'msg_id',r.msg_id,'read_ct',r.read_ct,'worker',p_worker,'runtime','cloud-python-connector');
 next_cursor=nullif(p_bundle->'cursor','null'::jsonb);
 -- Never promote coverage on an unverified Python/RSS step, even if a caller claims it.
 result=result||jsonb_build_object('coverage_complete',false);
 delay_seconds=case when result->>'status'='failed' then 3600 when next_cursor is null then 86400 else 0 end;
 update public.collector_cloud_routes set cursor=next_cursor,worker=null,lease_token=null,lease_until=null,
  msg_id=null,read_ct=null,updated_at=now() where source_id=p_source_id;
 perform public.collector_set_progress(p_source_id,r.range_start,r.range_end,next_cursor,false);
 insert into public.collector_edge_events(source_id,msg_id,execution_id,trigger_kind,started_at,result)
 values(p_source_id,m.msg_id,p_execution_id,m.message->>'kind',coalesce((result->>'started_at')::timestamptz,now()),result) returning id into event_id;
 perform pgmq.delete('trend_collect',m.msg_id);
 perform pgmq.send('trend_collect',m.message,delay_seconds);
 return jsonb_build_object('event_id',event_id,'execution_id',p_execution_id,'saved',saved,'retry_after_seconds',delay_seconds,'coverage_complete',false);
end; $$;

revoke all on function public.collector_cloud_route(text,boolean),public.collector_cloud_take(text,text),
 public.collector_cloud_commit(uuid,text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.collector_cloud_route(text,boolean),public.collector_cloud_take(text,text),
 public.collector_cloud_commit(uuid,text,uuid,jsonb,text) to service_role;
