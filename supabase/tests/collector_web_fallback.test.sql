begin;
select plan(24);
update public.collector_edge_control set enabled=true where singleton;
select is((select count(*)::integer from public.sources where parser_config->>'collector_executor'='chatgpt-web' and is_active),0,'no web route is active without a completed source review');
select is((select count(*)::integer from public.sources s left join public.collector_edge_sources e on e.source_id=s.id left join public.collector_cloud_routes r on r.source_id=s.id where (e.slug in ('hk-pcpd','eu-council','eur-lex') or s.id='430bd32d-19b1-4752-8280-7b2d2acbda88'::uuid) and not s.is_active and not coalesce(r.enabled,false)),4,'PCPD, Council, EUR-Lex and FTC remain inactive with disabled cloud routes');
select is((select count(*)::integer from public.sources s left join public.collector_edge_sources e on e.source_id=s.id where ((e.slug in ('hk-pcpd','eu-council') or s.id='430bd32d-19b1-4752-8280-7b2d2acbda88'::uuid) and s.parser_config->>'collector_executor'='hold' and s.terms_reviewed_at is null) or (e.slug='eur-lex' and s.parser_config->>'collector_executor'='chatgpt-web' and s.is_active=false)),4,'executor hold remains explicit for three sources and EUR-Lex web executor remains inactive');
select public.collector_edge_enqueue('held-source-test');
select is((select count(*)::integer from pgmq.q_trend_collect q where (q.message->>'source_id')::uuid='430bd32d-19b1-4752-8280-7b2d2acbda88'::uuid or (q.message->>'source_id')::uuid in (select e.source_id from public.collector_edge_sources e where e.slug in ('hk-pcpd','eu-council','eur-lex'))),0,'held sources do not enter the collector queue');
select is((select count(*)::integer from public.sources s join public.collector_edge_sources e on e.source_id=s.id join public.collector_cloud_routes r on r.source_id=s.id where e.slug='edps' and s.is_active and s.source_kind='rss' and s.start_url='https://social.edps.europa.eu/@EDPS.rss' and s.parser_config->>'collector_executor'='cloud-python' and r.enabled),1,'EDPS runs through its active Mastodon RSS cloud route');
select ok(not has_function_privilege('anon','public.collector_web_ingest(text,jsonb,text)','EXECUTE') and not has_function_privilege('authenticated','public.collector_web_ingest(text,jsonb,text)','EXECUTE'),'web ingest is private');
select ok(not has_function_privilege('anon','public.collector_web_record_attempt(text,date,date,jsonb,text)','EXECUTE'),'web event recording is private');
select ok(position('chatgpt-web' in pg_get_functiondef('public.collector_edge_enqueue(text)'::regprocedure))>0,'Edge enqueue excludes web sources');
select ok(position('chatgpt-web' in pg_get_functiondef('public.collector_edge_take()'::regprocedure))>0,'Edge take excludes web sources');
select throws_ok($$select public.collector_web_ingest('eu-council','{"since":"2026-10-27","until":"2026-10-29","published_date":"2026-10-28","url":"https://evil.example/a"}', 'web-test')$$,'P0002',null,'held Council is unavailable to web ingestion');
select throws_ok($$select public.collector_web_ingest('eur-lex','{"since":"2026-10-27","until":"2026-10-29","published_date":"2026-10-28","url":"https://eur-lex.europa.eu/legal-content/EN/TXT/"}', 'web-test')$$,'P0001','source approval or capacity gate failed','inactive EUR-Lex is rejected by the approval gate');
select throws_ok($$select public.collector_web_ingest('edps','{"since":"2026-10-27","until":"2026-10-29","published_date":"2026-10-28","url":"https://www.edps.europa.eu/press-publications/press-news/news/2026/test","read_scope":"official_rss_notice"}', 'web-test')$$,'P0002',null,'EDPS cloud route is excluded from web ingestion');
select throws_ok($$select public.collector_web_record_attempt('edps','2026-10-27','2026-10-29','{"status":"success","coverage_complete":true}', 'web-test')$$,'22023','bounded web attempt required','attempt cannot claim successful full coverage');
-- Exercise the web adapter with transaction-local approval state. The production
-- migration above remains held, and the test transaction rolls this fixture back.
update public.publishers set is_active=true where id=(select publisher_id from public.sources s join public.collector_edge_sources e on e.source_id=s.id where e.slug='eu-council');
update public.sources s set is_active=true,terms_reviewed_at=now(),parser_config=s.parser_config||jsonb_build_object('collector_executor','chatgpt-web')
 where s.id=(select e.source_id from public.collector_edge_sources e where e.slug='eu-council');
