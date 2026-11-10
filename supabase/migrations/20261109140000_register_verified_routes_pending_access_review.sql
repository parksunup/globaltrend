-- Register the source-specific public routes integrated and exercised by the cloud Python adapter.
-- Keep operational activation on hold until a separate access-policy/terms review is recorded.
do $sources$
declare
  source_row jsonb;
  ico_publisher_id uuid;
  since_day date := (now() at time zone 'Asia/Seoul')::date - 2;
  until_day date := (now() at time zone 'Asia/Seoul')::date;
  weekly_since date := (now() at time zone 'Asia/Seoul')::date - 6;
begin
  -- ICO is present in the collector registry but was never inserted into the
  -- clean migration seed. Register it as a held catalog source so a fresh
  -- migration replay can represent the verified WiredGov route without
  -- enabling collection before reuse/coverage review.
  insert into public.publishers(name,acronym,jurisdiction_code,publisher_type,website_url,description_ko,is_active)
  select 'Information Commissioner''s Office','ICO','GB','supervisory_authority','https://ico.org.uk/',
         '영국 개인정보 감독기관. WiredGov 재게시 경로는 별도 재사용·범위 검토 전까지 보류.',false
   where not exists(select 1 from public.publishers where acronym='ICO');
  select id into strict ico_publisher_id from public.publishers where acronym='ICO' order by created_at,id limit 1;
  insert into public.sources as existing_source(id,publisher_id,name,source_kind,fetch_strategy,start_url,parser_config,
      poll_interval_minutes,respect_robots,terms_reviewed_at,is_active)
  values('d7c96a28-2fca-49ad-a631-3a62cf0a03b9',ico_publisher_id,
      'UK Information Commissioner''s Office','html','http',
      'https://www.wired-gov.net/wg/home.nsf/nav/latest+news?open&id=BDEX-6ZFKSH',
      jsonb_build_object('collector_executor','hold','automatic_collection_enabled',false,
        'hold_reason','source_access_policy_review_pending','coverage_complete',false,
        'document_scope','official_wiredgov_cross_source_latest_index_filtered_by_ico_attribution'),
      1440,true,null,false)
  on conflict(id) do update set
    publisher_id=excluded.publisher_id,name=excluded.name,source_kind=excluded.source_kind,
    fetch_strategy=excluded.fetch_strategy,start_url=excluded.start_url,
    parser_config=(coalesce(existing_source.parser_config,'{}'::jsonb) || excluded.parser_config),
    poll_interval_minutes=excluded.poll_interval_minutes,respect_robots=true,
    terms_reviewed_at=null,is_active=false;

  for source_row in select value from jsonb_array_elements($items$[
    {"slug":"ico","id":"d7c96a28-2fca-49ad-a631-3a62cf0a03b9","name":"UK Information Commissioner's Office","url":"https://www.wired-gov.net/wg/home.nsf/nav/latest+news?open&id=BDEX-6ZFKSH","kind":"html","since_days":2,"scope":"official_wiredgov_cross_source_latest_index_filtered_by_ico_attribution","verification":"WiredGov latest index returned HTTP 200/197807 bytes/204 anchors. An ICO-attributed detail returned HTTP 200/37222 bytes; Trafilatura extracted 5257 characters and title/date matched 2026-11-05. Cross-source index shows about five business days, no continuation; coverage incomplete.","status":"wiredgov_listing_and_detail_verified_current_week_only","review":"WiredGov exact publisher attribution; internal draft only; no claim of archive completeness or separate terms permission."},
    {"slug":"hk-pcpd","id":"d4d64477-c45b-5f10-883d-374a7cd0ddfe","name":"Hong Kong Privacy Commissioner for Personal Data","url":"https://www.info.gov.hk/gia/general/today.htm","kind":"html","since_days":2,"scope":"official_isd_daily_date_archive_republication","verification":"Official ISD daily archive for 2026-01-27 returned HTTP 200/15627 bytes/53 links and linked a PCPD/HKMA release; detail returned HTTP 200/18418 bytes and Trafilatura extracted 4913 characters/date 2026-01-27. The generic RSS currently has no PCPD mention. Daily archive route is implemented; this does not establish all PCPD releases are republished.","status":"official_date_archive_detail_verified_republication_coverage_incomplete","review":"Official Hong Kong Government Information Services archive; daily date traversal; internal draft only; no claim of full PCPD archive coverage or terms grant."},
    {"slug":"g7-dpa","id":"c1c51983-486c-4a6e-98ef-43eaaee88d5a","name":"G7 Data Protection and Privacy Authorities Roundtable","url":"https://www.priv.gc.ca/en/about-the-opc/what-we-do/international-privacy-networks/news-announcement-ic/?o=d&Page=1&Filter=True","kind":"html","since_days":6,"scope":"official_canada_opc_international_network_list_filtered_for_g7","verification":"Official Canada OPC international-network list route requires observed query flags o=d, Page=N, Filter=True. Earlier route without Filter returned HTTP 404 in the 36-source probe; recheck exact observed form before activation. G7 communiqué body/date evidence remains from earlier official sample; weekly coverage incomplete.","status":"verified_route_query_corrected_pending_current_recheck","review":"Official OPC international-network listing, G7-related row filtering; do not claim the corrected live route until Crawlee recheck succeeds."},
    {"slug":"vn-gov","id":"9e9815e2-2028-4384-a5e5-6ebd1f2e2f55","name":"Vietnam Government Online Newspaper","url":"https://en.baochinhphu.vn/","kind":"html","since_days":2,"scope":"official_homepage_focus_plus_policy_timeline","verification":"Official homepage focus card links to a relevant 2026-11-02 Decree 363 article (HTTP 200, Trafilatura 4309 chars, meta/JSON-LD/visible date agree). The article was absent from observed policies timeline pages 1-5; timeline route itself is verified but index completeness is unresolved.","status":"official_homepage_detail_verified_policy_timeline_coverage_incomplete","review":"Official English Government Online route; homepage focus plus observed policy timeline; known index omission means completeness is not claimed."},
    {"slug":"eu-council","id":"f4dc010a-0c02-5b24-8799-bd64f20b2e25","name":"Council of the European Union Press Releases","url":"https://www.consilium.europa.eu/en/rss/pressreleases.ashx","kind":"rss","since_days":2,"scope":"official_rss_privacy_filtered_summary_only","verification":"Official RSS returned HTTP 200 XML/14640 bytes/20 items with ISO-offset dates and 64-282 character descriptions. Current 20 contained no privacy/data-protection match; one linked detail returned HTTP 403. Runtime stores only matching RSS summaries and never requests linked detail. Rolling window is incomplete.","status":"official_rss_summary_only_detail_blocked_rolling_window_incomplete","review":"Official Council RSS summary-only path; detail links are not fetched; summaries require human editorial review."}
  ]$items$::jsonb) loop
    update public.publishers set is_active=false where id=(select publisher_id from public.sources where id=(source_row->>'id')::uuid);
    update public.sources
       set name=source_row->>'name', source_kind=source_row->>'kind', fetch_strategy='http',
           start_url=source_row->>'url', is_active=false, respect_robots=true, terms_reviewed_at=null,
           poll_interval_minutes=case when source_row->>'slug'='g7-dpa' then 10080 else 1440 end,
           parser_config=(coalesce(parser_config,'{}'::jsonb)-'hold_reason') || jsonb_build_object(
             'collector_executor','hold', 'automatic_collection_enabled',false,
             'coverage_complete',false, 'relevance_review_required',true,
             'ai_generation_enabled',true, 'document_scope',source_row->>'scope',
             'verification_status',source_row->>'status', 'verification',source_row->>'verification',
             'hold_reason','source_access_policy_review_pending',
             'terms_review_result','source route/access reviewed; separate terms or reuse grant not verified',
             'terms_review_semantics','terms_reviewed_at records completion of access/policy review; it is not evidence that source terms grant permission',
             'approval_basis',source_row->>'review')
     where id=(source_row->>'id')::uuid;
    if not found then raise exception 'source row missing for %',source_row->>'slug'; end if;
    -- Keep a source-specific cursor row for the verified route even while
    -- collection is held. Inactive source + disabled cloud route prevents
    -- enqueue/claim; on conflict preserves any cursor already in use.
    insert into public.collector_edge_sources(source_id,slug,state)
    values((source_row->>'id')::uuid,source_row->>'slug',jsonb_build_object(
      'since',case when source_row->>'slug'='g7-dpa' then weekly_since else since_day end,
      'until',until_day
    ))
    on conflict(source_id) do nothing;
    insert into public.collector_cloud_routes(source_id,enabled,range_start,range_end)
    values((source_row->>'id')::uuid,false,
      case when source_row->>'slug'='g7-dpa' then (now() at time zone 'Asia/Seoul')::date-6 else (now() at time zone 'Asia/Seoul')::date-2 end,
      (now() at time zone 'Asia/Seoul')::date)
    on conflict(source_id) do update set enabled=false,
      range_start=coalesce(public.collector_cloud_routes.range_start,excluded.range_start),
      range_end=coalesce(public.collector_cloud_routes.range_end,excluded.range_end),updated_at=now();
  end loop;
