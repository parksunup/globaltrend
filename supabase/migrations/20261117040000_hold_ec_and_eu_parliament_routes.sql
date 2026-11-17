-- Keep the explicit user hold effective in the database scheduler as well as
-- in the Python and Edge registries.
update public.collector_cloud_routes r
set enabled=false,updated_at=now()
from public.collector_edge_sources e
where e.source_id=r.source_id
  and e.slug in ('ec','eu-parliament')
  and r.enabled;

do $assert_held_routes$
begin
  if exists(
    select 1
    from public.collector_cloud_routes r
    join public.collector_edge_sources e on e.source_id=r.source_id
    where e.slug in ('ec','eu-parliament') and r.enabled
  ) then
    raise exception 'EC or European Parliament cloud collection route remains enabled';
  end if;
end;
$assert_held_routes$;
