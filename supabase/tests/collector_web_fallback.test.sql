begin;
select plan(19);
update public.collector_edge_control set enabled=true where singleton;
select is((select count(*)::integer from public.sources where parser_config->>'collector_executor'='chatgpt-web' and is_active),4,'four scheduled web attempts');
select ok(not has_function_privilege('anon','public.collector_web_ingest(text,jsonb,text)','EXECUTE') and not has_function_privilege('authenticated','public.collector_web_ingest(text,jsonb,text)','EXECUTE'),'web ingest is private');
select ok(not has_function_privilege('anon','public.collector_web_record_attempt(text,date,date,jsonb,text)','EXECUTE'),'web event recording is private');
select ok(position('chatgpt-web' in pg_get_functiondef('public.collector_edge_enqueue(text)'::regprocedure))>0,'Edge enqueue excludes web sources');
select ok(position('chatgpt-web' in pg_get_functiondef('public.collector_edge_take()'::regprocedure))>0,'Edge take excludes web sources');
select throws_ok($$select public.collector_web_ingest('eu-council','{"since":"2026-10-27","until":"2026-10-29","published_date":"2026-10-28","url":"https://evil.example/a"}', 'web-test')$$,'22023','canonical official article path required','external host rejected');
select throws_ok($$select public.collector_web_ingest('eur-lex','{"since":"2026-10-27","until":"2026-10-29","published_date":"2026-10-28","url":"https://eur-lex.europa.eu/legal-content/EN/TXT/"}', 'web-test')$$,'22023','canonical official article path required','law full texts rejected');
select throws_ok($$select public.collector_web_ingest('edps','{"since":"2026-10-27","until":"2026-10-29","published_date":"2026-10-28","url":"https://www.edps.europa.eu/press-publications/press-news/news/2026/test","read_scope":"official_rss_notice"}', 'web-test')$$,'22023','full official article evidence required; RSS discovery and snippets cannot be ingested','RSS discovery cannot masquerade as full article');
select throws_ok($$select public.collector_web_record_attempt('edps','2026-10-27','2026-10-29','{"status":"success","coverage_complete":true}', 'web-test')$$,'22023','bounded web attempt required','attempt cannot claim successful full coverage');
select lives_ok($$select public.collector_web_record_attempt('edps','2026-10-27','2026-10-29','{"status":"blocked","reason":"full body inaccessible","coverage_complete":true}', 'web-test-event')$$,'blocked result can be persisted');
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
