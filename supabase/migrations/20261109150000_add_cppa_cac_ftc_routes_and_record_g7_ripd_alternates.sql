-- Keep the source registry aligned with the verified public routes. G7 and RIPD
-- remain disabled because route access does not establish reuse permission or
-- complete coverage; do not synthesize terms_reviewed_at.
do $ftc_search_candidate$
declare pid uuid;
begin
  -- The existing FTC source ID was referenced by the runtime migration but is
  -- absent from a clean seed. Record the observed robots-disallowed search
  -- route as catalog-only; do not create an edge/cloud route or grant approval.
  insert into public.publishers(name,acronym,jurisdiction_code,publisher_type,website_url,description_ko,is_active)
  select 'Federal Trade Commission','FTC','US','government','https://www.ftc.gov/',
         '미국 연방거래위원회. 검색 경로가 robots 정책상 보류되어 있음.',false
   where not exists(select 1 from public.publishers where acronym='FTC');
  select id into strict pid from public.publishers where acronym='FTC' order by created_at,id limit 1;
  insert into public.sources as existing_source(
    id,publisher_id,name,source_kind,fetch_strategy,start_url,parser_config,
    poll_interval_minutes,respect_robots,terms_reviewed_at,is_active
  ) values(
    '430bd32d-19b1-4752-8280-7b2d2acbda88',pid,'Federal Trade Commission privacy search route',
    'html','http','https://search.ftc.gov/news-events/news/press-releases?search=privacy&items_per_page=50&field_mission%5B29%5D=29',
    jsonb_build_object('collector_executor','hold','automatic_collection_enabled',false,
      'hold_reason','robots_disallowed_on_verified_search_route','coverage_complete',false),
    1440,true,null,false
  ) on conflict(id) do update set
    publisher_id=excluded.publisher_id,name=excluded.name,source_kind=excluded.source_kind,
    fetch_strategy=excluded.fetch_strategy,start_url=excluded.start_url,
    parser_config=coalesce(existing_source.parser_config,'{}'::jsonb)||excluded.parser_config,
    poll_interval_minutes=excluded.poll_interval_minutes,respect_robots=true,
    terms_reviewed_at=null,is_active=false;
end;
$ftc_search_candidate$;

