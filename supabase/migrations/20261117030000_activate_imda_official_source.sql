-- Add IMDA's official release archive as Singapore's alternate privacy-news route.
-- robots.txt permits this listing and article path. This records an access-route
-- review only; it does not assert a copyright/reuse license.
with new_publisher as (
  insert into public.publishers(id,name,acronym,jurisdiction_code,publisher_type,website_url,description_ko,is_active)
  values('03a75d29-8a1e-5280-bad9-2d882c1b966e','Infocomm Media Development Authority','IMDA','SG','government','https://www.imda.gov.sg','싱가포르 정보통신미디어개발청. PDPC의 상위 기관이며 개인정보 관련 공식 보도자료를 제공합니다.',true)
  on conflict(id) do update set name=excluded.name,acronym=excluded.acronym,jurisdiction_code=excluded.jurisdiction_code,
    publisher_type=excluded.publisher_type,website_url=excluded.website_url,description_ko=excluded.description_ko,is_active=true
  returning id
)
insert into public.sources(id,publisher_id,name,source_kind,fetch_strategy,start_url,parser_config,poll_interval_minutes,next_run_at,respect_robots,terms_reviewed_at,is_active)
select 'bab5bef0-c433-586d-b7c6-68b5214361ef',id,'IMDA official press release archive','html','http',
  'https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches?page=1',
  jsonb_build_object('collector_executor','cloud-python','automatic_collection_enabled',true,
    'document_scope','official_press_release_article_body','robots_review_result','robots_txt_allows_configured_release_archive_and_article_paths',
    'terms_review_result','access_route_reviewed_no_reuse_license_inferred','pagination_order','newest_first',
    'relevance_review_required',true,'coverage_complete',false,
    'verification_status','official_archive_and_detail_verified_human_relevance_review_required',
    'verification','Official IMDA archive and article route were reachable; server-rendered release dates are newest-first. robots.txt disallows unrelated paths but permits the configured release archive and article paths. Only privacy/data-protection-relevant releases are retained. Machine extraction and topic relevance require review; no reuse license is inferred.',
    'approval_basis','User requested an official alternative route for Singapore privacy developments when PDPC collection fails; IMDA is PDPC parent authority.'),
  1440,now(),true,now(),true
from new_publisher
on conflict(id) do update set publisher_id=excluded.publisher_id,name=excluded.name,source_kind=excluded.source_kind,
  fetch_strategy=excluded.fetch_strategy,start_url=excluded.start_url,parser_config=excluded.parser_config,
  poll_interval_minutes=excluded.poll_interval_minutes,next_run_at=coalesce(public.sources.next_run_at,excluded.next_run_at),
  respect_robots=true,terms_reviewed_at=coalesce(public.sources.terms_reviewed_at,excluded.terms_reviewed_at),is_active=true,updated_at=now();

insert into public.collector_edge_sources(source_id,slug,state)
values('bab5bef0-c433-586d-b7c6-68b5214361ef','imda',jsonb_build_object(
  'since',(now() at time zone 'Asia/Seoul')::date-2,
  'until',(now() at time zone 'Asia/Seoul')::date))
on conflict(source_id) do update set state=excluded.state,updated_at=now();

insert into public.collector_cloud_routes(source_id,enabled,range_start,range_end)
values('bab5bef0-c433-586d-b7c6-68b5214361ef',true,
  (now() at time zone 'Asia/Seoul')::date-2,(now() at time zone 'Asia/Seoul')::date)
on conflict(source_id) do update set enabled=true,
  range_start=coalesce(public.collector_cloud_routes.range_start,excluded.range_start),
  range_end=greatest(coalesce(public.collector_cloud_routes.range_end,excluded.range_end),excluded.range_end),updated_at=now();

do $imda_cursor$
declare definition text; old_pattern text; new_pattern text; n integer;
begin
  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  old_pattern=$old$'^https://www[.]europarl[.]europa[.]eu/'$old$;
  new_pattern=$new$'^https://www[.]europarl[.]europa[.]eu/' when slug = 'imda' then '^https://www[.]imda[.]gov[.]sg/resources/press-releases-factsheets-and-speeches([?]page=[0-9]+)?$'$new$;
  n=(length(definition)-length(replace(definition,old_pattern,'')))/length(old_pattern);
  if n<>1 then raise exception 'IMDA cursor guard drift: expected one current branch, found %',n; end if;
  definition=replace(definition,old_pattern,new_pattern);
  if position(new_pattern in definition)=0 then raise exception 'IMDA cursor guard postcondition failed'; end if;
  execute definition;
end;
$imda_cursor$;