end;
$sources$;

-- Undo the earlier summary-only activation timestamp: the later detail route
-- is robots-allowed, but separate terms/reuse review has not been completed.
do $nl_ap_hold$
declare sid constant uuid := '1d9ac2d7-02f7-4777-8677-c00fb702d021';
begin
  update public.publishers set is_active=false
   where id=(select publisher_id from public.sources where id=sid);
  update public.sources
     set is_active=false, terms_reviewed_at=null,
         parser_config=(coalesce(parser_config,'{}'::jsonb)-'hold_reason') || jsonb_build_object(
           'collector_executor','hold','automatic_collection_enabled',false,
           'coverage_complete',false,'full_article_retrieval',true,
           'document_scope','official_rss_discovery_plus_robots_allowed_detail; rolling_window_incomplete',
           'verification_status','official_rss_and_robots_allowed_detail_verified_coverage_incomplete_terms_hold',
           'verification','RSS has 10 entries. A linked official /actueel/* detail returned HTTP 200 and Trafilatura extracted 936 characters dated 2026-10-30. Protego 0.6.2 applies Allow: /actueel/* over Disallow: /actueel. Feed continuation and separate terms/reuse review remain unresolved.',
           'hold_reason','separate_source_terms_and_reuse_review_pending',
           'terms_review_result','separate terms and reuse grant not verified; no review timestamp is recorded',
           'approval_basis','User requested inclusion in the complete source scope; route evidence is retained, but automated collection stays held until separate policy review.'
         )
   where id=sid;
  if not found then raise exception 'Netherlands AP source hold correction failed'; end if;
  update public.collector_cloud_routes set enabled=false,updated_at=now() where source_id=sid;
