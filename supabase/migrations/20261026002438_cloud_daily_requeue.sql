-- Make a finished OECD/FTC discovery pass visible before the next daily run.
-- The prior 24-hour delay was measured from each run's completion, so a 04:00
-- daily producer could repeatedly start before its queue item became visible.
-- Keep failure retry (1 hour), in-pass continuation (immediate), backlog, lease,
-- approval, capacity, and coverage behavior unchanged.
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
 if c ? 'processed_url_hashes' then
  if jsonb_typeof(c->'processed_url_hashes') is distinct from 'array' then return false; end if;
  if jsonb_array_length(c->'processed_url_hashes')>50 then return false; end if;
  if exists(select 1 from jsonb_array_elements(c->'processed_url_hashes') h(value)
   where jsonb_typeof(value) is distinct from 'string' or value#>>'{}' !~ '^[0-9a-f]{64}$') then return false; end if;
 end if;
 return true;
end; $$;
revoke all on function private.collector_cloud_cursor_valid(jsonb,text) from public,anon,authenticated;

create or replace function private.collector_cloud_daily_recheck_at(p_now timestamptz) returns timestamptz
language plpgsql stable set search_path=pg_catalog as $$
declare recheck_at timestamptz;
begin
 recheck_at=(date_trunc('day',p_now at time zone 'Asia/Seoul')+interval '3 hours') at time zone 'Asia/Seoul';
 if recheck_at<=p_now then recheck_at=recheck_at+interval '1 day'; end if;
 return recheck_at;
end; $$;
revoke all on function private.collector_cloud_daily_recheck_at(timestamptz) from public,anon,authenticated;

create or replace function public.collector_cloud_commit(
 p_source_id uuid,p_worker text,p_lease_token uuid,p_bundle jsonb,p_execution_id text
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,pgmq as $$
declare r public.collector_cloud_routes; m record; b public.collector_edge_backlog; slug text; op jsonb;
 saved jsonb='[]'; one_saved jsonb; result jsonb; event_id uuid; delay_seconds integer; next_cursor jsonb;
 failure jsonb; backlog_id uuid; failed_cursor jsonb; source_since date; source_until date;
 recheck_at timestamptz; committed_at timestamptz;
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
  or p_bundle#>>'{result,status}' is null
  or nullif(p_execution_id,'') is null or length(p_execution_id)>200
  or p_bundle#>>'{result,since}' is distinct from source_since::text
  or p_bundle#>>'{result,until}' is distinct from source_until::text then raise exception 'bounded matching bundle required'; end if;
 failure=nullif(p_bundle->'failure','null'::jsonb);
 if b.id is null and failure is not null then
  failed_cursor=failure->'cursor';
  if jsonb_typeof(failure) is distinct from 'object' or not private.collector_cloud_cursor_valid(failed_cursor,slug)
   or failure->>'url' is null or nullif(failure->>'reason','') is null
   or failure->>'url' is distinct from p_bundle#>>'{result,failed_url}'
   or (p_bundle#>>'{cursor,offset}')::integer<>(failed_cursor->>'offset')::integer+1
   or ((p_bundle->'cursor') - 'offset'::text) is distinct from (failed_cursor - 'offset'::text) then raise exception 'matching parked failure required'; end if;
 end if;
 for op in select value from jsonb_array_elements(p_bundle->'operations') loop
  if op->>'p_source_id' is distinct from p_source_id::text then raise exception 'operation source mismatch'; end if;
  select to_jsonb(x) into one_saved from public.ingest_source_item(
   p_source_id,op->>'p_external_id',op->>'p_canonical_url',op->>'p_title_original',
   (op->>'p_published_at')::timestamptz,(op->>'p_event_date')::date,(op->>'p_fetched_at')::timestamptz,
   op->>'p_language_code',op->>'p_document_type',op->>'p_content_text',op->>'p_content_hash',
   op->>'p_raw_storage_path',op->'p_metadata',op->>'p_instruction_version') x;
  saved=saved||jsonb_build_array(one_saved);
 end loop;
 if b.id is null and failure is not null then
  insert into public.collector_edge_backlog(source_id,url,range_start,range_end,state)
  values(p_source_id,failure->>'url',source_since,source_until,jsonb_build_object('cloud_python',true,'failure',failure,
   'since',source_since,'until',source_until,'rows',jsonb_build_array(jsonb_build_object('url',failure->>'url','title',failure->>'title'))))
  on conflict(source_id,url) where not resolved do nothing returning id into backlog_id;
  if backlog_id is not null then
   perform pgmq.send('trend_collect',jsonb_build_object('source_id',p_source_id,'kind','cloud-backlog-retry','backlog_id',backlog_id),3600);
  else
   update public.collector_edge_backlog set range_start=least(range_start,source_since),range_end=greatest(range_end,source_until),
    state=state||jsonb_build_object('cloud_failure',failure),updated_at=clock_timestamp() where source_id=p_source_id and url=failure->>'url' and not resolved;
  end if;
 end if;
 result=(p_bundle->'result')||jsonb_build_object('saved',saved,'execution_id',p_execution_id,
  'msg_id',r.msg_id,'read_ct',r.read_ct,'worker',p_worker,'runtime','cloud-python-connector','coverage_complete',false,'backlog_id',b.id);
 next_cursor=nullif(p_bundle->'cursor','null'::jsonb);
 if b.id is not null then
  if result->>'status'='failed' then delay_seconds=3600;
  elsif p_bundle->>'backlog_resolved'='true' and (jsonb_array_length(saved)=1 or result->>'reason'='backlog_out_of_range') then delay_seconds=-1;
  else raise exception 'backlog outcome required'; end if;
  update public.collector_edge_backlog set resolved=delay_seconds=-1,state=state||jsonb_build_object('cloud_last_result',result),updated_at=clock_timestamp() where id=b.id;
 else
  -- Recheck a completed listing at 03:00 KST before the next 04:00-05:00
  -- producer window, even when a completed FTC cursor carries seen hashes.
  -- In-pass steps stay immediate; failures retain their one-hour retry.
  if result->>'status'='failed' then delay_seconds=3600;
  elsif next_cursor is null or result->>'listing_scan_complete'='true' then
   committed_at=clock_timestamp();
   recheck_at=private.collector_cloud_daily_recheck_at(committed_at);
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
 return jsonb_build_object('event_id',event_id,'execution_id',p_execution_id,'saved',saved,'retry_after_seconds',delay_seconds,'coverage_complete',false,'backlog_id',b.id);
end; $$;

-- Preserve the service-role-only execution boundary from the prior migration.
revoke all on function public.collector_cloud_commit(uuid,text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.collector_cloud_commit(uuid,text,uuid,jsonb,text) to service_role;
