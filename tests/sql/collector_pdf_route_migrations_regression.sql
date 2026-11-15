\set ON_ERROR_STOP on
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create schema if not exists private;

create table public.publishers(id uuid primary key, is_active boolean not null default false);
create table public.sources(
 id uuid primary key, publisher_id uuid not null, name text not null default '', source_kind text not null default 'html',
 fetch_strategy text not null default 'http', start_url text not null default '', parser_config jsonb not null default '{}'::jsonb,
 poll_interval_minutes integer not null default 1440, respect_robots boolean not null default true,
 terms_reviewed_at timestamptz, is_active boolean not null default false
);
create table public.collector_cloud_routes(
 source_id uuid primary key, enabled boolean not null, range_start date, range_end date, updated_at timestamptz not null default now()
);
create table public.collector_edge_sources(source_id uuid primary key, slug text, state jsonb);
create table public.collector_cloud_listing_rows(
 source_id uuid, canonical_url text, row_data jsonb, url_hash text, scan_id uuid, ordinal integer
);
alter table public.collector_cloud_listing_rows add constraint collector_cloud_listing_rows_url_allowed
 check (canonical_url ~ '^https://www[.]ftc[.]gov/' and position('?' in canonical_url)=0 and position('#' in canonical_url)=0);

insert into public.publishers(id) values
 ('b1e85e96-3399-4718-b534-8dcc22fd6e96'),('99d67ba2-6a6d-46e5-9563-dcbf427ef66c'),
 ('ab505e8c-590d-43da-a0a6-8bd44d95522f'),('c24156b5-a63e-400b-b202-d220ffa81e82'),
 ('e8029854-2cdd-5f2b-9b60-113c31e9c44e'),('20f6ed2a-a84c-4260-82f4-12e8b6b969f9'),
 ('6283604f-f595-469e-8619-0640714ae80c'),('e5bb6a05-60ca-41b0-aeff-68e8b2346f59'),
 ('7ab700b9-c283-5143-ac22-15b3b308c40d'),('fbfa3125-2c85-54fe-93c7-592a9773d1db'),
 ('531484a5-1b21-54ce-b176-1e635755d79c'),('6d736b06-8da2-4e27-aeaf-77ecd43094ad');
insert into public.sources(id,publisher_id,name,start_url) values
 ('0db916d5-a210-4bd8-b5f3-97571fdd1e60','b1e85e96-3399-4718-b534-8dcc22fd6e96','JPDP','https://www.pdp.gov.my/en/main-page/'),
 ('ed10f3a1-4d0d-4409-9ae4-7d320ae92abc','99d67ba2-6a6d-46e5-9563-dcbf427ef66c','CBPR','https://www.globalcbpr.org/news/'),
 ('3fd924b0-3a38-4ba6-b9b2-5154ecca3a39','ab505e8c-590d-43da-a0a6-8bd44d95522f','ISO','https://committee.iso.org/sites/jtc1sc27/home/news.html'),
 ('8999005f-a0b3-4261-b073-bfce8f1834aa','c24156b5-a63e-400b-b202-d220ffa81e82','ANPD','https://www.gov.br/anpd/++api++/@search'),
 ('37bea39f-6ebe-4684-880d-19c715399c4b','e8029854-2cdd-5f2b-9b60-113c31e9c44e','NIST','https://www.nist.gov/news-events/news-updates/org/258376'),
 ('20f6ed2a-a84c-4260-82f4-12e8b6b969f9','20f6ed2a-a84c-4260-82f4-12e8b6b969f9','NPC','https://privacy.gov.ph/feed/'),
 ('1d9ac2d7-02f7-4777-8677-c00fb702d021','6283604f-f595-469e-8619-0640714ae80c','NL AP','https://autoriteitpersoonsgegevens.nl/feed/article/rss.xml'),
 ('d7c96a28-2fca-49ad-a631-3a62cf0a03b9','531484a5-1b21-54ce-b176-1e635755d79c','ICO','https://www.wired-gov.net/wg/home.nsf/nav/latest+news?open&id=BDEX-6ZFKSH'),
 ('d4d64477-c45b-5f10-883d-374a7cd0ddfe','7ab700b9-c283-5143-ac22-15b3b308c40d','PCPD','https://www.info.gov.hk/gia/general/today.htm'),
 ('f4dc010a-0c02-5b24-8799-bd64f20b2e25','fbfa3125-2c85-54fe-93c7-592a9773d1db','Council','https://www.consilium.europa.eu/en/rss/pressreleases.ashx'),
 ('c1c51983-486c-4a6e-98ef-43eaaee88d5a','e5bb6a05-60ca-41b0-aeff-68e8b2346f59','G7','https://www.priv.gc.ca/en/about-the-opc/what-we-do/international-privacy-networks/news-announcement-ic/?o=d&Page=1&Filter=True'),
 ('9e9815e2-2028-4384-a5e5-6ebd1f2e2f55','6d736b06-8da2-4e27-aeaf-77ecd43094ad','Vietnam','https://en.baochinhphu.vn/');