do $route_rows$
declare item jsonb;
begin
  for item in select value from jsonb_array_elements($items$[
    {"id":"430bd32d-19b1-4752-8280-7b2d2acbda88","url":"https://search.ftc.gov/news-events/news/press-releases?search=privacy&items_per_page=50&field_mission%5B29%5D=29","host":"search.ftc.gov","scope":"official_search_privacy_term_consumer_protection_filter_paginated_listing","active":false},
    {"id":"b064fc3c-766d-540f-9b65-3aa71e632663","url":"https://privacy.ca.gov/category/content-types/news/press-release/","host":"privacy.ca.gov","scope":"official_press_release_category_paginated","active":true},
    {"id":"d743f9ab-5194-5263-ab22-ef127336e2f2","url":"https://www.cac.gov.cn/wxzw/sjzl/A093708index_1.htm","host":"www.cac.gov.cn","scope":"official_privacy_listing_latest_items_no_verified_pagination","active":true},
    {"id":"c1c51983-486c-4a6e-98ef-43eaaee88d5a","url":"https://www.priv.gc.ca/en/about-the-opc/what-we-do/international-collaboration/international-events/g7-2025/membership/","host":"www.priv.gc.ca","scope":"official_opc_g7_membership_hub_linked_deliverables","active":false},
    {"id":"d5a9b352-8ebf-401a-8d83-378262cc0c12","url":"https://www.redipd.org/noticias/rss.xml","host":"www.redipd.org","scope":"official_rss_discovery_plus_article_detail","active":false}
  ]$items$::jsonb) loop
    update public.sources
       set start_url=item->>'url',
           is_active=(item->>'active')::boolean,
           terms_reviewed_at=case when (item->>'active')::boolean then terms_reviewed_at else null end,
           parser_config=(coalesce(parser_config,'{}'::jsonb)-'hold_reason') || jsonb_build_object(
             'verified_route_host',item->>'host',
             'document_scope',item->>'scope',
             'coverage_complete',false
           ) || case when (item->>'active')::boolean then '{}'::jsonb else jsonb_build_object(
             'collector_executor','hold',
             'automatic_collection_enabled',false,
             'relevance_review_required',true,
             'hold_reason',case
               when item->>'id'='430bd32d-19b1-4752-8280-7b2d2acbda88' then 'robots_disallowed_on_verified_search_route'
               when item->>'id'='c1c51983-486c-4a6e-98ef-43eaaee88d5a' then 'coverage_and_reuse_review_pending'
               else 'separate_source_terms_and_reuse_review_pending' end,
             'terms_review_result',case when item->>'id'='430bd32d-19b1-4752-8280-7b2d2acbda88' then 'official search route was not requested because robots disallowed it; no permission inferred' else 'route verified; separate terms or reuse grant not verified' end,
             'approval_basis','Keep the verified public route in the source inventory. Do not collect or publish until separate reuse review and source coverage review are complete.'
           ) end
     where id=(item->>'id')::uuid;
    if not found then raise exception 'source row missing while applying verified route %',item->>'id'; end if;
    if not (item->>'active')::boolean then
      update public.publishers set is_active=false where id=(select publisher_id from public.sources where id=(item->>'id')::uuid);
      update public.collector_cloud_routes set enabled=false,updated_at=now() where source_id=(item->>'id')::uuid;
    end if;
  end loop;
end;
$route_rows$;

-- The G7 source remains held, but its cloud cursor contract must match the
-- verified membership hub before any later explicit activation.
do $g7_membership_route$
declare definition text; old_pattern text; new_pattern text; n integer;
begin
  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  old_pattern='^https://www[.]priv[.]gc[.]ca/en/(about-the-opc/what-we-do/international-privacy-networks/news-announcement-ic/([?]o=d&Page=[0-9]+&Filter=True)?|opc-news/[^?]+|opc-actions-and-decisions/advice-to-parliament/[^?]+)$';
  new_pattern='^https://www[.]priv[.]gc[.]ca/en/(about-the-opc/what-we-do/international-collaboration/international-events/g7-2025/membership/|opc-news/[^?]+|opc-actions-and-decisions/advice-to-parliament/[^?]+)$';
  n=(length(definition)-length(replace(definition,old_pattern,'')))/length(old_pattern);
  if n<>1 then raise exception 'G7 cursor route drift: expected one old pattern, found %',n; end if;
  definition=replace(definition,old_pattern,new_pattern);
  if position(new_pattern in definition)=0 or position(old_pattern in definition)>0 then raise exception 'G7 cursor route postcondition failed'; end if;
  execute definition;

  definition=pg_get_functiondef('private.collector_cloud_frozen_cursor_valid(jsonb,text)'::regprocedure);
  old_pattern='^https://www[.]priv[.]gc[.]ca/en/about-the-opc/what-we-do/international-privacy-networks/news-announcement-ic/([?]o=d&Page=[0-9]+&Filter=True)?$';
  new_pattern='^https://www[.]priv[.]gc[.]ca/en/about-the-opc/what-we-do/international-collaboration/international-events/g7-2025/membership/$';
  n=(length(definition)-length(replace(definition,old_pattern,'')))/length(old_pattern);
  if n<>1 then raise exception 'G7 frozen listing route drift: expected one old pattern, found %',n; end if;
  definition=replace(definition,old_pattern,new_pattern);
  if position(new_pattern in definition)=0 or position(old_pattern in definition)>0 then raise exception 'G7 frozen listing route postcondition failed'; end if;
  execute definition;
end;
$g7_membership_route$;
