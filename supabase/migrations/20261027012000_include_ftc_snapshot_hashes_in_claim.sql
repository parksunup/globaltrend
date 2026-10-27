-- Return the current durable FTC snapshot URL hashes to the worker.
-- cloud_step already writes these into cursor.processed_url_hashes; omitting
-- them from the claim silently produced an empty cursor after each completed
-- snapshot. Completed-snapshot rows currently protect deduplication; this keeps
-- the cursor contract intact too.
CREATE OR REPLACE FUNCTION public.collector_cloud_take(p_worker text, p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'pgmq'
AS $function$
declare r public.collector_cloud_routes; s public.collector_edge_sources; m record; b public.collector_edge_backlog;
 scan public.collector_cloud_listing_scans; staged_row public.collector_cloud_listing_rows;
 previous_hashes jsonb; snapshot_hashes jsonb; snapshot_claim jsonb;
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
  select coalesce(jsonb_agg(lr.url_hash order by lr.ordinal),'[]'::jsonb) into snapshot_hashes
   from public.collector_cloud_listing_rows lr
   where lr.scan_id=scan.id and lr.source_id=p_source_id;
  snapshot_claim=jsonb_build_object('id',scan.id,'listing_url',scan.listing_url,'fingerprint',scan.fingerprint,
   'row_count',scan.row_count,'ordinal',staged_row.ordinal,'row',staged_row.row_data,
   'url_hashes',snapshot_hashes);
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
end; $function$
