begin;
set local search_path = public, extensions;
select plan(21);
select has_function('public','claim_trend_draft_jobs',array['text','integer'],'claim function exists');
select ok(not has_function_privilege('anon','public.claim_trend_draft_jobs(text,integer)','execute'),'anonymous cannot claim');
select ok(not has_function_privilege('authenticated','public.submit_trend_draft(uuid,text,jsonb)','execute'),'team browser cannot submit as worker');
select ok((select relrowsecurity from pg_class where oid='public.collector_runs'::regclass),'run log uses RLS');

create temporary table test_context (job uuid, item uuid, revision uuid, report uuid);
update public.sources set terms_reviewed_at=now() where name='EDPB 뉴스·보도자료';
insert into test_context(job,item,revision)
select draft_job_id,source_item_id,source_item_revision_id from public.ingest_source_item(
 (select id from public.sources where name='EDPB 뉴스·보도자료'),null,'https://www.edpb.europa.eu/test-collector',
 'Original title','2026-10-07',null,now(),'en','news',
 'The board published final guidelines on personal data. The consultation closes on 20 November 2026.',
 repeat('c',64),null,'{"ai_ready":true}'::jsonb,'trend-ko-v1');
select is(jsonb_array_length(public.claim_trend_draft_jobs('worker-one',1)),1,'worker claims one job');
select is(jsonb_array_length(public.claim_trend_draft_jobs('worker-two',1)),0,'second worker cannot take held lease');
select throws_ok(format('select public.submit_trend_draft(%L::uuid,%L,%L::jsonb)',(select job from test_context),'worker-two','{}'),
 '42501','Active job lease is required','different worker cannot submit');
update public.draft_jobs set lease_until=now()-interval '1 minute' where id=(select job from test_context);
select is(jsonb_array_length(public.claim_trend_draft_jobs('worker-two',1)),1,'expired lease is reclaimed');
select is((select attempts from public.draft_jobs where id=(select job from test_context)),2,'reclaim increments attempts');

create temporary table test_payload as select '{"title_ko":"개인정보 지침 발표","summary_ko":"위원회가 지침을 발표했습니다. 의견 제출 기한은 원문을 다시 확인해야 합니다.","details_ko":"위원회가 개인정보에 관한 최종 지침을 발표했다고 설명했습니다.","key_points":[{"text":"최종 지침 발표","evidence_index":0}],"policy_implications_ko":"작성자 해석: 지침 적용 범위를 확인해야 합니다.","jurisdictions":["EU"],"topics":["guidance"],"evidence":[{"quote":"The board published final guidelines on personal data.","locator":"본문 첫 문장","claim":"최종 지침 발표"}],"limitations":["연결 지침 전문 미열람"]}'::jsonb as draft;
update public.sources set terms_reviewed_at=null where name='EDPB 뉴스·보도자료';
select throws_ok(format('select public.submit_trend_draft(%L::uuid,%L,%L::jsonb)',(select job from test_context),'worker-two',(select draft::text from test_payload)),
 '42501','Source approval was revoked','revoked terms approval blocks active lease submission');
update public.sources set terms_reviewed_at=now() where name='EDPB 뉴스·보도자료';
select throws_ok(format('select public.submit_trend_draft(%L::uuid,%L,%L::jsonb)',(select job from test_context),'worker-two',
 (select jsonb_set(draft,'{key_points}','[null]')::text from test_payload)),
 '22023','Invalid key point or evidence index','null key point cannot crash the review screen');
select throws_ok(format('select public.submit_trend_draft(%L::uuid,%L,%L::jsonb)',(select job from test_context),'worker-two',
 (select jsonb_set(draft,'{evidence,0,quote}','"Invented unsupported evidence text"')::text from test_payload)),
 '22023','Evidence quote is missing from the exact revision','unfounded evidence is rejected');
select lives_ok(format('select public.submit_trend_draft(%L::uuid,%L,%L::jsonb)',(select job from test_context),'worker-two',(select draft::text from test_payload)),
 'exact evidence allows draft submission');
select results_eq('select status,human_reviewed from public.reports where source_item_id=(select item from test_context)',
 $$values ('draft'::text,false)$$,'automatic draft remains unpublished and human unreviewed');
select throws_ok(format('select public.submit_trend_draft(%L::uuid,%L,%L::jsonb)',(select job from test_context),'worker-two',(select draft::text from test_payload)),
 '42501','Active job lease is required','duplicate submit is rejected');

-- A changed body creates a second exact revision; the existing report must survive.
select public.ingest_source_item((select id from public.sources where name='EDPB 뉴스·보도자료'),null,
 'https://www.edpb.europa.eu/test-collector','Original title','2026-10-07',null,now(),'en','news',
 'The board published final guidelines on personal data. Updated later.',repeat('d',64),null,'{"ai_ready":true}'::jsonb,'trend-ko-v1');
select public.claim_trend_draft_jobs('worker-three',1);
select lives_ok(format('select public.submit_trend_draft(%L::uuid,%L,%L::jsonb)',
 (select id from public.draft_jobs where input_hash=repeat('d',64)),'worker-three',(select draft::text from test_payload)),
 'existing report moves proposed update to human review');
select is((select title_ko from public.reports where source_item_id=(select item from test_context)),
 '개인정보 지침 발표','existing report is never overwritten by automatic update');
select is((select status from public.draft_jobs where input_hash=repeat('d',64)),
 'needs_human_review','new revision remains waiting for human review');
select public.ingest_source_item((select id from public.sources where name='EDPB 뉴스·보도자료'),null,
 'https://www.edpb.europa.eu/test-stale','Stale input',null,null,now(),'en','news',
 'The board published final guidelines on personal data.',repeat('e',64),null,'{"ai_ready":true}'::jsonb,'trend-ko-v1');
select public.claim_trend_draft_jobs('stale-worker',1);
update public.source_items set current_revision_id=null where canonical_url='https://www.edpb.europa.eu/test-stale';
select is((public.submit_trend_draft((select id from public.draft_jobs where input_hash=repeat('e',64)),
 'stale-worker',(select draft from test_payload))->>'status'),'superseded','old revision is rejected without touching reports');
select ok(not has_function_privilege('anon','public.get_trend_collector_review()','execute'),'anonymous cannot inspect drafts or exact source bodies');
select ok(not (select prosecdef from pg_proc where oid='public.get_trend_collector_review()'::regprocedure),'public review entrypoint does not elevate caller privileges');
select * from finish();
rollback;
