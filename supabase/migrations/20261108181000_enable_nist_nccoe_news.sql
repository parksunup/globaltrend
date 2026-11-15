-- Admit NIST's verified official NCCoE news route to the existing cloud worker.
-- Collection is enabled for internal drafts; AI generation is allowed for internal drafting; human review remains required and
-- human relevance review remains mandatory.
do $nist_source$
declare
  sid constant uuid := '37bea39f-6ebe-4684-880d-19c715399c4b';
  pid uuid;
  initial_since date := (now() at time zone 'Asia/Seoul')::date - 2;
  initial_until date := (now() at time zone 'Asia/Seoul')::date;
begin
  select publisher_id into strict pid from public.sources where id=sid;
  update public.publishers set is_active=true where id=pid;
  update public.sources
     set name='US National Institute of Standards and Technology',
         source_kind='html', fetch_strategy='http',
         start_url='https://www.nist.gov/news-events/news-updates/org/258376',
         parser_config=(coalesce(parser_config,'{}'::jsonb) - 'hold_reason') || jsonb_build_object(
           'collector_executor','cloud-python',
           'automatic_collection_enabled',true,
           'document_scope','official_nist_news_full_body',
           'robots_review_result','robots_txt_allows_requested_path',
           'terms_review_result','official_copyright_disclaimers_public_service_public_information_attribution_requested',
           'terms_review_url','https://www.nist.gov/copyrights-disclaimers',
           'page_level_copyright_markings_must_be_respected',true,
           'relevance_review_required',true,
           'ai_generation_enabled',true,
           'verification_status','runtime_listing_detail_date_and_pagination_verified_human_topic_review_required',
           'verification','Official NCCoE listing returned 25 rows and a next page; a privacy-relevant detail returned 2,050 Trafilatura characters with listing/detail publication date 2026-10-29. Production Crawlee HttpClient and extraction order were used.',
           'approval_basis','User requested NIST in the complete source scope. NIST robots permits the path. Official NIST copyright/disclaimer states that website information is a public service and unmarked information may be copied or distributed with attribution; respect page-specific markings.'
         ),
         poll_interval_minutes=1440, respect_robots=true,
         terms_reviewed_at=coalesce(terms_reviewed_at,now()), is_active=true
   where id=sid;
  if not found then raise exception 'NIST source activation failed'; end if;
  insert into public.collector_edge_sources(source_id,slug,state)
  values(sid,'nist',jsonb_build_object('since',initial_since,'until',initial_until))
  on conflict(source_id) do nothing;
  insert into public.collector_cloud_routes(source_id,enabled,range_start,range_end)
  values(sid,true,initial_since,initial_until)
  on conflict(source_id) do update set enabled=true,
    range_start=coalesce(public.collector_cloud_routes.range_start,excluded.range_start),
    range_end=coalesce(public.collector_cloud_routes.range_end,excluded.range_end),
    updated_at=now();
end;
$nist_source$;

-- Add the exact source slug to the current claim allowlist. Fail if the function
-- has drifted from the reviewed post-ANPD route contract.
do $nist_claim$
declare definition text; old_guard text; new_guard text; n integer;
begin
  definition=pg_get_functiondef('public.collector_cloud_take(text,text)'::regprocedure);
  old_guard=$old$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br')$old$;
  new_guard=$new$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br','nist')$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'NIST cloud claim guard drift: expected one old clause, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 or position(old_guard in definition)>0 then raise exception 'NIST cloud claim guard postcondition failed'; end if;
  execute definition;

  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  old_guard=$old$when slug='anpd-br' then '^https://www[.]gov[.]br/anpd/'$old$;
  new_guard=$new$when slug='anpd-br' then '^https://www[.]gov[.]br/anpd/' when slug='nist' then '^https://www[.]nist[.]gov/news-events/(news-updates/org/258376|news/[0-9]{4}/[0-9]{2}/[a-z0-9-]+)'$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'NIST cursor host guard drift: expected one ANPD clause, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 then raise exception 'NIST cursor host guard postcondition failed'; end if;
  execute definition;
