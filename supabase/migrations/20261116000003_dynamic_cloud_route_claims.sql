-- Let the cloud worker inspect any source with a registered cloud route.
-- Source approval and database capacity are still checked by the function.
-- This rewrite accepts the different hard-coded allowlists found in production
-- and in clean migration replay, without changing the surrounding function.
do $$
declare
  definition text;
  updated_definition text;
  predicate text;
  source_lookup text;
begin
  select pg_get_functiondef('public.collector_cloud_take(text,text)'::regprocedure)
    into definition;

  predicate := $regex$slug\s+in\s*\([^)]*\)$regex$;
  if regexp_count(definition, predicate, 1, 'i') <> 1 then
    raise exception 'expected one cloud source allowlist in collector_cloud_take';
  end if;

  updated_definition := regexp_replace(
    definition,
    predicate,
    'exists (select 1 from public.collector_cloud_routes route_row where route_row.source_id=public.collector_edge_sources.source_id)',
    'i'
  );

  if updated_definition = definition
     or updated_definition ~* 'slug\s+in\s*\([^)]*\)' then
    raise exception 'cloud route allowlist rewrite did not apply';
  end if;

  -- Unknown slugs must return NULL rather than raising NO_DATA_FOUND.
  source_lookup := $regex$select\s+\*\s+into\s+strict\s+s\s+from\s+public\.collector_edge_sources\s+where\s+slug\s*=\s*p_slug$regex$;
  if regexp_count(updated_definition, source_lookup, 1, 'i') <> 1 then
    raise exception 'expected one strict source lookup in collector_cloud_take';
  end if;
  updated_definition := regexp_replace(
    updated_definition,
    source_lookup,
    'select * into s from public.collector_edge_sources where slug=p_slug; if not found then return null; end if',
    'i'
  );

  execute updated_definition;
end;
$$;

-- Remove the cursor-size restriction that rejects valid ANPD listing progress.
do $$
declare
  definition text;
  updated_definition text;
  predicate text;
begin
  select pg_get_functiondef(
    'public.collector_set_progress(uuid,date,date,jsonb,boolean)'::regprocedure
  ) into definition;

  predicate := $regex$octet_length\s*\(\s*coalesce\s*\(\s*p_cursor::text\s*,\s*''\s*\)\s*\)\s*>\s*4000$regex$;
  if regexp_count(definition, predicate, 1, 'i') > 1 then
    raise exception 'multiple collector progress cursor size restrictions found';
  end if;

  if regexp_count(definition, predicate, 1, 'i') = 1 then
    updated_definition := regexp_replace(definition, predicate, 'false', 'gi');
    if updated_definition ~* 'octet_length\s*\(\s*coalesce\s*\(\s*p_cursor::text' then
      raise exception 'collector progress cursor size restriction was not removed';
    end if;
    execute updated_definition;
  end if;
end;
$$;
