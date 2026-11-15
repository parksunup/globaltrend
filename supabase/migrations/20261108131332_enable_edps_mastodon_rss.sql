-- The user explicitly selected the official EDPS Mastodon RSS route. Keep the
-- existing source, queue, route cursor and publication history; only activate
-- this already registered source and permit its verified status URLs.
do $edps_source$
declare
  sid constant uuid := '2239debc-9ce2-5cfd-99f3-c555b7cd0c94';
  pid uuid;
  edge_state jsonb;
  initial_since date;
  initial_until date;
begin
  select publisher_id into strict pid from public.sources where id=sid;

  update public.publishers set is_active=true where id=pid;
  update public.sources
     set name='European Data Protection Supervisor',
         source_kind='rss',
         fetch_strategy='http',
         start_url='https://social.edps.europa.eu/@EDPS.rss',
         parser_config=(coalesce(parser_config,'{}'::jsonb) - 'hold_reason') || jsonb_build_object(
           'collector_executor','cloud-python',
           'automatic_collection_enabled',true,
           'document_scope','official_mastodon_rss_full_post',
           'approval_basis','User selected the official EDPS Mastodon RSS route'
         ),
         terms_reviewed_at=coalesce(terms_reviewed_at,now()),
         is_active=true
   where id=sid;

  if not found then raise exception 'EDPS source activation failed'; end if;

  select state into strict edge_state from public.collector_edge_sources where source_id=sid;
  initial_since := nullif(edge_state->>'since','')::date;
  initial_until := nullif(edge_state->>'until','')::date;
  if initial_since is null or initial_until is null or initial_since > initial_until then
    raise exception 'EDPS initial collection window missing or invalid';
  end if;

  -- range_start has no table default. Seed a newly created route from the
  -- existing Edge cursor, and repair only missing bounds on an old route.
  insert into public.collector_cloud_routes(source_id,enabled,range_start,range_end)
  values(sid,true,initial_since,initial_until)
  on conflict(source_id) do update
    set enabled=true,
        range_start=coalesce(public.collector_cloud_routes.range_start,excluded.range_start),
        range_end=coalesce(public.collector_cloud_routes.range_end,excluded.range_end),
        updated_at=now();
end;
$edps_source$;

-- Extend the existing cloud worker allowlist and cursor URL validation without
-- changing the lease/commit protocol or any existing source cursor.
do $edps_cloud_route$
declare
  definition text;
  expected text;
begin
  definition=pg_get_functiondef('public.collector_cloud_take(text,text)'::regprocedure);
  expected=$guard$slug in ('oecd','ftc','ec','eu-parliament')$guard$;
  if position(expected in definition)=0 then
    raise exception 'cloud source assignment contract drift';
  end if;
  execute replace(definition,expected,$guard$slug in ('oecd','ftc','ec','eu-parliament','edps')$guard$);

  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  expected=$guard$case when slug='ftc' then '^https://www[.]ftc[.]gov/' else '^https://www[.]oecd[.]org/' end$guard$;
  if position(expected in definition)>0 then
    raise exception 'cloud cursor route expansion migration is missing';
  end if;

  expected=$guard$when slug='eu-parliament' then '^https://www[.]europarl[.]europa[.]eu/'$guard$;
  if position(expected in definition)=0 then
    raise exception 'cloud cursor host contract drift';
  end if;
  execute replace(definition,expected,$guard$when slug='eu-parliament' then '^https://www[.]europarl[.]europa[.]eu/' when slug='edps' then '^https://social[.]edps[.]europa[.]eu/@EDPS/[0-9]+$'$guard$);
end;
$edps_cloud_route$;
