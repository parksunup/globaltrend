-- IMDA is a true alternate route: only collect it when the same-day PDPC
-- collection failed, was partial, or produced no run record.
create or replace function public.collector_imda_fallback_due(p_clock timestamptz default clock_timestamp())
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public
as $$
  with pdpc_attempt as (
    select item.value->>'status' as status
    from public.collector_runs run
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(run.result->'sources')='array'
        then run.result->'sources' else '[]'::jsonb end
    ) as item(value)
    where item.value->>'source'='pdpc'
      and (run.started_at at time zone 'Asia/Seoul')::date=
          (p_clock at time zone 'Asia/Seoul')::date
    order by run.started_at desc
    limit 1
  )
  select coalesce((
    select case
      when status in ('success','complete','empty_window') then false
      else true
    end
    from pdpc_attempt
  ),true)
$$;

revoke all on function public.collector_imda_fallback_due(timestamptz)
  from public,anon,authenticated;
grant execute on function public.collector_imda_fallback_due(timestamptz)
  to service_role;
