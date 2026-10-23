-- Read-only inventory for one Asia/Seoul calendar day. Replace both dates.
-- Queue kind daily-cron is the Edge scheduler's trigger; cloud-python events
-- and the ChatGPT producer automation need their own run/event correlation.
with period as (
  select ('2026-10-23'::date::timestamp at time zone 'Asia/Seoul') as start_at,
         ('2026-10-24'::date::timestamp at time zone 'Asia/Seoul') as end_at
), events as (
  select e.source_id,e.trigger_kind,e.started_at,e.result
  from public.collector_edge_events e cross join period p
  where e.started_at >= p.start_at and e.started_at < p.end_at
    and e.source_id is not null
)
select s.slug,
       coalesce(count(*) filter (where e.trigger_kind = 'daily-cron'),0) as edge_cron_events,
       coalesce(count(*) filter (where e.result->>'runtime' = 'cloud-python-connector'),0) as cloud_events,
       coalesce(count(*) filter (where e.trigger_kind = 'manual-validation'),0) as manual_events,
       coalesce(sum(case when e.result->>'runtime' = 'cloud-python-connector'
         then coalesce((e.result->>'out_of_range')::integer,0) else 0 end),0) as cloud_out_of_range,
       coalesce(sum(case when e.result->>'runtime' = 'cloud-python-connector'
         then coalesce(jsonb_array_length(e.result->'saved'),0) else 0 end),0) as cloud_saved_operations,
       coalesce(sum(case when e.result->>'runtime' = 'cloud-python-connector'
         then (select count(*) from jsonb_array_elements(coalesce(e.result->'saved','[]'::jsonb)) x
               where x->>'item_created' = 'true') else 0 end),0) as cloud_new,
       coalesce(sum(case when e.result->>'runtime' = 'cloud-python-connector'
         then (select count(*) from jsonb_array_elements(coalesce(e.result->'saved','[]'::jsonb)) x
               where x->>'item_created' = 'false' and x->>'content_changed' = 'true') else 0 end),0) as cloud_changed,
       coalesce(sum(case when e.result->>'runtime' = 'cloud-python-connector'
         then (select count(*) from jsonb_array_elements(coalesce(e.result->'saved','[]'::jsonb)) x
               where x->>'item_created' = 'false' and x->>'content_changed' = 'false') else 0 end),0) as cloud_duplicate,
       coalesce(count(*) filter (where e.trigger_kind = 'daily-cron'
         and e.result->>'saved' = 'new'),0) as edge_new,
       coalesce(count(*) filter (where e.trigger_kind = 'daily-cron'
         and e.result->>'saved' = 'duplicate'),0) as edge_duplicate,
       coalesce(count(*) filter (where e.trigger_kind = 'daily-cron'
         and e.result->>'saved' = 'out_of_range'),0) as edge_out_of_range,
       coalesce(sum(case when e.trigger_kind = 'daily-cron'
         then coalesce((e.result->>'listing_date_excluded')::integer,0) else 0 end),0)
         as edge_listing_date_excluded,
       coalesce(count(*) filter (where e.trigger_kind = 'daily-cron'
         and e.result->>'status' = 'failed'),0) as edge_failed,
       max(e.started_at) as latest_event_at,
       s.queued, s.state->>'since' as since_date,
       s.state->>'until' as until_date,
       s.state->>'page' as current_page,
       s.state->>'offset' as current_offset,
       s.state->>'exhausted' as listing_exhausted,
       s.state->>'unknown_dates' as unresolved_date_observations,
       (select count(*) from public.collector_edge_backlog b
        where b.source_id=s.source_id and not b.resolved) as open_backlog
from public.collector_edge_sources s
left join events e on e.source_id=s.source_id
group by s.source_id,s.slug,s.queued,s.state
order by s.slug;
