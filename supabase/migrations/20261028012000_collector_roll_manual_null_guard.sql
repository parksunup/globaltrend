-- SQL NULL must not let an unscheduled manual event advance the daily cursor.
create or replace function private.collector_roll_daily_window(
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
    or (p_trigger_kind is distinct from 'daily-cron' and p_result->>'trigger' is distinct from 'scheduled')
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
