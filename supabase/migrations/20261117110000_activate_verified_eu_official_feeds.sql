-- Activate the requested official Commission/Parliament feed routes in the
-- existing Supabase queue. GitHub Actions remains the Crawlee/Python worker;
-- Supabase owns schedules, claims, route state and draft-job creation.
do $sources$
declare
  initial_since date := (now() at time zone 'Asia/Seoul')::date - 2;
  initial_until date := (now() at time zone 'Asia/Seoul')::date;
begin
  update public.publishers
     set is_active=true
   where id='96191444-95f6-5553-8f3e-eb8e18ed205a';
  if not found then raise exception 'European Commission publisher is missing'; end if;

  update public.sources
     set name='European Commission Press Corner', source_kind='rss', fetch_strategy='http',
         start_url='https://ec.europa.eu/commission/presscorner/api/rss?language=en',
         parser_config=(coalesce(parser_config,'{}'::jsonb)-'hold_reason') || jsonb_build_object(
           'collector_executor','cloud-python','automatic_collection_enabled',true,
           'document_scope','official_presscorner_rss_to_identity_checked_document_api_full_body',
           'verification_status','official_presscorner_rss_and_document_api_verified',
           'verification','RSS items are followed through the official document API. Full body and exact publication date are required for automatic drafting; feed-window coverage is rolling. Route/access review does not infer a separate reuse license.',
           'terms_review_result','official route reviewed; separate reuse license not inferred',
           'coverage_complete',false,'relevance_review_required',true,
           'approval_basis','User requested Commission Press Corner RSS collection into the existing Korean draft pipeline.'),
         poll_interval_minutes=1440,next_run_at=now(),respect_robots=true,
         terms_reviewed_at=coalesce(terms_reviewed_at,now()),is_active=true,updated_at=now()
   where id='5e5d193b-d98c-524a-9949-c35e8938caad';
  if not found then raise exception 'European Commission Press Corner source is missing'; end if;

  update public.sources
     set name='European Parliament Open Data API',source_kind='json_api',fetch_strategy='http',
         start_url='https://data.europarl.europa.eu/api/v2/documents/feed',
         parser_config=(coalesce(parser_config,'{}'::jsonb)-'hold_reason') || jsonb_build_object(
           'collector_executor','cloud-python','automatic_collection_enabled',true,
           'document_scope','official_open_data_api_document_feed_detail_and_text',
           'verification_status','official_open_data_api_v2_route_verified',
           'verification','The Open Data API v2 Atom feed is a rolling discovery feed. Fetch the matching API record and an official linked PDF when API text is only metadata. Automatic drafting requires substantive extracted text and an exact API publication date; feed update timestamps are not publication dates. Attribute API data under CC BY 4.0.',
           'terms_review_result','Open Data API documentation states CC BY 4.0; attribution required',
           'coverage_complete',false,'relevance_review_required',true,
           'approval_basis','User requested European Parliament Open Data API collection into the existing Korean draft pipeline.'),
         poll_interval_minutes=1440,next_run_at=now(),respect_robots=true,
         terms_reviewed_at=coalesce(terms_reviewed_at,now()),is_active=true,updated_at=now()
   where id='0d91c2b9-8884-5533-95c2-09469c6db19b';
  if not found then raise exception 'European Parliament source is missing'; end if;
  update public.publishers set is_active=true
   where id=(select publisher_id from public.sources where id='0d91c2b9-8884-5533-95c2-09469c6db19b');
  if not found then raise exception 'European Parliament publisher is missing'; end if;

  insert into public.sources as existing_source
    (id,publisher_id,name,source_kind,fetch_strategy,start_url,parser_config,
     poll_interval_minutes,next_run_at,respect_robots,terms_reviewed_at,is_active)
  values
    ('6215bf4c-3cdb-5eb8-9dad-f5904bab3cd5','96191444-95f6-5553-8f3e-eb8e18ed205a',
     'European Commission News','rss','http','https://commission.europa.eu/node/2/rss_en',
     jsonb_build_object('collector_executor','cloud-python','automatic_collection_enabled',true,
       'document_scope','official_commission_news_rss_to_article_body',
       'verification_status','official_rss_and_article_route_verified',
       'verification','The official RSS feed is rolling. Follow only matching Commission news URLs; use exact feed/detail publication date and the article body. Do not treat the feed as a complete archive.',
       'terms_review_result','official route reviewed; separate reuse license not inferred',
       'coverage_complete',false,'relevance_review_required',true,
       'approval_basis','User requested Commission News RSS as a second official route into the Korean draft pipeline.'),
     1440,now(),true,now(),true)
  on conflict(id) do update set
    publisher_id=excluded.publisher_id,name=excluded.name,source_kind=excluded.source_kind,
    fetch_strategy=excluded.fetch_strategy,start_url=excluded.start_url,
    parser_config=(coalesce(existing_source.parser_config,'{}'::jsonb)-'hold_reason')||excluded.parser_config,
    poll_interval_minutes=excluded.poll_interval_minutes,next_run_at=now(),respect_robots=true,
    terms_reviewed_at=coalesce(existing_source.terms_reviewed_at,excluded.terms_reviewed_at),
    is_active=true,updated_at=now();

  -- These feed endpoints changed while their routes were held. Re-scan only
  -- the rolling recent window and discard incompatible old route cursors.
  insert into public.collector_edge_sources(source_id,slug,state,queued)
  values
    ('5e5d193b-d98c-524a-9949-c35e8938caad','ec',jsonb_build_object('since',initial_since,'until',initial_until),false),
    ('6215bf4c-3cdb-5eb8-9dad-f5904bab3cd5','ec-news',jsonb_build_object('since',initial_since,'until',initial_until),false),
    ('0d91c2b9-8884-5533-95c2-09469c6db19b','eu-parliament',jsonb_build_object('since',initial_since,'until',initial_until),false)
  on conflict(source_id) do update set slug=excluded.slug,state=excluded.state,queued=false,updated_at=now();

  insert into public.collector_cloud_routes(source_id,enabled,cursor,range_start,range_end)
  values
    ('5e5d193b-d98c-524a-9949-c35e8938caad',true,null,initial_since,initial_until),
    ('6215bf4c-3cdb-5eb8-9dad-f5904bab3cd5',true,null,initial_since,initial_until),
    ('0d91c2b9-8884-5533-95c2-09469c6db19b',true,null,initial_since,initial_until)
  on conflict(source_id) do update set enabled=true,cursor=null,range_start=excluded.range_start,
    range_end=excluded.range_end,updated_at=now();
