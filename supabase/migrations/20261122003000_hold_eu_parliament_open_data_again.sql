-- Re-apply the user's European Parliament Open Data hold after the
-- 2026-11-17 verified-feed activation migration. Preserve historical rows/jobs.
update public.sources
set is_active=false,
    next_run_at=null,
    parser_config=(coalesce(parser_config,'{}'::jsonb)-'automatic_collection_enabled')
      || jsonb_build_object(
        'automatic_collection_enabled',false,
        'hold_reason','User requested removal of European Parliament Open Data API from collection; historical items are retained for editorial triage.',
        'verification_status','held_by_user_request'
      ),
    updated_at=clock_timestamp()
where id='0d91c2b9-d98c-524a-9949-c35e8938caad'::uuid;

update public.collector_edge_sources
set queued=false,
    updated_at=clock_timestamp()
where slug='eu-parliament'
  and source_id='0d91c2b9-d98c-524a-9949-c35e8938caad'::uuid;

update public.collector_cloud_routes
set enabled=false,
    updated_at=clock_timestamp()
where source_id='0d91c2b9-d98c-524a-9949-c35e8938caad'::uuid;

do $assert_eu_parliament_held$
begin
  if exists (
    select 1
    from public.sources s
    left join public.collector_cloud_routes r on r.source_id=s.id
    where s.id='0d91c2b9-d98c-524a-9949-c35e8938caad'::uuid
      and (s.is_active is distinct from false
        or s.parser_config->>'automatic_collection_enabled' is distinct from 'false'
        or r.enabled is distinct from false)
  ) then
    raise exception 'European Parliament Open Data API collection hold was not applied';
  end if;
end;
$assert_eu_parliament_held$;
