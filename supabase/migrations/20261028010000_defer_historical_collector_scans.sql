-- Historical discovery is a separate future backfill, not part of the daily
-- producer. Save every in-flight cursor before starting a short daily scan.
create table public.collector_historical_scans (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.collector_edge_sources(source_id),
  executor text not null check (executor in ('edge', 'cloud-python')),
  range_start date not null,
  range_end date not null,
  state jsonb,
  cursor jsonb,
  deferred_at timestamptz not null default clock_timestamp(),
  resume_status text not null default 'deferred_by_user'
    check (resume_status in ('deferred_by_user', 'resumed', 'closed')),
  check (range_start <= range_end),
  check ((executor = 'edge' and state is not null and cursor is null)
    or (executor = 'cloud-python' and state is null and cursor is not null))
);
create index collector_historical_scans_source on public.collector_historical_scans(source_id, deferred_at desc);
alter table public.collector_historical_scans enable row level security;
revoke all on public.collector_historical_scans from public, anon, authenticated;
grant select on public.collector_historical_scans to service_role;

do $$
declare
  today_kst date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  item record;
  route public.collector_cloud_routes;
  fresh_cursor jsonb;
  base_url text;
begin
  perform pg_advisory_xact_lock(hashtext('collector-executor-routing'));
  -- A claim already in an Edge Function may still commit its old state. Do not
  -- switch under that lease; the migration can be retried when it expires.
  if exists (
    select 1 from public.collector_edge_sources s
    join pgmq.q_trend_collect q on (q.message->>'source_id')::uuid = s.source_id
    where s.slug in ('curia', 'dpc', 'edpb', 'pdpc')
      and q.vt > clock_timestamp() and q.read_ct > 0
  ) then raise exception 'active historical Edge lease; retry after expiry'; end if;
  if exists (
    select 1 from public.collector_cloud_routes r
    join public.collector_edge_sources s on s.source_id = r.source_id
    where s.slug = 'oecd' and r.lease_until > clock_timestamp()
  ) then raise exception 'active historical OECD lease; retry after expiry'; end if;

  for item in
    select s.* from public.collector_edge_sources s
    where s.slug in ('curia', 'dpc', 'edpb', 'pdpc')
      and (s.state->>'since')::date < today_kst - 2
    order by s.slug for update
  loop
    base_url := case item.slug
      when 'curia' then 'https://curia.europa.eu/site/jcms/d2_5158/en/press-releases'
      when 'dpc' then 'https://www.dataprotection.ie/en/news-media/latest-news'
      when 'edpb' then 'https://www.edpb.europa.eu/news_en'
      when 'pdpc' then 'https://www.pdpc.gov.sg/api/listing-api?itemsperpage=10&listingtype=media_events&pathname=%2Fmedia-events'
    end;
    insert into public.collector_historical_scans(source_id, executor, range_start, range_end, state)
      values(item.source_id, 'edge', (item.state->>'since')::date,
        (item.state->>'until')::date, item.state);
    update public.collector_edge_sources set
      state = jsonb_build_object('since', (today_kst - 2)::text, 'until', today_kst::text,
        'page', base_url, 'offset', 0, 'adapter_version', item.state->>'adapter_version',
        'seen_pages', '[]'::jsonb, 'failures', 0, 'unknown_dates', 0,
        'exhausted', false),
      updated_at = clock_timestamp()
      where source_id = item.source_id;
    -- The existing scheduled message remains queued and will read this new
    -- daily state. No historical state or failed URL is put back on that queue.
  end loop;

  select r.* into route from public.collector_cloud_routes r
    join public.collector_edge_sources s on s.source_id = r.source_id
    where s.slug = 'oecd' and r.enabled for update;
  if found and route.range_start < today_kst - 2 then
    if route.lease_until is not null and route.lease_until > clock_timestamp()
    then raise exception 'active OECD lease; retry after expiry'; end if;
    insert into public.collector_historical_scans(source_id, executor, range_start, range_end, cursor)
      values(route.source_id, 'cloud-python', route.range_start, route.range_end, route.cursor);
    fresh_cursor := jsonb_build_object(
      'page', 'https://www.oecd.org/en/topics/privacy-and-data-protection.html',
      'offset', 0, 'failures', 0, 'unknown_dates', 0, 'had_pagination', false,
      'excluded_unapproved_host_count', 0,
      'processed_url_hashes', coalesce(route.cursor->'processed_url_hashes', '[]'::jsonb));
    if not private.collector_cloud_cursor_valid(fresh_cursor, 'oecd')
    then raise exception 'OECD daily cursor validation failed'; end if;
    update public.collector_cloud_routes set range_start = today_kst - 1,
      range_end = greatest(range_end, today_kst), cursor = fresh_cursor,
      updated_at = clock_timestamp() where source_id = route.source_id;
    perform public.collector_set_progress(route.source_id, today_kst - 1,
      greatest(route.range_end, today_kst), fresh_cursor, false);
  end if;
end; $$;