create function public.collector_cloud_commit(uuid,text,uuid,jsonb,text) returns boolean language sql as $$ select true $$;
create function public.collector_cloud_take(p_worker text,slug text) returns jsonb language plpgsql as $$
begin
 if slug in ('oecd','ftc','ec','eu-parliament','edps') then return '{}'::jsonb; end if;
 return '{}'::jsonb;
end $$;
create function private.collector_cloud_cursor_valid(c jsonb,slug text) returns boolean
language plpgsql immutable as $$
begin
 if c is null or c='null'::jsonb then return true; end if;
 if (c->>'page') !~ (case when slug='ftc' then '^https://www[.]ftc[.]gov/'
   when slug='oecd' then '^https://www[.]oecd[.]org/'
   when slug='ec' then '^https://ec[.]europa[.]eu/commission/presscorner/'
   when slug='eu-parliament' then '^https://www[.]europarl[.]europa[.]eu/'
   when slug='edps' then '^https://social[.]edps[.]europa[.]eu/@EDPS/[0-9]+$' else '^$' end) then return false; end if;
 return true;
end $$;
create function private.collector_cloud_frozen_cursor_valid(c jsonb,slug text) returns boolean
language plpgsql immutable as $$
declare u jsonb; path_pattern text; listing_pattern text; count_urls numeric; cursor_offset numeric;
begin
 if not (c ? 'frozen_urls') then return not (c ? 'frozen_next'); end if;
 if slug not in ('ec','eu-parliament') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;
 count_urls=jsonb_array_length(c->'frozen_urls')::numeric;
 if count_urls<1 or not (c ? 'frozen_next') then return false; end if;
 if jsonb_typeof(c->'offset') is distinct from 'number' or (c->>'offset') !~ '^[0-9]+$' then return false; end if;
 cursor_offset=(c->>'offset')::numeric;
 if cursor_offset>count_urls then return false; end if;
 if slug='ec' then path_pattern='^https://ec[.]europa[.]eu/commission/presscorner/detail/en/(ip|qanda|statement|speech|memo|mex)_[0-9]{2}_[0-9]+$'; listing_pattern='^https://ec[.]europa[.]eu/commission/presscorner/api/search[?][^#]+$';
 else path_pattern='^https://www[.]europarl[.]europa[.]eu/news/en/press-room/[0-9]{8}IPR[0-9]+/[^?#]*$'; listing_pattern='^https://www[.]europarl[.]europa[.]eu/rss/doc/press-releases/en[.]xml$'; end if;
 if c->>'page' !~ listing_pattern then return false; end if;
 if jsonb_typeof(c->'frozen_next') not in ('null','string') then return false; end if;
 for u in select value from jsonb_array_elements(c->'frozen_urls') loop
  if jsonb_typeof(u) is distinct from 'string' or u#>>'{}' !~ path_pattern then return false; end if;
 end loop;
 return true;
exception when numeric_value_out_of_range or invalid_text_representation then return false;
end $$;

