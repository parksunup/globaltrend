-- Activate three evidence-backed public routes. Listing dates and dates printed
-- inside attached standards/reports remain distinct; every item still requires
-- human relevance and factual review before it can become a public report.
do $pdf_sources$
declare
  item record;
  initial_since date := (now() at time zone 'Asia/Seoul')::date - 2;
  initial_until date := (now() at time zone 'Asia/Seoul')::date;
begin
  for item in select * from (values
    ('0db916d5-a210-4bd8-b5f3-97571fdd1e60'::uuid, 'b1e85e96-3399-4718-b534-8dcc22fd6e96'::uuid,
      'jpdp-my', 'Malaysia Personal Data Protection Commissioner', 'https://www.pdp.gov.my/en/main-page/',
      'official_listing_exact_pdf_attachment', 'pagination_incomplete'),
    ('ed10f3a1-4d0d-4409-9ae4-7d320ae92abc'::uuid, '99d67ba2-6a6d-46e5-9563-dcbf427ef66c'::uuid,
      'global-cbpr', 'Global CBPR Forum', 'https://www.globalcbpr.org/news/',
      'official_news_and_exact_report_work_program_pdfs', 'pagination_incomplete'),
    ('3fd924b0-3a38-4ba6-b9b2-5154ecca3a39'::uuid, 'ab505e8c-590d-43da-a0a6-8bd44d95522f'::uuid,
      'iso-iec-sc27', 'ISO/IEC JTC 1/SC 27', 'https://committee.iso.org/sites/jtc1sc27/home/news.html',
      'official_news_table_exact_standard_pdf', 'full_publication_date_unavailable')
  ) as x(source_id,publisher_id,slug,source_name,listing_url,document_scope,coverage_status)
  loop
    update public.publishers set is_active=true where id=item.publisher_id;
    update public.sources
       set name=item.source_name, source_kind='html', fetch_strategy='http',
           start_url=item.listing_url,
           parser_config=(coalesce(parser_config,'{}'::jsonb)-'hold_reason') || jsonb_build_object(
             'collector_executor','cloud-python',
             'automatic_collection_enabled',true,
             'document_scope',item.document_scope,
             'coverage_status',item.coverage_status,
             'terms_review_result','separate terms not verified; no license grant claimed',
             'terms_review_semantics','terms_reviewed_at records that source access-policy review was performed; it does not mean source terms grant permission',
             'relevance_review_required',true,
             'ai_generation_enabled',true,
             'verification_status',case item.slug
               when 'jpdp-my' then 'official_listing_detail_pdf_and_date_verified_human_review_required_pagination_incomplete'
               when 'global-cbpr' then 'official_listing_detail_two_pdfs_and_publication_date_verified_human_review_required_pagination_incomplete'
               else 'official_listing_pdf_and_month_evidence_verified_full_publication_date_unavailable_human_review_required'
             end,
             'approval_basis','User requested inclusion in the complete tested-source scope. Only source-specific public listing routes and exact evidence-backed official PDF assets are read. Machine-extracted material requires human review; listing and document dates are kept separate.'
           ),
           poll_interval_minutes=case when item.slug='jpdp-my' then 1440 else 10080 end,
           respect_robots=true, terms_reviewed_at=coalesce(terms_reviewed_at,now()), is_active=true
     where id=item.source_id;
    if not found then raise exception 'PDF source row missing: %',item.slug; end if;
    -- Catalog-only sources intentionally do not get queue rows until their
    -- route is verified. Register the verified cloud route now, preserving any
    -- existing cursor/state if this migration is replayed against seeded data.
    insert into public.collector_edge_sources(source_id,slug,state)
    values(item.source_id,item.slug,jsonb_build_object('since',initial_since,'until',initial_until))
    on conflict(source_id) do nothing;
    insert into public.collector_cloud_routes(source_id,enabled,range_start,range_end)
    values(item.source_id,true,initial_since,initial_until)
    on conflict(source_id) do update set enabled=true,
      range_start=coalesce(public.collector_cloud_routes.range_start,excluded.range_start),
      range_end=coalesce(public.collector_cloud_routes.range_end,excluded.range_end),
      updated_at=now();
  end loop;
end;
$pdf_sources$;

-- Extend the exact assigned-source slug and source-specific URL guards.
do $pdf_cloud_routes$
declare definition text; old_guard text; new_guard text; n integer;
begin
  definition=pg_get_functiondef('public.collector_cloud_take(text,text)'::regprocedure);
  old_guard=$old$slug in ('oecd','ftc','ec','eu-parliament','edps')$old$;
  new_guard=$new$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27')$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'PDF cloud claim guard drift: expected one EDPS allowlist, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 or position(old_guard in definition)>0 then raise exception 'PDF cloud claim guard postcondition failed'; end if;
  execute definition;

  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  old_guard=$old$when slug='edps' then '^https://social[.]edps[.]europa[.]eu/@EDPS/[0-9]+$'$old$;
  new_guard=$new$when slug='edps' then '^https://social[.]edps[.]europa[.]eu/@EDPS/[0-9]+$'
   when slug='jpdp-my' then '^https://www[.]pdp[.]gov[.]my/(en/main-page/|en/[a-z0-9][a-z0-9-]*/?|wp-content/uploads/2026/10/Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework[.]pdf)$'
   when slug='global-cbpr' then '^https://www[.]globalcbpr[.]org/(news/|[a-z0-9][a-z0-9-]*/?|wp-content/uploads/(GlobalCBPRForum-Annual-Report-2025-2026|Global-CBPR-Forum-Work-Program-2026-2027)[.]pdf)$'
   when slug='iso-iec-sc27' then '^https://committee[.]iso[.]org/sites/jtc1sc27/home/news[.]html$|^https://committee[.]iso[.]org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$'$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'PDF cursor host guard drift: expected one EDPS branch, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 then raise exception 'PDF cursor route postcondition failed'; end if;
  execute definition;