update public.publishers set is_active=true where id=(select publisher_id from public.sources s join public.collector_edge_sources e on e.source_id=s.id where e.slug='hk-pcpd');
update public.sources s set is_active=true,terms_reviewed_at=now(),parser_config=s.parser_config||jsonb_build_object('collector_executor','chatgpt-web')
 where s.id=(select e.source_id from public.collector_edge_sources e where e.slug='hk-pcpd');
select throws_ok($$select public.collector_web_ingest('eu-council','{"since":"2026-10-27","until":"2026-10-29","published_date":"2026-10-28","url":"https://evil.example/a"}', 'web-test')$$,'22023','canonical official article path required','external host rejected after test-only approval');
select lives_ok($$select public.collector_web_record_attempt('eu-council','2026-10-27','2026-10-29','{"status":"blocked","reason":"full body inaccessible","coverage_complete":true}', 'web-test-event')$$,'blocked result can be persisted for an approved test fixture');
select ok((select result->'coverage_complete'='false'::jsonb and result->>'status'='blocked' from public.collector_edge_events where execution_id='web-test-event'),'coverage forced false without hiding failure');
create temporary table web_valid_document as select jsonb_build_object('since','2026-10-27','until','2026-10-29',
 'published_date','2026-10-28','url','https://www.consilium.europa.eu/en/press/press-releases/2026/10/28/web-test/',
 'title','Synthetic test of CAPTCHA privacy policy','body',repeat('The Council is explaining privacy safeguards and CAPTCHA accessibility. ',5),
 'read_scope','official_full_article','evidence',jsonb_build_object('method','web_open','ref','synthetic-test',
 'publication_locator','test header','body_locator','test article','complete_body',true,'accessed_at',now())) d;
select lives_ok($$select public.collector_web_ingest('eu-council',(select d from web_valid_document),'web-test-full')$$,'complete article ingests; CAPTCHA topic is not a challenge');
select ok(exists(select 1 from public.source_items where canonical_url='https://www.consilium.europa.eu/en/press/press-releases/2026/10/28/web-test/'),'existing ingest stores verified article');
select lives_ok($$select public.collector_web_ingest('eu-council',(select d from web_valid_document),'web-test-duplicate')$$,'duplicate official article uses existing deduplication');
select is((select count(*)::integer from public.source_items where canonical_url='https://www.consilium.europa.eu/en/press/press-releases/2026/10/28/web-test/'),1,'repeated web ingestion does not duplicate item');
select throws_ok($$select public.collector_web_ingest('hk-pcpd',(select jsonb_set(d,'{url}','"https://www.info.gov.hk/gia/general/202610/28/P2026102800001.htm"') from web_valid_document),'web-test-wrong-issuer')$$,'22023','PCPD issuer evidence required','unrelated government article cannot be attributed to PCPD');
create temporary table web_queue_baseline as select count(*) n from pgmq.q_trend_collect q join public.sources s on s.id=(q.message->>'source_id')::uuid where s.parser_config->>'collector_executor'='chatgpt-web';
select public.collector_edge_enqueue('web-routing-test');
select is((select count(*) from pgmq.q_trend_collect q join public.sources s on s.id=(q.message->>'source_id')::uuid where s.parser_config->>'collector_executor'='chatgpt-web'),(select n from web_queue_baseline),'enqueue adds no web-source messages');
create temporary table injected_web_message as select pgmq.send('trend_collect',jsonb_build_object('source_id','2239debc-9ce2-5cfd-99f3-c555b7cd0c94','kind','web-routing-test')) msg_id;
select ok(coalesce(public.collector_edge_take()->>'slug','') not in ('edps','hk-pcpd','eu-council','eur-lex'),'actual Edge take cannot consume web source');
select ok(exists(select 1 from pgmq.q_trend_collect where msg_id=(select msg_id from injected_web_message)),'preexisting web message is preserved without being consumed');
select * from finish();
rollback;
