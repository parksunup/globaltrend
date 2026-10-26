-- Preserve one exact FTC feed listing across the per-item cloud claims. The
-- worker may fetch the live RSS only when starting a scan; after row zero is
-- committed, all later claims read the staged rows until that scan completes.
-- No route, approval, queue, or existing cursor is reset by this migration.

create table public.collector_cloud_listing_scans (
  id uuid primary key,
  source_id uuid not null references public.collector_edge_sources(source_id) on delete cascade,
  listing_url text not null check (listing_url='https://www.ftc.gov/feeds/press-release-consumer-protection.xml'),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count between 1 and 100),
  status text not null check (status in ('active','completed')),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  unique (source_id,id),
  check ((status='active' and completed_at is null) or (status='completed' and completed_at is not null))
);
create unique index collector_cloud_one_active_listing_scan
  on public.collector_cloud_listing_scans(source_id) where status='active';
create index collector_cloud_latest_completed_listing_scan
  on public.collector_cloud_listing_scans(source_id,completed_at desc) where status='completed';

create table public.collector_cloud_listing_rows (
  source_id uuid not null,
  scan_id uuid not null,
  ordinal integer not null check (ordinal between 0 and 99),
  canonical_url text not null check (octet_length(canonical_url)<=2048
   and canonical_url ~ '^https://www[.]ftc[.]gov/' and position('?' in canonical_url)=0 and position('#' in canonical_url)=0),
  url_hash text not null check (url_hash ~ '^[0-9a-f]{64}$'),
  row_data jsonb not null check (jsonb_typeof(row_data)='object' and octet_length(row_data::text)<=5000
   and row_data->>'url'=canonical_url),
  outcome text not null default 'pending' check (outcome in ('pending','processed','parked')),
  primary key (scan_id,ordinal),
  unique (scan_id,canonical_url),
  foreign key (source_id,scan_id) references public.collector_cloud_listing_scans(source_id,id) on delete cascade
);
alter table public.collector_cloud_listing_scans enable row level security;
alter table public.collector_cloud_listing_rows enable row level security;
revoke all on public.collector_cloud_listing_scans,public.collector_cloud_listing_rows from public,anon,authenticated,service_role;

