-- Additive runtime. No existing function/report/source approval is replaced.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgmq;
select pgmq.create('trend_collect');

create table public.collector_edge_control (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 git_sha text not null, updated_at timestamptz not null default now()
);
insert into public.collector_edge_control(singleton,git_sha) values(true,'UNDEPLOYED');
create table public.collector_edge_sources (
 source_id uuid primary key references public.sources(id), slug text not null unique,
 state jsonb not null default '{}'::jsonb, queued boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.collector_edge_events (
 id uuid primary key default gen_random_uuid(), source_id uuid references public.sources(id),
 msg_id bigint, execution_id text, trigger_kind text not null,
 started_at timestamptz not null, finished_at timestamptz not null default now(),
 result jsonb not null
);
create table public.collector_edge_ticks (
 id uuid primary key default gen_random_uuid(), triggered_at timestamptz not null default now(),
 kind text not null, request_ids bigint[] not null default '{}'
);
alter table public.collector_edge_control enable row level security;
alter table public.collector_edge_sources enable row level security;
alter table public.collector_edge_events enable row level security;
alter table public.collector_edge_ticks enable row level security;
revoke all on public.collector_edge_control,public.collector_edge_sources,public.collector_edge_events,public.collector_edge_ticks from public,anon,authenticated;
grant select on public.collector_edge_control,public.collector_edge_sources,public.collector_edge_events,public.collector_edge_ticks to service_role;

-- Registry remains the same nine approved sources; their approval values are untouched.
insert into public.collector_edge_sources(source_id,slug)
select v.source_id::uuid,v.slug from (values
 ('a23ccfc6-4ad0-4ae7-bc85-0da35cfd2c1e','edpb'),('50ec0b84-7c04-4f85-895e-50bf43219a98','oecd'),
 ('9a15e0d8-d980-41e2-8613-309a566de227','curia'),('7e8b50e2-4dc6-4748-9de9-2d34c2380b47','cnil'),
 ('d7c96a28-2fca-49ad-a631-3a62cf0a03b9','ico'),('b4a60458-7c61-485e-8de2-0d1126398f06','dpc'),
 ('ea7465ec-48fb-4b6e-8f82-7345da7e6a75','pdpc'),('1f948872-529c-4db2-85af-4740d5f2bae3','ppc'),
 ('430bd32d-19b1-4752-8280-7b2d2acbda88','ftc')) v(source_id,slug) join public.sources s on s.id=v.source_id::uuid;

create function public.collector_edge_enqueue(p_kind text default 'scheduled') returns integer
language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare r record; n integer=0; progress jsonb; today date=(now() at time zone 'Asia/Seoul')::date;
begin
 if not (select enabled from public.collector_edge_control where singleton) then return 0; end if;
 if not (public.collector_capacity()->>'can_write')::boolean then return 0; end if;
 for r in select * from public.collector_edge_sources where not queued for update skip locked loop
  if not public.collector_source_allowed(r.source_id) then continue; end if;
  progress=public.collector_get_progress(r.source_id);
  update public.collector_edge_sources set queued=true,
   state=case when state='{}'::jsonb then jsonb_build_object(
    'since',coalesce(progress->>'range_start',((today-interval '1 month')::date)::text),
    'until',coalesce(progress->>'range_end',today::text),'legacy_cursor',progress->'cursor')
    else state end,updated_at=now() where source_id=r.source_id;
  perform pgmq.send('trend_collect',jsonb_build_object('source_id',r.source_id,'kind',p_kind));n=n+1;
 end loop;
 return n;
end; $$;

create function public.collector_edge_take() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare m record; s public.collector_edge_sources;
begin
 if not (select enabled from public.collector_edge_control where singleton) then return null; end if;
 select * into m from pgmq.read('trend_collect',120,1); if not found then return null; end if;
 select * into s from public.collector_edge_sources where source_id=(m.message->>'source_id')::uuid;
 return jsonb_build_object('msg_id',m.msg_id,'read_ct',m.read_ct,'source_id',s.source_id,'slug',s.slug,'state',s.state,'kind',m.message->>'kind');
end; $$;

create function public.collector_edge_finish(p_msg_id bigint,p_read_ct integer,p_source_id uuid,p_state jsonb,p_result jsonb,p_execution_id text,p_started_at timestamptz,p_continue boolean,p_delay integer default 0) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pgmq as $$
declare event_id uuid; m record;
begin
 if octet_length(p_state::text)>250000 or octet_length(p_result::text)>100000 or p_delay not between 0 and 86400 then raise exception 'bounded state required'; end if;
 -- Expired or superseded consumers cannot commit a cursor or delete another lease.
 select * into m from pgmq.q_trend_collect where msg_id=p_msg_id and read_ct=p_read_ct and vt>now() and (message->>'source_id')::uuid=p_source_id for update;
 if not found then raise exception 'active queue lease required'; end if;
 update public.collector_edge_sources set state=p_state,queued=p_continue,updated_at=now() where source_id=p_source_id;
 insert into public.collector_edge_events(source_id,msg_id,execution_id,trigger_kind,started_at,result)
 values(p_source_id,p_msg_id,p_execution_id,m.message->>'kind',p_started_at,p_result) returning id into event_id;
 perform pgmq.delete('trend_collect',p_msg_id);
 if p_continue then perform pgmq.send('trend_collect',m.message,p_delay);end if;
 return event_id;
end; $$;

create function public.collector_edge_tick() returns void
language plpgsql security definer set search_path=pg_catalog,public,pgmq,net,vault as $$
declare k text; r bigint; ids bigint[]='{}'; count_ready integer;
begin
 if not (select enabled from public.collector_edge_control where singleton) then return; end if;
 select count(*) into count_ready from (select 1 from pgmq.q_trend_collect where vt<=now() limit 9) x;
 if count_ready=0 then return; end if;
 select decrypted_secret into k from vault.decrypted_secrets where name='trend_collector_invocation_key';
 if k is null then raise exception 'collector invocation secret missing';end if;
 for i in 1..count_ready loop
  select net.http_post(url:='https://emlgwhkgaihhrirhdpnp.supabase.co/functions/v1/trend-collector',
   headers:=jsonb_build_object('Content-Type','application/json','x-collector-key',k),body:='{"action":"consume"}'::jsonb,timeout_milliseconds:=90000) into r;
  ids=array_append(ids,r);
 end loop;
 insert into public.collector_edge_ticks(kind,request_ids)values('cron',ids);
end; $$;

revoke all on function public.collector_edge_enqueue(text),public.collector_edge_take(),public.collector_edge_finish(bigint,integer,uuid,jsonb,jsonb,text,timestamptz,boolean,integer),public.collector_edge_tick() from public,anon,authenticated;
grant execute on function public.collector_edge_take(),public.collector_edge_finish(bigint,integer,uuid,jsonb,jsonb,text,timestamptz,boolean,integer) to service_role;
-- Cron creation/activation is an explicit deployment step, not a migration side effect.