end;
$sources$;

-- Accept only the new official host/prefixes in the existing bounded cursor
-- validator. Keep IMDA and every previously admitted source unchanged.
do $cloud_cursor$
declare definition text; old_pattern text; new_pattern text; n integer; branch_count integer;
begin
  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  -- Change the Parliament host prefix directly instead of matching the whole
  -- CASE branch: earlier migration histories format the adjacent IMDA branch
  -- with and without spaces around '='.
  old_pattern=$old$'^https://www[.]europarl[.]europa[.]eu/'$old$;
  new_pattern=$new$'^https://data[.]europarl[.]europa[.]eu/api/v2/'$new$;
  n=(length(definition)-length(replace(definition,old_pattern,'')))/length(old_pattern);
  if n<>1 then raise exception 'cloud cursor route drift: expected one existing Parliament prefix, found %',n; end if;
  definition=replace(definition,old_pattern,new_pattern);
  if position(new_pattern in definition)=0 then raise exception 'cloud cursor route update postcondition failed'; end if;
  execute definition;

  definition=pg_get_functiondef('private.collector_cloud_frozen_cursor_valid(jsonb,text)'::regprocedure);
  -- Add ec-news without replacing other allowlisted sources. The production
  -- validator has had different later allowlist contents across environments.
  old_pattern=$old$slug not in ('ec',$old$;
  new_pattern=$new$slug not in ('ec','ec-news',$new$;
  n=(length(definition)-length(replace(definition,old_pattern,'')))/length(old_pattern);
  if n<>1 then raise exception 'frozen cursor slug guard drift: expected one current guard, found %',n; end if;
  definition=replace(definition,old_pattern,new_pattern);

  old_pattern=$old$  path_pattern='^https://ec[.]europa[.]eu/commission/presscorner/detail/en/(ip|qanda|statement|speech|memo|mex)_[0-9]{2}_[0-9]+$';
  listing_pattern='^https://ec[.]europa[.]eu/commission/presscorner/api/search[?][^#]+$';$old$;
  new_pattern=$new$  path_pattern='^https://ec[.]europa[.]eu/commission/presscorner/detail/en/(ip|qanda|statement|speech|memo|mex)_[0-9]{2}_[0-9]+$';
  listing_pattern='^https://ec[.]europa[.]eu/commission/presscorner/api/rss[?]language=en$';$new$;
  n=(length(definition)-length(replace(definition,old_pattern,'')))/length(old_pattern);
  if n<>1 then raise exception 'Press Corner frozen cursor contract drift'; end if;
  definition=replace(definition,old_pattern,new_pattern);

  old_pattern=$old$ else
  path_pattern='^https://www[.]europarl[.]europa[.]eu/news/en/press-room/[0-9]{8}IPR[0-9]+/[^?#]*$';
  listing_pattern='^https://www[.]europarl[.]europa[.]eu/rss/doc/press-releases/en[.]xml$';$old$;
  new_pattern=$new$ elsif slug='ec-news' then
  path_pattern='^https://commission[.]europa[.]eu/news-and-media/news/[a-z0-9][a-z0-9-]*-[0-9]{4}-[0-9]{2}-[0-9]{2}_en$';
  listing_pattern='^https://commission[.]europa[.]eu/node/2/rss_en$';
 else
  path_pattern='^https://data[.]europarl[.]europa[.]eu/api/v2/documents/[A-Za-z0-9][A-Za-z0-9._-]*$';
  listing_pattern='^https://data[.]europarl[.]europa[.]eu/api/v2/documents/feed[?]format=application%2[Ff]atom%2[Bb]xml$';$new$;
  n=(length(definition)-length(replace(definition,old_pattern,'')))/length(old_pattern);
  if n=1 then
    definition=replace(definition,old_pattern,new_pattern);
  else
    -- Some migration histories already have a Parliament branch followed by
    -- other allowlisted routes. Preserve those branches as well.
    old_pattern=$old$ elsif slug='eu-parliament' then
  path_pattern='^https://www[.]europarl[.]europa[.]eu/news/en/press-room/[0-9]{8}IPR[0-9]+/[^?#]*$';
  listing_pattern='^https://www[.]europarl[.]europa[.]eu/rss/doc/press-releases/en[.]xml$';$old$;
    new_pattern=$new$ elsif slug='ec-news' then
  path_pattern='^https://commission[.]europa[.]eu/news-and-media/news/[a-z0-9][a-z0-9-]*-[0-9]{4}-[0-9]{2}-[0-9]{2}_en$';
  listing_pattern='^https://commission[.]europa[.]eu/node/2/rss_en$';
 elsif slug='eu-parliament' then
  path_pattern='^https://data[.]europarl[.]europa[.]eu/api/v2/documents/[A-Za-z0-9][A-Za-z0-9._-]*$';
  listing_pattern='^https://data[.]europarl[.]europa[.]eu/api/v2/documents/feed[?]format=application%2[Ff]atom%2[Bb]xml$';$new$;
    branch_count=(length(definition)-length(replace(definition,old_pattern,'')))/length(old_pattern);
    if branch_count<>1 then raise exception 'European Parliament frozen cursor contract drift'; end if;
    definition=replace(definition,old_pattern,new_pattern);
  end if;
  if position(new_pattern in definition)=0 then raise exception 'frozen cursor route update postcondition failed'; end if;
  execute definition;
end;
$cloud_cursor$;

revoke all on function private.collector_cloud_cursor_valid(jsonb,text),
  private.collector_cloud_frozen_cursor_valid(jsonb,text)
  from public,anon,authenticated;

do $assert_routes$
begin
  if exists(select 1 from public.collector_edge_sources e
    join public.collector_cloud_routes r on r.source_id=e.source_id
    join public.sources s on s.id=e.source_id
    where e.slug in ('ec','ec-news','eu-parliament')
      and (e.queued is distinct from false or r.enabled is distinct from true or s.is_active is distinct from true
        or s.parser_config->>'collector_executor' is distinct from 'cloud-python')) then
    raise exception 'one or more requested official feeds are not wired to the cloud Python worker';
  end if;
  if (select count(*) from public.collector_edge_sources where slug in ('ec','ec-news','eu-parliament'))<>3 then
    raise exception 'requested official feed route registrations are incomplete';
  end if;
end;
$assert_routes$;