create or replace function private.collector_cloud_cursor_valid(c jsonb,slug text) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare field text;
begin
 if c='null'::jsonb then return true; end if;
 if c is null or jsonb_typeof(c)<>'object' or octet_length(c::text)>4000
  or jsonb_typeof(c->'page') is distinct from 'string'
  or (c->>'page') !~ (case when slug='ftc' then '^https://www[.]ftc[.]gov/' else '^https://www[.]oecd[.]org/' end)
  or jsonb_typeof(c->'offset') is distinct from 'number' or (c->>'offset') !~ '^[0-9]{1,6}$' then return false; end if;
 foreach field in array array['failures','unknown_dates','excluded_unapproved_host_count'] loop
  if c ? field and (jsonb_typeof(c->field) is distinct from 'number' or (c->>field) !~ '^[0-9]{1,9}$') then return false; end if;
 end loop;
 if c ? 'had_pagination' and jsonb_typeof(c->'had_pagination') is distinct from 'boolean' then return false; end if;
 if c ? 'fingerprint' and (c->>'fingerprint') !~ '^[0-9a-f]{64}$' then return false; end if;
 if c ? 'snapshot_id' and (c->>'snapshot_id') !~ '^[0-9a-fA-F-]{36}$' then return false; end if;
 if c ? 'processed_url_hashes' then
  if jsonb_typeof(c->'processed_url_hashes') is distinct from 'array' or jsonb_array_length(c->'processed_url_hashes')>50 then return false; end if;
  if exists(select 1 from jsonb_array_elements(c->'processed_url_hashes') h(value)
   where jsonb_typeof(value) is distinct from 'string' or value#>>'{}' !~ '^[0-9a-f]{64}$') then return false; end if;
 end if;
 return true;
end; $$;
revoke all on function private.collector_cloud_cursor_valid(jsonb,text) from public,anon,authenticated;

create or replace function public.collector_cloud_take(p_worker text,p_slug text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,pgmq as $$
declare r public.collector_cloud_routes; s public.collector_edge_sources; m record; b public.collector_edge_backlog;
 scan public.collector_cloud_listing_scans; staged_row public.collector_cloud_listing_rows;
 previous_hashes jsonb; snapshot_claim jsonb;
begin
 if nullif(btrim(p_worker),'') is null or length(p_worker)>160 then raise exception 'bounded worker required'; end if;
 perform pg_advisory_xact_lock(hashtext('collector-executor-routing'));
 if not (select enabled from public.collector_edge_control where singleton) then return null; end if;
 select * into strict s from public.collector_edge_sources where slug=p_slug and slug in ('oecd','ftc');
 select * into strict r from public.collector_cloud_routes where source_id=s.source_id for update;
 if not r.enabled or r.lease_until>clock_timestamp() then return null; end if;
 if not public.collector_source_allowed(s.source_id) or not (public.collector_capacity()->>'can_write')::boolean then
  raise exception 'source approval or capacity gate failed'; end if;
 select q.* into m from pgmq.q_trend_collect q where (q.message->>'source_id')::uuid=s.source_id
  and q.vt<=clock_timestamp() and (not (q.message ? 'backlog_id') or exists(
   select 1 from public.collector_edge_backlog bl where bl.id=(q.message->>'backlog_id')::uuid and not bl.resolved))
  order by q.msg_id limit 1 for update skip locked;
 if not found then return null; end if;
 update pgmq.q_trend_collect set vt=clock_timestamp()+interval '10 minutes',read_ct=read_ct+1 where msg_id=m.msg_id returning * into m;
 update public.collector_cloud_routes set worker=p_worker,lease_token=gen_random_uuid(),lease_until=m.vt,
  msg_id=m.msg_id,read_ct=m.read_ct,range_end=greatest(range_end,(clock_timestamp() at time zone 'Asia/Seoul')::date),updated_at=clock_timestamp()
  where source_id=s.source_id returning * into r;
 if m.message ? 'backlog_id' then
  select * into strict b from public.collector_edge_backlog where id=(m.message->>'backlog_id')::uuid and source_id=s.source_id;
 end if;
 if s.slug='ftc' and r.cursor ? 'snapshot_id' and b.id is null then
  select * into strict scan from public.collector_cloud_listing_scans where id=(r.cursor->>'snapshot_id')::uuid
   and source_id=s.source_id and status='active';
  if (r.cursor->>'offset')::integer >= scan.row_count then raise exception 'FTC snapshot cursor out of bounds'; end if;
  select * into strict staged_row from public.collector_cloud_listing_rows
   where scan_id=scan.id and source_id=s.source_id and ordinal=(r.cursor->>'offset')::integer;
  snapshot_claim=jsonb_build_object('id',scan.id,'listing_url',scan.listing_url,'fingerprint',scan.fingerprint,
   'row_count',scan.row_count,'ordinal',staged_row.ordinal,'row',staged_row.row_data);
 end if;
 select coalesce(jsonb_agg(h order by h),'[]'::jsonb) into previous_hashes from (
  select distinct value as h from jsonb_array_elements_text(coalesce(r.cursor->'processed_url_hashes','[]'::jsonb))
  union
  select lr.url_hash from public.collector_cloud_listing_rows lr
   where lr.scan_id=(select id from public.collector_cloud_listing_scans where source_id=s.source_id and status='completed'
    order by completed_at desc limit 1)
 ) seen;
 return jsonb_build_object('slug',s.slug,'source_id',s.source_id,'worker',r.worker,'lease_token',r.lease_token,
  'lease_until',r.lease_until,'msg_id',m.msg_id,'read_ct',m.read_ct,'since',coalesce(b.range_start,r.range_start),
  'until',coalesce(b.range_end,r.range_end),'cursor',case when b.id is null then r.cursor else null end,
  'backlog_id',b.id,'detail',case when b.id is null then null else jsonb_build_object('url',b.url,'title',b.state#>>'{rows,0,title}') end,
  'snapshot_protocol',case when s.slug='ftc' then 1 else null end,
  'snapshot',snapshot_claim,'previous_listing_hashes',case when s.slug='ftc' then previous_hashes else null end);
end; $$;

create or replace function public.collector_cloud_commit(
 p_source_id uuid,p_worker text,p_lease_token uuid,p_bundle jsonb,p_execution_id text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,pgmq,extensions as $$
declare r public.collector_cloud_routes; m record; b public.collector_edge_backlog; slug text; op jsonb;
 saved jsonb='[]'; one_saved jsonb; result jsonb; event_id uuid; delay_seconds integer; next_cursor jsonb;
 failure jsonb; backlog_id uuid; failed_cursor jsonb; source_since date; source_until date;
 recheck_at timestamptz; committed_at timestamptz; listing jsonb; snap_id uuid; snap_ref jsonb;
 rows_json jsonb; row_json jsonb; row_i integer; row_url text; row_hash text; row_count integer;
 active_scan public.collector_cloud_listing_scans; existing_scan public.collector_cloud_listing_scans;
begin
 select * into strict r from public.collector_cloud_routes where source_id=p_source_id for update;
 if not r.enabled or r.worker is null or r.lease_token is null or r.lease_until is null or r.msg_id is null or r.read_ct is null
  or p_worker is null or p_lease_token is null or r.worker is distinct from p_worker or r.lease_token is distinct from p_lease_token
  or r.lease_until<=clock_timestamp() then raise exception 'active cloud source lease required'; end if;
 select * into m from pgmq.q_trend_collect where msg_id=r.msg_id and read_ct=r.read_ct
  and (message->>'source_id')::uuid=p_source_id for update;
 if not found or m.vt<=clock_timestamp() or r.lease_until<=clock_timestamp() then raise exception 'active queue lease required'; end if;
 select s.slug into strict slug from public.collector_edge_sources s where source_id=p_source_id;
 if m.message ? 'backlog_id' then
  select * into strict b from public.collector_edge_backlog where id=(m.message->>'backlog_id')::uuid and source_id=p_source_id and not resolved for update;
 end if;
 source_since=coalesce(b.range_start,r.range_start);source_until=coalesce(b.range_end,r.range_end);
 if not public.collector_source_allowed(p_source_id) or not (public.collector_capacity()->>'can_write')::boolean then
  raise exception 'source approval or capacity gate failed'; end if;
 if jsonb_typeof(p_bundle) is distinct from 'object' or octet_length(p_bundle::text)>500000
  or not (p_bundle ? 'cursor') or not private.collector_cloud_cursor_valid(p_bundle->'cursor',slug)
  or jsonb_typeof(p_bundle->'operations') is distinct from 'array' or jsonb_array_length(p_bundle->'operations')>1
  or jsonb_typeof(p_bundle->'result') is distinct from 'object' or (p_bundle#>>'{result,status}') not in ('partial','failed','success')
  or p_bundle#>>'{result,status}' is null or nullif(p_execution_id,'') is null or length(p_execution_id)>200
  or p_bundle#>>'{result,since}' is distinct from source_since::text
  or p_bundle#>>'{result,until}' is distinct from source_until::text then raise exception 'bounded matching bundle required'; end if;
 failure=nullif(p_bundle->'failure','null'::jsonb);
 listing=nullif(p_bundle->'listing_snapshot','null'::jsonb); snap_ref=nullif(p_bundle->'snapshot_ref','null'::jsonb);
 next_cursor=nullif(p_bundle->'cursor','null'::jsonb);

 -- Validate/stage a fresh FTC listing before any source item write. The first
 -- commit must contain ordinal zero and advance only to offset one.
 if listing is not null then
  if slug<>'ftc' or b.id is not null or r.cursor ? 'snapshot_id' or snap_ref is not null
   or jsonb_typeof(listing)<>'object' or jsonb_typeof(listing->'rows')<>'array'
   or jsonb_array_length(listing->'rows') not between 1 and 100
   or jsonb_typeof(listing->'id')<>'string' or jsonb_typeof(listing->'fingerprint')<>'string'
   or listing->>'fingerprint' !~ '^[0-9a-f]{64}$'
   or listing->>'listing_url'<>'https://www.ftc.gov/feeds/press-release-consumer-protection.xml'
   or (next_cursor->>'offset')::integer<>0
   or next_cursor->>'snapshot_id' is distinct from listing->>'id'
   or (next_cursor->>'page') is distinct from listing->>'listing_url'
   or (next_cursor->>'fingerprint') is distinct from listing->>'fingerprint' then raise exception 'invalid FTC listing snapshot'; end if;
  snap_id=(listing->>'id')::uuid; rows_json=listing->'rows'; row_count=jsonb_array_length(rows_json);
  if exists(select 1 from jsonb_array_elements(rows_json) x where jsonb_typeof(x)<>'object'
    or jsonb_typeof(x->'url')<>'string' or jsonb_typeof(x->'title')<>'string'
    or octet_length(x->>'url')>2048 or octet_length(x->>'title')>1000
    or x->>'url' !~ '^https://www[.]ftc[.]gov/' or position('?' in x->>'url')>0 or position('#' in x->>'url')>0
    or jsonb_typeof(coalesce(x->'date_observations','[]'::jsonb))<>'array'
    or jsonb_array_length(coalesce(x->'date_observations','[]'::jsonb))>4 or octet_length(x::text)>5000)
   or (select count(distinct x->>'url') from jsonb_array_elements(rows_json) x)<>row_count then
   raise exception 'FTC listing rows outside bounds or allowlist'; end if;
  if exists(select 1 from public.collector_cloud_listing_scans where source_id=p_source_id and status='active') then
   raise exception 'active FTC listing snapshot already exists'; end if;
  insert into public.collector_cloud_listing_scans(id,source_id,listing_url,fingerprint,row_count,status)
   values(snap_id,p_source_id,listing->>'listing_url',listing->>'fingerprint',row_count,'active');
  for row_i in 0..row_count-1 loop
   row_json=rows_json->row_i; row_url=row_json->>'url';
   row_hash=encode(extensions.digest(convert_to(row_url,'UTF8'),'sha256'),'hex');
   insert into public.collector_cloud_listing_rows(source_id,scan_id,ordinal,canonical_url,url_hash,row_data)
    values(p_source_id,snap_id,row_i,row_url,row_hash,row_json);
  end loop;
 end if;

 if b.id is null and failure is not null and snap_ref is null then
  failed_cursor=failure->'cursor';
  if jsonb_typeof(failure) is distinct from 'object' or not private.collector_cloud_cursor_valid(failed_cursor,slug)
   or failure->>'url' is null or nullif(failure->>'reason','') is null
   or failure->>'url' is distinct from p_bundle#>>'{result,failed_url}'
   or (p_bundle#>>'{cursor,offset}')::integer<>(failed_cursor->>'offset')::integer+1
   or ((p_bundle->'cursor') - 'offset'::text) is distinct from (failed_cursor - 'offset'::text) then raise exception 'matching parked failure required'; end if;
 end if;

 -- A durable row is marked only under the exact active snapshot cursor. The
 -- DB lease token/read count above remains the authority for every step.
 if snap_ref is not null and listing is null then
  snap_id=(snap_ref->>'id')::uuid; row_i=(snap_ref->>'ordinal')::integer;
  select * into strict active_scan from public.collector_cloud_listing_scans
   where id=snap_id and source_id=p_source_id and status='active' for update;
  if slug<>'ftc' or r.cursor->>'snapshot_id' is distinct from snap_id::text
   or row_i<>(r.cursor->>'offset')::integer or row_i<0 or row_i>=active_scan.row_count
   or (next_cursor->>'offset')::integer<>(case when row_i+1=active_scan.row_count then 0 else row_i+1 end) then
   raise exception 'FTC snapshot cursor mismatch'; end if;
  if row_i+1<active_scan.row_count and next_cursor->>'snapshot_id' is distinct from snap_id::text then
   raise exception 'FTC snapshot cursor mismatch'; end if;
  if failure is not null and (failure->>'url' is distinct from p_bundle#>>'{result,failed_url}'
    or nullif(failure->>'reason','') is null or failure->'cursor'->>'snapshot_id' is distinct from snap_id::text
    or (failure->'cursor'->>'offset')::integer<>row_i) then raise exception 'FTC snapshot parked failure mismatch'; end if;
  update public.collector_cloud_listing_rows set outcome=case when failure is null then 'processed' else 'parked' end
   where source_id=p_source_id and scan_id=snap_id and ordinal=row_i and outcome='pending';
  if not found then raise exception 'FTC listing row is not pending'; end if;
  if row_i+1=active_scan.row_count then
   if next_cursor ? 'snapshot_id' or p_bundle#>>'{result,listing_scan_complete}' is distinct from 'true' then
    raise exception 'FTC final listing row must complete its snapshot'; end if;
   update public.collector_cloud_listing_scans set status='completed',completed_at=clock_timestamp() where id=snap_id;
   delete from public.collector_cloud_listing_scans old where old.source_id=p_source_id and old.status='completed'
    and old.id<>snap_id and old.completed_at < (select completed_at from public.collector_cloud_listing_scans where id=snap_id);
  elsif next_cursor->>'snapshot_id' is distinct from snap_id::text then raise exception 'FTC snapshot ended before final row'; end if;
 end if;

 for op in select value from jsonb_array_elements(p_bundle->'operations') loop
  if op->>'p_source_id' is distinct from p_source_id::text then raise exception 'operation source mismatch'; end if;
  select to_jsonb(x) into one_saved from public.ingest_source_item(
   p_source_id,op->>'p_external_id',op->>'p_canonical_url',op->>'p_title_original',(op->>'p_published_at')::timestamptz,
   (op->>'p_event_date')::date,(op->>'p_fetched_at')::timestamptz,op->>'p_language_code',op->>'p_document_type',
   op->>'p_content_text',op->>'p_content_hash',op->>'p_raw_storage_path',op->'p_metadata',op->>'p_instruction_version') x;
  saved=saved||jsonb_build_array(one_saved);
 end loop;
 if b.id is null and failure is not null then
  insert into public.collector_edge_backlog(source_id,url,range_start,range_end,state)
  values(p_source_id,failure->>'url',source_since,source_until,jsonb_build_object('cloud_python',true,'failure',failure,
   'since',source_since,'until',source_until,'rows',jsonb_build_array(jsonb_build_object('url',failure->>'url','title',failure->>'title'))))
  on conflict(source_id,url) where not resolved do nothing returning id into backlog_id;
  if backlog_id is not null then perform pgmq.send('trend_collect',jsonb_build_object('source_id',p_source_id,'kind','cloud-backlog-retry','backlog_id',backlog_id),3600);
  else update public.collector_edge_backlog set range_start=least(range_start,source_since),range_end=greatest(range_end,source_until),
   state=state||jsonb_build_object('cloud_failure',failure),updated_at=clock_timestamp() where source_id=p_source_id and url=failure->>'url' and not resolved; end if;
 end if;
 result=(p_bundle->'result')||jsonb_build_object('saved',saved,'execution_id',p_execution_id,'msg_id',r.msg_id,
  'read_ct',r.read_ct,'worker',p_worker,'runtime','cloud-python-connector','coverage_complete',false,'backlog_id',b.id);
 next_cursor=nullif(p_bundle->'cursor','null'::jsonb);
 if b.id is not null then
  if result->>'status'='failed' then delay_seconds=3600;
  elsif p_bundle->>'backlog_resolved'='true' and (jsonb_array_length(saved)=1 or result->>'reason'='backlog_out_of_range') then delay_seconds=-1;
  else raise exception 'backlog outcome required'; end if;
  update public.collector_edge_backlog set resolved=delay_seconds=-1,state=state||jsonb_build_object('cloud_last_result',result),updated_at=clock_timestamp() where id=b.id;
 else
  if result->>'status'='failed' then delay_seconds=3600;
  elsif next_cursor is null or result->>'listing_scan_complete'='true' then
   committed_at=clock_timestamp(); recheck_at=private.collector_cloud_daily_recheck_at(committed_at);
   delay_seconds=greatest(1,ceil(extract(epoch from recheck_at-committed_at))::integer);
  else delay_seconds=0; end if;
  update public.collector_cloud_routes set cursor=next_cursor where source_id=p_source_id;
  perform public.collector_set_progress(p_source_id,r.range_start,r.range_end,next_cursor,false);
 end if;
 update public.collector_cloud_routes set worker=null,lease_token=null,lease_until=null,msg_id=null,read_ct=null,updated_at=clock_timestamp() where source_id=p_source_id;
 insert into public.collector_edge_events(source_id,msg_id,execution_id,trigger_kind,started_at,result)
 values(p_source_id,m.msg_id,p_execution_id,m.message->>'kind',coalesce((result->>'started_at')::timestamptz,clock_timestamp()),result) returning id into event_id;
 perform pgmq.delete('trend_collect',m.msg_id);
 if delay_seconds>=0 then perform pgmq.send('trend_collect',m.message,delay_seconds); end if;
 return jsonb_build_object('event_id',event_id,'execution_id',p_execution_id,'saved',saved,'retry_after_seconds',delay_seconds,
  'coverage_complete',false,'backlog_id',b.id);
end; $$;

revoke all on function public.collector_cloud_take(text,text),public.collector_cloud_commit(uuid,text,uuid,jsonb,text)
 from public,anon,authenticated;
grant execute on function public.collector_cloud_take(text,text),public.collector_cloud_commit(uuid,text,uuid,jsonb,text)
 to service_role;