create function public.collector_writing_policy() returns jsonb language sql stable as $$
 select '{"instruction_hashes":{"docs/trend-report-style.md":"71c73f5b4e96bec88ba750dacfacd51ebab015653edcf7bd704063a1b1504f49","docs/trend-reference-reading-notes.md":"06178ac572f978c7140c2fc4ab3e13955ee324b4b15d53a1fcdfe2d9f8f1452f","docs/translation/glossary.md":"50cd3d64f063088e1e11b7e98537b19609b383bd864c31be98c828317726f5f3"}}'::jsonb
$$;

\i /app/supabase/migrations/20261108171725_activate_verified_pdf_source_routes.sql
\i /app/supabase/migrations/20261108180000_enable_anpd_plone_rest.sql
\i /app/supabase/migrations/20261108181000_enable_nist_nccoe_news.sql
\i /app/supabase/migrations/20261109120000_enable_npc_full_content_rss.sql
\i /app/supabase/migrations/20261109130000_enable_nl_ap_rss_summary.sql
\i /app/supabase/migrations/20261109140000_register_verified_routes_pending_access_review.sql

do $$ begin
 if not private.collector_cloud_frozen_cursor_valid(jsonb_build_object('page','https://www.pdp.gov.my/en/main-page/','offset',0,'frozen_urls',jsonb_build_array('https://www.pdp.gov.my/en/public-consultation-paper-no-1-2026-artificial-intelligence-ai-and-personal-data-protection-framework/'),'frozen_next',null),'jpdp-my') then raise exception 'JPDP frozen route failed'; end if;
 if not private.collector_cloud_frozen_cursor_valid(jsonb_build_object('page','https://www.globalcbpr.org/news/','offset',0,'frozen_urls',jsonb_build_array('https://www.globalcbpr.org/the-forum-releases-its-annual-report-2025-2026-and-annual-work-program-for-2026-2027/'),'frozen_next',null),'global-cbpr') then raise exception 'CBPR frozen route failed'; end if;
 if not private.collector_cloud_frozen_cursor_valid(jsonb_build_object('page','https://committee.iso.org/sites/jtc1sc27/home/news.html','offset',0,'frozen_urls',jsonb_build_array('https://committee.iso.org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023.pdf'),'frozen_next',null),'iso-iec-sc27') then raise exception 'ISO frozen route failed'; end if;
 if not private.collector_cloud_cursor_valid(jsonb_build_object('page','https://social.edps.europa.eu/@EDPS/123'),'edps') then raise exception 'existing EDPS route changed'; end if;
 if not private.collector_cloud_cursor_valid(jsonb_build_object('page','https://www.wired-gov.net/wg/home.nsf/nav/latest+news?id=BDEX-6ZFKSH&open='),'ico') then raise exception 'ICO WiredGov listing cursor failed'; end if;
 if not private.collector_cloud_cursor_valid(jsonb_build_object('page','https://www.info.gov.hk/gia/general/202611/09.htm'),'hk-pcpd') then raise exception 'PCPD archive cursor failed'; end if;
 if not private.collector_cloud_cursor_valid(jsonb_build_object('page','https://www.consilium.europa.eu/en/rss/pressreleases.ashx'),'eu-council') then raise exception 'Council RSS cursor failed'; end if;
 if not private.collector_cloud_frozen_cursor_valid(jsonb_build_object('page','https://www.priv.gc.ca/en/about-the-opc/what-we-do/international-privacy-networks/news-announcement-ic/?o=d&Page=2&Filter=True','offset',0,'frozen_urls',jsonb_build_array('https://www.priv.gc.ca/en/opc-news/speeches-and-statements/2026/communique-g7-260626'),'frozen_next','https://www.priv.gc.ca/en/about-the-opc/what-we-do/international-privacy-networks/news-announcement-ic/?o=d&Page=3&Filter=True'),'g7-dpa') then raise exception 'G7 frozen route failed for observed query order and filter'; end if;
 if not private.collector_cloud_frozen_cursor_valid(jsonb_build_object('page','https://en.baochinhphu.vn/timelinelist/11151/2.htm','offset',0,'frozen_urls',jsonb_build_array('https://en.baochinhphu.vn/new-policies-take-effect-in-viet-nam-in-november-2026-111261102100407268.htm'),'frozen_next','https://en.baochinhphu.vn/timelinelist/11151/3.htm'),'vn-gov') then raise exception 'Vietnam frozen route failed'; end if;
 if not private.collector_cloud_frozen_cursor_valid(jsonb_build_object('page','https://www.wired-gov.net/wg/home.nsf/nav/latest+news?id=BDEX-6ZFKSH&open=','offset',0,'frozen_urls',jsonb_build_array('https://www.wired-gov.net/wg/news.nsf/articles/Solar+firm+made+almost+500+nuisance+calls+every+day+for+a+year+05112026152000?open='),'frozen_next',null),'ico') then raise exception 'ICO frozen route failed'; end if;
 if not exists(select 1 from public.collector_cloud_routes where source_id='0db916d5-a210-4bd8-b5f3-97571fdd1e60' and enabled) then raise exception 'JPDP route was not enabled'; end if;
 if not exists(select 1 from public.collector_cloud_routes where source_id='ed10f3a1-4d0d-4409-9ae4-7d320ae92abc' and enabled) then raise exception 'CBPR route was not enabled'; end if;
 if not exists(select 1 from public.collector_cloud_routes where source_id='3fd924b0-3a38-4ba6-b9b2-5154ecca3a39' and enabled) then raise exception 'ISO route was not enabled'; end if;
 if not exists(select 1 from public.collector_cloud_routes where source_id='d7c96a28-2fca-49ad-a631-3a62cf0a03b9' and not enabled and range_start=(now() at time zone 'Asia/Seoul')::date-2) then raise exception 'ICO route hold/range was not retained'; end if;
 if not exists(select 1 from public.collector_cloud_routes where source_id='d4d64477-c45b-5f10-883d-374a7cd0ddfe' and not enabled) then raise exception 'PCPD route hold was not retained'; end if;
 if not exists(select 1 from public.collector_cloud_routes where source_id='f4dc010a-0c02-5b24-8799-bd64f20b2e25' and not enabled) then raise exception 'Council route hold was not retained'; end if;
 if not exists(select 1 from public.collector_cloud_routes where source_id='c1c51983-486c-4a6e-98ef-43eaaee88d5a' and not enabled and range_start=(now() at time zone 'Asia/Seoul')::date-6) then raise exception 'G7 weekly route hold/range was not retained'; end if;
 if not exists(select 1 from public.collector_cloud_routes where source_id='9e9815e2-2028-4384-a5e5-6ebd1f2e2f55' and not enabled) then raise exception 'Vietnam route hold was not retained'; end if;
 if exists(select 1 from public.sources where id in ('d7c96a28-2fca-49ad-a631-3a62cf0a03b9','d4d64477-c45b-5f10-883d-374a7cd0ddfe','f4dc010a-0c02-5b24-8799-bd64f20b2e25','c1c51983-486c-4a6e-98ef-43eaaee88d5a','9e9815e2-2028-4384-a5e5-6ebd1f2e2f55') and (is_active or terms_reviewed_at is not null)) then raise exception 'unreviewed source was activated or received a synthetic terms timestamp'; end if;
 if (public.collector_writing_policy()->'instruction_hashes'->>'docs/trend-report-style.md') <> 'b9c46b82180f584e4ffee3c2b9a4e36ef1e16d2c34ad326e3d3fef4c4a7f7d03'
  or (public.collector_writing_policy()->'instruction_hashes'->>'docs/trend-reference-reading-notes.md') <> '52b75c5c25517a7f1b93aef462e829fe50d8eb07c17bf864d879f8fe03823599'
  or (public.collector_writing_policy()->'instruction_hashes'->>'docs/translation/glossary.md') <> '2441ae7c18d2f5e4e0e906587512ebb6211b6b42b5e02a81bbc5179f684f6d78' then raise exception 'writing policy document hash mismatch'; end if;
end $$;