end;
$nl_ap_hold$;

-- Add the five source slugs to the cloud claim guard so the route contract can be replayed;
-- the source rows and route rows remain inactive until access-policy review is recorded.
do $claim_guard$
declare definition text; old_guard text; new_guard text; n integer;
begin
  definition=pg_get_functiondef('public.collector_cloud_take(text,text)'::regprocedure);
  old_guard=$old$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br','nist','npc-ph','nl-ap')$old$;
  new_guard=$new$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br','nist','npc-ph','nl-ap','ico','g7-dpa','vn-gov','hk-pcpd','eu-council')$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'cloud source allowlist drift: expected one current guard, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 or position(old_guard in definition)>0 then raise exception 'cloud source allowlist postcondition failed'; end if;
  execute definition;

  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  old_guard=$old$when slug='nl-ap' then '^https://autoriteitpersoonsgegevens[.]nl/(feed/article/rss[.]xml|actueel/[a-z0-9-]+)$'$old$;
  new_guard=$new$when slug='nl-ap' then '^https://autoriteitpersoonsgegevens[.]nl/(feed/article/rss[.]xml|actueel/[a-z0-9-]+)$'
   when slug='ico' then '^https://www[.]wired-gov[.]net/(wg/home[.]nsf/nav/latest[+]news([?].*)?|wg/news[.]nsf/articles/[^?]+([?]open=?)?)$'
   when slug='g7-dpa' then '^https://www[.]priv[.]gc[.]ca/en/(about-the-opc/what-we-do/international-privacy-networks/news-announcement-ic/([?]o=d&Page=[0-9]+&Filter=True)?|opc-news/[^?]+|opc-actions-and-decisions/advice-to-parliament/[^?]+)$'
   when slug='vn-gov' then '^https://en[.]baochinhphu[.]vn/(/|policies[.]htm|timelinelist/11151/[0-9]+[.]htm|[a-z0-9-]+-[0-9]{18}[.]htm)$'
   when slug='hk-pcpd' then '^https://www[.]info[.]gov[.]hk/gia/general/(today[.]htm|[0-9]{6}/[0-9]{2}[.]htm|[0-9]{6}/[0-9]{2}/P[0-9]+[.]htm)$'
   when slug='eu-council' then '^https://www[.]consilium[.]europa[.]eu/en/(rss/pressreleases[.]ashx|press/press-releases/[0-9]{4}/[0-9]{2}/[0-9]{2}/[^?#]+/)$'$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'cloud URL allowlist drift: expected one NL AP branch, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 then raise exception 'cloud URL allowlist postcondition failed'; end if;
  execute definition;
