-- Spain AEPD official press releases: additive source only. AEPD robots blocks
-- the listing's ?page= pagination, so the first page is a bounded discovery
-- window and period coverage remains unverified. Never follow blocked pages.
insert into public.publishers(id,name,acronym,jurisdiction_code,publisher_type,website_url,is_active)
values('54308c4e-dfe8-56b9-a902-0d6b186012bd','Agencia Española de Protección de Datos','AEPD','ES','supervisory_authority','https://www.aepd.es',true)
on conflict(id) do nothing;

insert into public.sources(id,publisher_id,name,source_kind,fetch_strategy,start_url,parser_config,poll_interval_minutes,respect_robots,terms_reviewed_at,is_active)
values('5310c233-56e1-5a53-9ade-f7373140e4dc','54308c4e-dfe8-56b9-a902-0d6b186012bd','AEPD Press Releases','html','http','https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa',
 jsonb_build_object('automatic_collection_enabled',false,'collector_executor','edge','expansion_phase',3,'lookback_days',3,'document_scope','official_press_or_news_body','approval_basis','2026-10-29 user requested next source expansion; official listing and detail checked; no public draft access','coverage_limit','first_page_only_pagination_disallowed_by_robots'),
 1440,true,now(),true)
on conflict(id) do nothing;

insert into public.collector_edge_sources(source_id,slug,state)
values('5310c233-56e1-5a53-9ade-f7373140e4dc','es-aepd',jsonb_build_object('since',(now() at time zone 'Asia/Seoul')::date-2,'until',(now() at time zone 'Asia/Seoul')::date))
on conflict(source_id) do nothing;
