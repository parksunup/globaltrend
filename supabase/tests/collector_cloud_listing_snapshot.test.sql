begin;
set local search_path=public,extensions;
select plan(13);

-- The migration's fixed production registry UUIDs are not present in the
-- synthetic local seed catalog. Add one transaction-local FTC source so these
-- table constraints are exercised independently of production IDs.
insert into public.publishers(name,acronym,publisher_type,website_url,description_ko)
select 'FTC snapshot test publisher','FTC-SNAPSHOT-TEST','international_org',
 'https://www.ftc.gov/','Synthetic fixture for durable listing snapshot tests'
where not exists(select 1 from public.publishers where acronym='FTC-SNAPSHOT-TEST');
insert into public.sources(publisher_id,name,source_kind,fetch_strategy,start_url,parser_config,poll_interval_minutes,next_run_at)
select p.id,'FTC snapshot test source','html','http',
 'https://www.ftc.gov/feeds/press-release-consumer-protection.xml','{}'::jsonb,1440,now()
from public.publishers p
where p.acronym='FTC-SNAPSHOT-TEST'
and not exists(select 1 from public.sources where name='FTC snapshot test source');
insert into public.collector_edge_sources(source_id,slug)
select s.id,'ftc' from public.sources s
where s.name='FTC snapshot test source'
and not exists(select 1 from public.collector_edge_sources where slug='ftc');

select has_table('public','collector_cloud_listing_scans','staged FTC scan table exists');
select has_table('public','collector_cloud_listing_rows','ordered FTC rows exist');
select ok((select relrowsecurity from pg_class where oid='public.collector_cloud_listing_scans'::regclass),
 'FTC scan table has row-level security');
select ok((select relrowsecurity from pg_class where oid='public.collector_cloud_listing_rows'::regclass),
 'FTC row table has row-level security');
select ok(not has_table_privilege('service_role','public.collector_cloud_listing_scans','select'),
 'service role uses the RPC instead of direct snapshot reads');
select ok(not has_table_privilege('authenticated','public.collector_cloud_listing_rows','select'),
 'signed-in users cannot read staged feed data');
select has_function('public','collector_cloud_take',array['text','text'],
 'take RPC exposes durable snapshot claims');
select has_function('public','collector_cloud_commit',array['uuid','text','uuid','jsonb','text'],
 'commit RPC atomically stages rows and cursor progress');

-- Cursor validation must preserve every discovered identity, even beyond the
-- former 50-entry and 4 KB limits.
select ok(private.collector_cloud_cursor_valid(
 jsonb_build_object('page','https://www.ftc.gov/feeds/press-release-consumer-protection.xml',
  'offset',1000000,'fingerprint',repeat('a',64),'processed_url_hashes',
  (select jsonb_agg(lpad(to_hex(i),64,'0')) from generate_series(1,150) i)), 'ftc'),
 'cursor with 150 hashes, a million-page offset and more than four kilobytes remains valid');

select lives_ok($$
 insert into public.collector_cloud_listing_scans(id,source_id,listing_url,fingerprint,row_count,status,completed_at)
 select 'f9d7e4dd-b013-4c75-9331-ecf7b9f1b930',source_id,'https://www.ftc.gov/feeds/press-release-consumer-protection.xml',repeat('a',64),101,'completed',now()
 from public.collector_edge_sources where slug='ftc'
$$,'snapshot with more than one hundred discovered rows is accepted');

select lives_ok($$
 insert into public.collector_cloud_listing_rows(source_id,scan_id,ordinal,canonical_url,url_hash,row_data)
 select source_id,'f9d7e4dd-b013-4c75-9331-ecf7b9f1b930',100,
  'https://www.ftc.gov/press-release/'||repeat('a',2050),repeat('b',64),
  jsonb_build_object('url','https://www.ftc.gov/press-release/'||repeat('a',2050),
   'title',repeat('x',6000),'date_observations',jsonb_build_array(1,2,3,4,5,6))
 from public.collector_edge_sources where slug='ftc'
$$,'large listing identity, title and observation list are stored without arbitrary ceilings');

select ok(private.collector_cloud_frozen_cursor_valid(
 jsonb_build_object('page','https://ec.europa.eu/commission/presscorner/api/search?pagesize=10',
  'offset',0,'frozen_next',null,'frozen_urls',
  (select jsonb_agg(case when i=1 then 'https://ec.europa.eu/commission/presscorner/detail/en/ip_26_'||repeat('1',2050)
    else 'https://ec.europa.eu/commission/presscorner/detail/en/ip_26_'||i::text end)
   from generate_series(1,101) i)), 'ec'),
 'frozen discovery cursor accepts 101 identities and long official URL paths');

insert into public.collector_cloud_listing_scans(id,source_id,listing_url,fingerprint,row_count,status,completed_at)
select 'a9d7e4dd-b013-4c75-9331-ecf7b9f1b930',source_id,
 'https://www.ftc.gov/feeds/press-release-consumer-protection.xml',repeat('a',64),1,'completed',now()
from public.collector_edge_sources where slug='ftc';
select throws_ok($$
 insert into public.collector_cloud_listing_rows(source_id,scan_id,ordinal,canonical_url,url_hash,row_data)
 select source_id,'a9d7e4dd-b013-4c75-9331-ecf7b9f1b930',0,
  'https://www.ftc.gov.evil.test/press-release',repeat('b',64),
  jsonb_build_object('url','https://www.ftc.gov.evil.test/press-release','title','Not FTC','date_observations','[]'::jsonb)
 from public.collector_edge_sources where slug='ftc'
$$,'23514',null,'snapshot cannot persist a lookalike host');

select * from finish();
rollback;