end;
$claim_guard$;

-- Expand durable frozen-list cursors for the three source-specific URL-list routes.
-- The Council feed is summary-only and uses no frozen detail URL list.
do $frozen_guard$
declare definition text; old_guard text; new_guard text; n integer;
begin
  definition=pg_get_functiondef('private.collector_cloud_frozen_cursor_valid(jsonb,text)'::regprocedure);
  old_guard=$old$if slug not in ('ec','eu-parliament','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br','nist') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;$old$;
  new_guard=$new$if slug not in ('ec','eu-parliament','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br','nist','ico','g7-dpa','vn-gov','hk-pcpd') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'frozen source allowlist drift: expected one current guard, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 then raise exception 'frozen source allowlist postcondition failed'; end if;
  execute definition;

  old_guard=$old$ elsif slug='nist' then
  path_pattern='^https://www[.]nist[.]gov/news-events/news/[0-9]{4}/[0-9]{2}/[a-z0-9-]+$';
  listing_pattern='^https://www[.]nist[.]gov/news-events/news-updates/org/258376([?]page=[0-9]+)?$';
 elsif slug='iso-iec-sc27' then$old$;
  new_guard=$new$ elsif slug='nist' then
  path_pattern='^https://www[.]nist[.]gov/news-events/news/[0-9]{4}/[0-9]{2}/[a-z0-9-]+$';
  listing_pattern='^https://www[.]nist[.]gov/news-events/news-updates/org/258376([?]page=[0-9]+)?$';
 elsif slug='ico' then
  path_pattern='^https://www[.]wired-gov[.]net/wg/news[.]nsf/articles/[^?]+([?]open=?)?$';
  listing_pattern='^https://www[.]wired-gov[.]net/wg/home[.]nsf/nav/latest[+]news([?].*)?$';
 elsif slug='g7-dpa' then
  path_pattern='^https://www[.]priv[.]gc[.]ca/en/(opc-news/[^?]+|opc-actions-and-decisions/advice-to-parliament/[^?]+)$';
  listing_pattern='^https://www[.]priv[.]gc[.]ca/en/about-the-opc/what-we-do/international-privacy-networks/news-announcement-ic/([?]o=d&Page=[0-9]+&Filter=True)?$';
 elsif slug='vn-gov' then
  path_pattern='^https://en[.]baochinhphu[.]vn/[a-z0-9-]+-[0-9]{18}[.]htm$';
  listing_pattern='^https://en[.]baochinhphu[.]vn/(/|policies[.]htm|timelinelist/11151/[0-9]+[.]htm)$';
 elsif slug='hk-pcpd' then
  path_pattern='^https://www[.]info[.]gov[.]hk/gia/general/[0-9]{6}/[0-9]{2}/P[0-9]+[.]htm$';
  listing_pattern='^https://www[.]info[.]gov[.]hk/gia/general/([0-9]{6}/[0-9]{2}[.]htm|today[.]htm)$';
 elsif slug='iso-iec-sc27' then$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'frozen route branch drift: expected one ISO insertion point, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 then raise exception 'frozen route branch postcondition failed'; end if;
  execute definition;
end;
$frozen_guard$;

