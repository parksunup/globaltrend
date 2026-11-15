-- Enable the official ANPD Plone REST API after a live Crawlee listing/detail
-- pass. The listing and full article body were retrieved through the same
-- HttpClient used by the cloud collector; relevance still requires review.
do $anpd_source$
declare
  sid constant uuid := '8999005f-a0b3-4261-b073-bfce8f1834aa';
  pid uuid;
  initial_since date := (now() at time zone 'Asia/Seoul')::date - 2;
  initial_until date := (now() at time zone 'Asia/Seoul')::date;
begin
  select publisher_id into strict pid from public.sources where id=sid;
  update public.publishers set is_active=true where id=pid;
  update public.sources
     set name='Brazil ANPD',
         source_kind='json_api',
         fetch_strategy='http',
         start_url='https://www.gov.br/anpd/++api++/@search?portal_type=News%20Item&path=%2Fpt-br%2Fassuntos%2Fnoticias&sort_on=effective&sort_order=descending&b_size=10',
         parser_config=(coalesce(parser_config,'{}'::jsonb) - 'hold_reason') || jsonb_build_object(
           'collector_executor','cloud-python',
           'automatic_collection_enabled',true,
           'document_scope','official_plone_rest_api_news_item_full_body',
           'robots_review_result','robots_txt_allows_anpd_path',
           'terms_review_result','not_found_http_404',
           'user_authorized_inclusion',true,
           'relevance_review_required',true,
           'verification_status','runtime_listing_detail_and_parser_verified_human_relevance_review_required',
           'verification','Official Gov.br Plone REST listing/detail passed through the production Crawlee HttpClient; listing returned 10 published items and continuation, detail extracted 4,421 characters with matching effective date. AI readiness remains false pending human relevance review.',
           'approval_basis','User requested this source in the complete tested scope; Gov.br robots.txt does not disallow /anpd. Dedicated terms page returned HTTP 404; access-policy review completed without claiming terms permission. Source relevance requires human review.'
         ),
         poll_interval_minutes=1440,
         respect_robots=true,
         terms_reviewed_at=coalesce(terms_reviewed_at,now()),
         is_active=true
   where id=sid;
  if not found then raise exception 'ANPD source activation failed'; end if;

  insert into public.collector_edge_sources(source_id,slug,state)
  values(sid,'anpd-br',jsonb_build_object('since',initial_since,'until',initial_until))
  on conflict(source_id) do nothing;

  insert into public.collector_cloud_routes(source_id,enabled,range_start,range_end)
  values(sid,true,initial_since,initial_until)
  on conflict(source_id) do update
    set enabled=true,
        range_start=coalesce(public.collector_cloud_routes.range_start,excluded.range_start),
        range_end=coalesce(public.collector_cloud_routes.range_end,excluded.range_end),
        updated_at=now();
end;
$anpd_source$;

-- Permit the ANPD slug in the existing cloud claim function, preserving its
-- leases, retry behavior, and every already-enabled source.
do $anpd_cloud_claim$
declare definition text; expected text;
begin
  definition=pg_get_functiondef('public.collector_cloud_take(text,text)'::regprocedure);
  expected=$guard$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27')$guard$;
  if position(expected in definition)=0 then
    raise exception 'cloud source assignment contract drift';
  end if;
  execute replace(definition,expected,$guard$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br')$guard$);

  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  expected=$guard$when slug='edps' then '^https://social[.]edps[.]europa[.]eu/@EDPS/[0-9]+$'$guard$;
  if position(expected in definition)=0 then
    raise exception 'cloud cursor host contract drift';
  end if;
  execute replace(definition,expected,$guard$when slug='edps' then '^https://social[.]edps[.]europa[.]eu/@EDPS/[0-9]+$' when slug='anpd-br' then '^https://www[.]gov[.]br/anpd/'$guard$);
end;
$anpd_cloud_claim$;

-- Frozen URL snapshots use the existing durable cursor. Add ANPD's exact
-- official listing and canonical article paths to its source-specific guard.
do $anpd_frozen_cursor$
declare definition text; expected text;
begin
  definition=pg_get_functiondef('private.collector_cloud_frozen_cursor_valid(jsonb,text)'::regprocedure);
  expected=$guard$if slug not in ('ec','eu-parliament','jpdp-my','global-cbpr','iso-iec-sc27') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;$guard$;
  if position(expected in definition)=0 then
    raise exception 'frozen cursor source contract drift';
  end if;
  definition=replace(definition,expected,$guard$if slug not in ('ec','eu-parliament','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;$guard$);

  expected=$guard$else
  path_pattern='^https://committee[.]iso[.]org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$';
  listing_pattern='^https://committee[.]iso[.]org/sites/jtc1sc27/home/news[.]html$';
 end if;$guard$;
  if position(expected in definition)=0 then
    raise exception 'frozen cursor route contract drift';
  end if;
  definition=replace(definition,expected,$guard$elsif slug='anpd-br' then
  path_pattern='^https://www[.]gov[.]br/anpd/pt-br/assuntos/noticias/[a-z0-9][a-z0-9-]*$';
  listing_pattern='^https://www[.]gov[.]br/anpd/[+][+]api[+][+]/@search[?][^#]+$';
 elsif slug='iso-iec-sc27' then
  path_pattern='^https://committee[.]iso[.]org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$';
  listing_pattern='^https://committee[.]iso[.]org/sites/jtc1sc27/home/news[.]html$';
 else
  path_pattern='^https://www[.]europarl[.]europa[.]eu/news/en/press-room/[0-9]{8}IPR[0-9]+/[^?#]*$';
  listing_pattern='^https://www[.]europarl[.]europa[.]eu/rss/doc/press-releases/en[.]xml$';
 end if;$guard$);
  execute definition;
end;
$anpd_frozen_cursor$;

-- The frozen listing snapshot stores canonical article URLs, not API URLs.
alter table public.collector_cloud_listing_rows
  drop constraint if exists collector_cloud_listing_rows_url_allowed;
alter table public.collector_cloud_listing_rows
  add constraint collector_cloud_listing_rows_url_allowed check (
    (canonical_url ~ '^https://www[.]ftc[.]gov/'
     or canonical_url ~ '^https://www[.]pdp[.]gov[.]my/(en/[a-z0-9][a-z0-9-]*/?|wp-content/uploads/2026/10/Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework[.]pdf)$'
     or canonical_url ~ '^https://www[.]globalcbpr[.]org/([a-z0-9][a-z0-9-]*/|wp-content/uploads/(GlobalCBPRForum-Annual-Report-2025-2026|Global-CBPR-Forum-Work-Program-2026-2027)[.]pdf)$'
     or canonical_url ~ '^https://committee[.]iso[.]org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$'
     or canonical_url ~ '^https://www[.]gov[.]br/anpd/pt-br/assuntos/noticias/[a-z0-9][a-z0-9-]*$')
    and position('?' in canonical_url)=0 and position('#' in canonical_url)=0
  );

revoke all on function public.collector_cloud_take(text,text),private.collector_cloud_cursor_valid(jsonb,text),private.collector_cloud_frozen_cursor_valid(jsonb,text) from public,anon,authenticated;
grant execute on function public.collector_cloud_take(text,text),public.collector_cloud_commit(uuid,text,uuid,jsonb,text) to service_role;
