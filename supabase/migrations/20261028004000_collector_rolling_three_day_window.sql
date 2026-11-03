-- A completed listing pass should not make the next daily run scan the same
-- month-long discovery range. Keep the original, unverified range as evidence;
-- failed individual URLs remain in collector_edge_backlog.
create table public.collector_scan_windows (
  scan_event_id uuid primary key references public.collector_edge_events(id),
  source_id uuid not null references public.collector_edge_sources(source_id),
  range_start date not null,
  range_end date not null,
  next_range_start date not null,
  coverage_complete boolean not null default false,
  coverage_blockers jsonb not null default '[]'::jsonb,
  recorded_at timestamptz not null default clock_timestamp(),
  check (range_start <= next_range_start and next_range_start <= range_end),
  check (jsonb_typeof(coverage_blockers) = 'array')
);
create index collector_scan_windows_source_range on public.collector_scan_windows(source_id, range_end desc);
alter table public.collector_scan_windows enable row level security;
revoke all on public.collector_scan_windows from public, anon, authenticated;
grant select on public.collector_scan_windows to service_role;

create function private.collector_roll_daily_window(
  p_event_id uuid, p_source_id uuid, p_result jsonb, p_trigger_kind text
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare
  old_start date;
  old_end date;
  next_start date;
  route public.collector_cloud_routes;
  edge public.collector_edge_sources;
  changed_rows integer;
  blockers jsonb;
begin
  -- A manual scan or an unfinished page must never move the daily cursor.
  if p_source_id is null or p_result->>'listing_scan_complete' is distinct from 'true'
    or not (p_trigger_kind = 'daily-cron' or p_result->>'trigger' = 'scheduled')
    or p_result->>'since' is null or p_result->>'until' is null
    or p_result->>'since' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or p_result->>'until' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  old_start := (p_result->>'since')::date;
  old_end := (p_result->>'until')::date;
  if old_start > old_end then return false; end if;
  -- Tomorrow's run extends the upper bound by one day, giving a three-day
  -- overlap (the previous two days plus tomorrow). Missed days are caught up.
  next_start := greatest(old_start, old_end - 1);
  blockers := case when jsonb_typeof(p_result->'coverage_blockers') = 'array'
    then p_result->'coverage_blockers'
    else jsonb_build_array(coalesce(p_result->>'reason', 'listing_exhaustiveness_unverified')) end;

  select * into route from public.collector_cloud_routes where source_id = p_source_id for update;
  if found and route.enabled then
    if route.range_start is distinct from old_start or route.range_end is distinct from old_end
      or route.lease_until is not null or route.cursor ? 'snapshot_id' then return false; end if;
    update public.collector_cloud_routes set range_start = next_start, updated_at = clock_timestamp()
      where source_id = p_source_id;
    perform public.collector_set_progress(p_source_id, next_start, old_end, route.cursor, false);
  else
    select * into edge from public.collector_edge_sources where source_id = p_source_id for update;
    if not found or edge.queued or edge.state->>'since' is distinct from old_start::text
      or edge.state->>'until' is distinct from old_end::text
      or edge.state->>'exhausted' is distinct from 'true'
      or edge.state ? 'rows' then return false; end if;
    update public.collector_edge_sources
      set state = jsonb_set(state, '{since}', to_jsonb(next_start::text)), updated_at = clock_timestamp()
      where source_id = p_source_id;
  end if;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then return false; end if;
  insert into public.collector_scan_windows(
    scan_event_id, source_id, range_start, range_end, next_range_start, coverage_complete, coverage_blockers
  ) values (p_event_id, p_source_id, old_start, old_end, next_start,
    coalesce((p_result->>'coverage_complete')::boolean, false), blockers)
  on conflict (scan_event_id) do nothing;
  return true;
end; $$;
revoke all on function private.collector_roll_daily_window(uuid, uuid, jsonb, text)
  from public, anon, authenticated;

create function private.collector_roll_daily_window_event() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  perform private.collector_roll_daily_window(new.id, new.source_id, new.result, new.trigger_kind);
  return new;
end; $$;
revoke all on function private.collector_roll_daily_window_event() from public, anon, authenticated;
create trigger collector_roll_daily_window_after_event
  after insert on public.collector_edge_events
  for each row execute function private.collector_roll_daily_window_event();

-- The five sources below are not named here: only a latest completed event
-- matching the still-idle persisted state can be rolled forward on rollout.
do $$
declare scan record;
begin
  for scan in
    select distinct on (e.source_id) e.id, e.source_id, e.result, e.trigger_kind
    from public.collector_edge_events e
    where e.source_id is not null and e.result->>'listing_scan_complete' = 'true'
    order by e.source_id, e.started_at desc
  loop
    perform private.collector_roll_daily_window(scan.id, scan.source_id, scan.result, scan.trigger_kind);
  end loop;
end; $$;