-- Keep source-specific listing-row URL checks limited to evidence-backed hosts.
-- A URL query is accepted only for WiredGov's observed ?open article link.
alter table public.collector_cloud_listing_rows drop constraint if exists collector_cloud_listing_rows_url_allowed;
alter table public.collector_cloud_listing_rows add constraint collector_cloud_listing_rows_url_allowed check (
  (canonical_url ~ '^https://www[.]ftc[.]gov/'
   or canonical_url ~ '^https://www[.]pdp[.]gov[.]my/'
   or canonical_url ~ '^https://www[.]globalcbpr[.]org/'
   or canonical_url ~ '^https://committee[.]iso[.]org/'
   or canonical_url ~ '^https://www[.]gov[.]br/anpd/'
   or canonical_url ~ '^https://www[.]nist[.]gov/'
   or canonical_url ~ '^https://www[.]wired-gov[.]net/wg/news[.]nsf/articles/[^?]+([?]open=?)?$'
   or canonical_url ~ '^https://www[.]priv[.]gc[.]ca/en/'
   or canonical_url ~ '^https://en[.]baochinhphu[.]vn/[a-z0-9-]+-[0-9]{18}[.]htm$'
   or canonical_url ~ '^https://www[.]info[.]gov[.]hk/gia/general/[0-9]{6}/[0-9]{2}/P[0-9]+[.]htm$'
   or canonical_url ~ '^https://www[.]consilium[.]europa[.]eu/en/press/press-releases/')
  and (position('?' in canonical_url)=0 or canonical_url ~ '^https://www[.]wired-gov[.]net/wg/news[.]nsf/articles/[^?]+[?]open=?$')
  and position('#' in canonical_url)=0
);

-- The configured reference-reading notes changed in this branch. Synchronize all three
-- actual document hashes with the database's immutable writer contract; refuse drift.
do $writing_policy$
declare definition text; old_hash text; new_hash text; n integer;
begin
  definition=pg_get_functiondef('public.collector_writing_policy()'::regprocedure);
  old_hash='71c73f5b4e96bec88ba750dacfacd51ebab015653edcf7bd704063a1b1504f49';
  new_hash='b9c46b82180f584e4ffee3c2b9a4e36ef1e16d2c34ad326e3d3fef4c4a7f7d03';
  n=(length(definition)-length(replace(definition,old_hash,'')))/length(old_hash);
  if n<>1 then raise exception 'writing policy style hash drift: expected one old hash, found %',n; end if;
  definition=replace(definition,old_hash,new_hash);

  old_hash='06178ac572f978c7140c2fc4ab3e13955ee324b4b15d53a1fcdfe2d9f8f1452f';
  new_hash='52b75c5c25517a7f1b93aef462e829fe50d8eb07c17bf864d879f8fe03823599';
  n=(length(definition)-length(replace(definition,old_hash,'')))/length(old_hash);
  if n<>1 then raise exception 'writing policy reading-notes hash drift: expected one old hash, found %',n; end if;
  definition=replace(definition,old_hash,new_hash);

  old_hash='50cd3d64f063088e1e11b7e98537b19609b383bd864c31be98c828317726f5f3';
  new_hash='2441ae7c18d2f5e4e0e906587512ebb6211b6b42b5e02a81bbc5179f684f6d78';
  n=(length(definition)-length(replace(definition,old_hash,'')))/length(old_hash);
  if n<>1 then raise exception 'writing policy glossary hash drift: expected one old hash, found %',n; end if;
  definition=replace(definition,old_hash,new_hash);
  if position('b9c46b82180f584e4ffee3c2b9a4e36ef1e16d2c34ad326e3d3fef4c4a7f7d03' in definition)=0
     or position('52b75c5c25517a7f1b93aef462e829fe50d8eb07c17bf864d879f8fe03823599' in definition)=0
     or position('2441ae7c18d2f5e4e0e906587512ebb6211b6b42b5e02a81bbc5179f684f6d78' in definition)=0
     or position('50cd3d64f063088e1e11b7e98537b19609b383bd864c31be98c828317726f5f3' in definition)>0 then
    raise exception 'writing policy hash postcondition failed';
  end if;
  execute definition;
end;
$writing_policy$;
