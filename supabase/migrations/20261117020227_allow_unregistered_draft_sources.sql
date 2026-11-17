-- Draft intake must not require a per-source catalog registration.
-- The source row remains optional metadata for configured collection routes;
-- the item itself retains its original URL and source_name in metadata.

alter table public.source_items
  alter column source_id drop not null;

alter table public.source_items
  add constraint source_items_origin_required_when_uncatalogued
  check (source_id is not null or nullif(btrim(metadata->>'source_name'), '') is not null);

create unique index if not exists source_items_uncatalogued_url_uidx
  on public.source_items (canonical_url)
  where source_id is null;

-- Any item can be drafted regardless of whether its origin has a sources row.
-- Keep this helper for compatibility with already deployed callers.
create or replace function private.trend_draft_source_allowed(p_source_id uuid)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$ select true $$;

-- The existing ingestion contract remains backward compatible. A null source
-- ID is accepted only when the caller supplies the source's display name in
-- metadata; the canonical URL remains the item-level source of truth.
do $allow_uncatalogued_ingest$
declare
  definition text;
  old_guard text := $old$  perform 1
  from public.sources s
  where s.id = p_source_id and s.is_active;

  if not found then
    raise invalid_parameter_value using message = 'Source does not exist or is inactive';
  end if;$old$;
  new_guard text := $new$  if p_source_id is null then
    if nullif(btrim(v_metadata->>'source_name'), '') is null then
      raise invalid_parameter_value using message = 'Source name is required when source_id is omitted';
    end if;
  else
    perform 1 from public.sources s where s.id = p_source_id and s.is_active;
    if not found then
      raise invalid_parameter_value using message = 'Source does not exist or is inactive';
    end if;
  end if;$new$;
  old_match text := $old$  where si.source_id = p_source_id
    and si.canonical_url = btrim(p_canonical_url)$old$;
  new_match text := $new$  where si.source_id is not distinct from p_source_id
    and si.canonical_url = btrim(p_canonical_url)$new$;
begin
  definition := pg_get_functiondef('public.ingest_source_item(uuid,text,text,text,timestamptz,date,timestamptz,text,text,text,text,text,jsonb,text)'::regprocedure);
  if position(old_guard in definition) = 0 or position(old_match in definition) = 0 then
    raise exception 'uncatalogued ingest anchor drift';
  end if;
  definition := replace(definition, old_guard, new_guard);
  definition := replace(definition, old_match, new_match);
  execute definition;
end;
$allow_uncatalogued_ingest$;

-- Queue claims include uncatalogued items and retain a human-readable origin.
do $allow_uncatalogued_claim$
declare
  definition text;
  old_join text := $old$join public.sources s on s.id = si.source_id$old$;
  new_join text := $new$left join public.sources s on s.id = si.source_id$new$;
  old_name text := $old$'metadata', r.metadata, 'source_name', s.name$old$;
  new_name text := $new$'metadata', r.metadata, 'source_name', coalesce(s.name, si.metadata->>'source_name', '출처 정보 없음')$new$;
begin
  definition := pg_get_functiondef('public.claim_trend_draft_jobs(text,integer,uuid)'::regprocedure);
  if position(old_join in definition) = 0 or position(old_name in definition) = 0 then
    raise exception 'uncatalogued claim anchor drift';
  end if;
  definition := replace(definition, old_join, new_join);
  definition := replace(definition, old_name, new_name);
  execute definition;
end;
$allow_uncatalogued_claim$;

-- Keep uncatalogued records visible in the authenticated review board.
do $allow_uncatalogued_review$
declare
  definition text;
  old_join text := $old$from public.source_items si join public.sources s on s.id=si.source_id$old$;
  new_join text := $new$from public.source_items si left join public.sources s on s.id=si.source_id$new$;
  old_name text := $old$s.name as source_name$old$;
  new_name text := $new$coalesce(s.name,si.metadata->>'source_name','출처 정보 없음') as source_name$new$;
begin
  definition := pg_get_functiondef('private.get_trend_collector_review()'::regprocedure);
  if position(old_join in definition) = 0 or position(old_name in definition) = 0 then
    raise exception 'uncatalogued review anchor drift';
  end if;
  definition := replace(definition, old_join, new_join);
  definition := replace(definition, old_name, new_name);
  execute definition;
end;
$allow_uncatalogued_review$;