end;
$nist_claim$;

-- NIST's official Drupal listing has `?page=N` continuation URLs and article
-- pages under /news-events/news/YYYY/MM/slug.
do $nist_frozen_cursor$
declare definition text; old_guard text; new_guard text; n integer;
begin
  definition=pg_get_functiondef('private.collector_cloud_frozen_cursor_valid(jsonb,text)'::regprocedure);
  old_guard=$old$if slug not in ('ec','eu-parliament','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;$old$;
  new_guard=$new$if slug not in ('ec','eu-parliament','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br','nist') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'NIST frozen-source guard drift: expected one old clause, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  old_guard=$old$ elsif slug='iso-iec-sc27' then
  path_pattern='^https://committee[.]iso[.]org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$';
  listing_pattern='^https://committee[.]iso[.]org/sites/jtc1sc27/home/news[.]html$';
 else
  path_pattern='^https://www[.]europarl[.]europa[.]eu/news/en/press-room/[0-9]{8}IPR[0-9]+/[^?#]*$';
  listing_pattern='^https://www[.]europarl[.]europa[.]eu/rss/doc/press-releases/en[.]xml$';
 end if;$old$;
  new_guard=$new$ elsif slug='nist' then
  path_pattern='^https://www[.]nist[.]gov/news-events/news/[0-9]{4}/[0-9]{2}/[a-z0-9-]+$';
  listing_pattern='^https://www[.]nist[.]gov/news-events/news-updates/org/258376([?]page=[0-9]+)?$';
 elsif slug='iso-iec-sc27' then
  path_pattern='^https://committee[.]iso[.]org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$';
  listing_pattern='^https://committee[.]iso[.]org/sites/jtc1sc27/home/news[.]html$';
 else
  path_pattern='^https://www[.]europarl[.]europa[.]eu/news/en/press-room/[0-9]{8}IPR[0-9]+/[^?#]*$';
  listing_pattern='^https://www[.]europarl[.]europa[.]eu/rss/doc/press-releases/en[.]xml$';
 end if;$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'NIST frozen route branch drift: expected one EU Parliament branch, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 then raise exception 'NIST frozen route branch postcondition failed'; end if;
  execute definition;
end;
$nist_frozen_cursor$;

alter table public.collector_cloud_listing_rows
  drop constraint if exists collector_cloud_listing_rows_url_allowed;
alter table public.collector_cloud_listing_rows
  add constraint collector_cloud_listing_rows_url_allowed check (
    (canonical_url ~ '^https://www[.]ftc[.]gov/'
     or canonical_url ~ '^https://www[.]pdp[.]gov[.]my/(en/[a-z0-9][a-z0-9-]*/?|wp-content/uploads/2026/10/Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework[.]pdf)$'
     or canonical_url ~ '^https://www[.]globalcbpr[.]org/([a-z0-9][a-z0-9-]*/|wp-content/uploads/(GlobalCBPRForum-Annual-Report-2025-2026|Global-CBPR-Forum-Work-Program-2026-2027)[.]pdf)$'
     or canonical_url ~ '^https://committee[.]iso[.]org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$'
     or canonical_url ~ '^https://www[.]gov[.]br/anpd/pt-br/assuntos/noticias/[a-z0-9][a-z0-9-]*$'
     or canonical_url ~ '^https://www[.]nist[.]gov/news-events/news/[0-9]{4}/[0-9]{2}/[a-z0-9-]+$')
    and position('?' in canonical_url)=0 and position('#' in canonical_url)=0
  );

revoke all on function public.collector_cloud_take(text,text),private.collector_cloud_cursor_valid(jsonb,text),private.collector_cloud_frozen_cursor_valid(jsonb,text) from public,anon,authenticated;
grant execute on function public.collector_cloud_take(text,text),public.collector_cloud_commit(uuid,text,uuid,jsonb,text) to service_role;