end;
$pdf_cloud_routes$;

-- Frozen-listing snapshots preserve exact observed article/PDF URLs. They have
-- no item-count, body-size, or offset ceilings; malformed large offsets return
-- false safely instead of overflowing an integer cast.
create or replace function private.collector_cloud_frozen_cursor_valid(c jsonb,slug text)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare u jsonb; path_pattern text; listing_pattern text; count_urls numeric; cursor_offset numeric;
begin
 if not (c ? 'frozen_urls') then return not (c ? 'frozen_next'); end if;
 if slug not in ('ec','eu-parliament','jpdp-my','global-cbpr','iso-iec-sc27') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;
 count_urls=jsonb_array_length(c->'frozen_urls')::numeric;
 if count_urls<1 or not (c ? 'frozen_next') then return false; end if;
 if jsonb_typeof(c->'offset') is distinct from 'number'
    or (c->>'offset') !~ '^[0-9]+$' then return false; end if;
 cursor_offset=(c->>'offset')::numeric;
 if cursor_offset>count_urls then return false; end if;
 if slug='ec' then
  path_pattern='^https://ec[.]europa[.]eu/commission/presscorner/detail/en/(ip|qanda|statement|speech|memo|mex)_[0-9]{2}_[0-9]+$';
  listing_pattern='^https://ec[.]europa[.]eu/commission/presscorner/api/search[?][^#]+$';
 elsif slug='eu-parliament' then
  path_pattern='^https://www[.]europarl[.]europa[.]eu/news/en/press-room/[0-9]{8}IPR[0-9]+/[^?#]*$';
  listing_pattern='^https://www[.]europarl[.]europa[.]eu/rss/doc/press-releases/en[.]xml$';
 elsif slug='jpdp-my' then
  path_pattern='^https://www[.]pdp[.]gov[.]my/(en/[a-z0-9][a-z0-9-]*/?|wp-content/uploads/2026/10/Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework[.]pdf)$';
  listing_pattern='^https://www[.]pdp[.]gov[.]my/en/main-page/$';
 elsif slug='global-cbpr' then
  path_pattern='^https://www[.]globalcbpr[.]org/([a-z0-9][a-z0-9-]*/|wp-content/uploads/(GlobalCBPRForum-Annual-Report-2025-2026|Global-CBPR-Forum-Work-Program-2026-2027)[.]pdf)$';
  listing_pattern='^https://www[.]globalcbpr[.]org/news/$';
 else
  path_pattern='^https://committee[.]iso[.]org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$';
  listing_pattern='^https://committee[.]iso[.]org/sites/jtc1sc27/home/news[.]html$';
 end if;
 if c->>'page' !~ listing_pattern then return false; end if;
 if jsonb_typeof(c->'frozen_next') not in ('null','string') then return false; end if;
 if c->'frozen_next'<>'null'::jsonb and (slug='eu-parliament' or c->>'frozen_next' !~ listing_pattern) then return false; end if;
 for u in select value from jsonb_array_elements(c->'frozen_urls') loop
  if jsonb_typeof(u) is distinct from 'string' or u#>>'{}' !~ path_pattern then return false; end if;
 end loop;
 if (select count(distinct value) from jsonb_array_elements(c->'frozen_urls'))::numeric<>count_urls then return false; end if;
 return true;
exception when numeric_value_out_of_range or invalid_text_representation then
 return false;
end; $$;

alter table public.collector_cloud_listing_rows
  drop constraint if exists collector_cloud_listing_rows_url_allowed;
alter table public.collector_cloud_listing_rows
  add constraint collector_cloud_listing_rows_url_allowed check (
    (canonical_url ~ '^https://www[.]ftc[.]gov/'
     or canonical_url ~ '^https://www[.]gov[.]br/anpd/pt-br/assuntos/noticias/[a-z0-9][a-z0-9-]*$'
     or canonical_url ~ '^https://www[.]nist[.]gov/news-events/news/[0-9]{4}/[0-9]{2}/[a-z0-9-]+$'
     or canonical_url ~ '^https://www[.]pdp[.]gov[.]my/(en/[a-z0-9][a-z0-9-]*/?|wp-content/uploads/2026/10/Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework[.]pdf)$'
     or canonical_url ~ '^https://www[.]globalcbpr[.]org/([a-z0-9][a-z0-9-]*/|wp-content/uploads/(GlobalCBPRForum-Annual-Report-2025-2026|Global-CBPR-Forum-Work-Program-2026-2027)[.]pdf)$'
     or canonical_url ~ '^https://committee[.]iso[.]org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$')
    and position('?' in canonical_url)=0 and position('#' in canonical_url)=0
  );

revoke all on function public.collector_cloud_take(text,text),private.collector_cloud_cursor_valid(jsonb,text),private.collector_cloud_frozen_cursor_valid(jsonb,text)
  from public,anon,authenticated;
grant execute on function public.collector_cloud_take(text,text),public.collector_cloud_commit(uuid,text,uuid,jsonb,text)
  to service_role;
