-- Re-apply the user's European Parliament Open Data hold after the
-- 2026-11-17 verified-feed activation migration. Resolve the live source by its
-- registered slug because database source UUIDs differ across environments.
do $assert_eu_parliament_route_exists$
begin
  if (select count(*) from public.collector_edge_sources where slug='eu-parliament')<>1 then
    raise exception 'expected exactly one registered eu-parliament source';
  end if;
end;
$assert_eu_parliament_route_exists$;

update public.sources s
set is_active=false,
    next_run_at=null,
    parser_config=(coalesce(s.parser_config,'{}'::jsonb)-'automatic_collection_enabled')
      || jsonb_build_object(
        'automatic_collection_enabled',false,
        'hold_reason','User requested removal of European Parliament Open Data API from collection; historical items are retained for editorial triage.',
        'verification_status','held_by_user_request'
      ),
    updated_at=clock_timestamp()
from public.collector_edge_sources e
where e.slug='eu-parliament'
  and s.id=e.source_id;

update public.collector_edge_sources
set queued=false,
    updated_at=clock_timestamp()
where slug='eu-parliament';

update public.collector_cloud_routes r
set enabled=false,
    updated_at=clock_timestamp()
where source_id=(select source_id from public.collector_edge_sources where slug='eu-parliament');

do $assert_eu_parliament_held$
begin
  if exists (
    select 1
    from public.collector_edge_sources e
    join public.sources s on s.id=e.source_id
    left join public.collector_cloud_routes r on r.source_id=s.id
    where e.slug='eu-parliament'
      and (s.is_active is distinct from false
        or s.parser_config->>'automatic_collection_enabled' is distinct from 'false'
        or e.queued is distinct from false
        or r.enabled is distinct from false)
  ) then
    raise exception 'European Parliament Open Data API collection hold was not applied';
  end if;
end;
$assert_eu_parliament_held$;
