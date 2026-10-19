begin;
select no_plan();
insert into auth.users(id,email) values
 ('49000000-0000-0000-0000-000000000001','workspace-editor@example.test'),
 ('49000000-0000-0000-0000-000000000002','workspace-admin@example.test'),
 ('49000000-0000-0000-0000-000000000003','workspace-visitor@example.test');
insert into public.team_memberships(user_id,role) values
 ('49000000-0000-0000-0000-000000000001','editor'),('49000000-0000-0000-0000-000000000002','admin');
insert into public.source_items(id,source_id,canonical_url,title_original,document_type)
 select '49000000-0000-0000-0000-000000000010',id,'https://example.test/workspace-lifecycle','Original lifecycle source','news'
 from public.sources order by created_at limit 1;
insert into public.reports(id,source_item_id,title_ko,one_line_summary_ko,detailed_summary_ko,jurisdictions,topics)
 values('49000000-0000-0000-0000-000000000011','49000000-0000-0000-0000-000000000010','기존 공개 제목','기존 요약','기존 공개 본문',array['KR'],array['privacy']);
insert into public.legal_instruments(id,jurisdiction_code,short_name,official_name)
 values('49000000-0000-0000-0000-000000000020','KR','Lifecycle PIPA','Lifecycle law');
create temporary table workspace_law_payload as select jsonb_build_object(
 'recordId','lifecycle-pipa','jurisdiction','KR','contentHash',repeat('4',64),'versionLabel','Lifecycle 1',
 'availability','translation','instrument',jsonb_build_object('id','legal-lifecycle-pipa','title','Lifecycle PIPA','links',jsonb_build_array(jsonb_build_object('url','https://example.test/workspace-law'))),
 'document',jsonb_build_object('id','lifecycle-pipa','sections',jsonb_build_array(jsonb_build_object('id','main-a1','title','제1조','group','main','lines',jsonb_build_array(jsonb_build_object('id','main-a1-p1','text','기존 법률 본문'))))),
 'cells',jsonb_agg(jsonb_build_object('criterionId',criterion_key,'jurisdiction','KR','summary','기존 비교 요약','translationLinks',jsonb_build_array('/law#main-a1')))
) payload from public.criteria where criteria_set_id=(select id from public.criteria_sets where name='한국·일본 개인정보 보호법 비교 기준' and version=1);
create temporary table workspace_law_id(id uuid);
grant select on workspace_law_payload to authenticated;
grant select,insert on workspace_law_id to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000001',true);
insert into workspace_law_id select public.import_legal_review((select payload from workspace_law_payload));
select is((select revision from public.publication_working_copies where entity_id='49000000-0000-0000-0000-000000000011'),1::bigint,'new report receives its first working revision');
select is((select revision from public.publication_working_copies where entity_id=(select id from workspace_law_id)),1::bigint,'legal import receives its first working revision');
select throws_ok($$select public.publish_publication_draft('report','49000000-0000-0000-0000-000000000011',1)$$,'42501','Active administrator is required','editor cannot publish');
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000002',true);
select is(public.publish_publication_draft('report','49000000-0000-0000-0000-000000000011',1)->>'status','published','administrator publishes report in one action');
select is(public.publish_publication_draft('law',(select id from workspace_law_id),1)->>'status','published','administrator publishes complete legal package in one action');
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000001',true);
select throws_ok($$update public.reports set detailed_summary_ko='우회 수정' where id='49000000-0000-0000-0000-000000000011'$$,'42501','Use the publication workspace to preserve the public version','editor cannot mutate live report through the Data API');
select throws_ok($$update public.law_versions set review_payload='{}' where id=(select id from workspace_law_id)$$,'42501','Use the publication workspace to preserve the public version','editor cannot mutate live legal snapshot');
select throws_ok($$delete from public.reports where id='49000000-0000-0000-0000-000000000011'$$,'42501','Use the publication workspace to preserve the public version','physical deletion cannot bypass recoverable trash');
select throws_ok($$update public.source_items set canonical_url='https://example.test/bypass' where id='49000000-0000-0000-0000-000000000010'$$,'42501','Use the publication workspace to preserve the public version','published source identity is preserved');
select is(public.save_publication_draft('report','49000000-0000-0000-0000-000000000011',2,
 jsonb_build_object('title_ko','수정 제목','one_line_summary_ko','수정 요약','detailed_summary_ko','수정 본문','jurisdictions',jsonb_build_array('KR'),'topics',jsonb_build_array('privacy')))->>'revision','3','editor saves a separate report revision');
select is((select detailed_summary_ko from public.reports where id='49000000-0000-0000-0000-000000000011'),'기존 공개 본문','saving a correction leaves the public report unchanged');
select throws_ok($$select public.save_publication_draft('report','49000000-0000-0000-0000-000000000011',2,'{}')$$,'40001','Publication draft changed; reload before retrying','stale editor cannot overwrite a newer saved revision');
select throws_ok($$select public.unpublish_publication('report','49000000-0000-0000-0000-000000000011',3)$$,'42501','Active administrator is required','editor cannot unpublish');
select throws_ok($$select public.trash_publication_draft('report','49000000-0000-0000-0000-000000000011',3)$$,'22023','Unpublish this material before moving it to the trash','even an editable public report must be unpublished before trash');
select is(public.request_publication_draft('report','49000000-0000-0000-0000-000000000011',3)->>'revision','4','editor can request publication of its correction');
select is(public.save_publication_draft('law',(select id from workspace_law_id),2,
 jsonb_set(jsonb_set(jsonb_set((select payload from workspace_law_payload),'{document,sections,0,lines,0,text}','"수정 법률 본문"'),'{cells,0,summary}','"수정 비교 요약"'),'{contentHash}',to_jsonb(repeat('5',64))))->>'revision','3','editor saves legal text and comparison together');
select is((select review_payload#>>'{document,sections,0,lines,0,text}' from public.law_versions where id=(select id from workspace_law_id)),'기존 법률 본문','saving legal correction does not change the public text');
select is((select count(*) from public.comparison_cells where law_version_id=(select id from workspace_law_id) and status='published'),17::bigint,'all original comparison cells remain public before publication');
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000002',true);
select is(public.publish_publication_draft('report','49000000-0000-0000-0000-000000000011',4)->>'revision','5','administrator publishes exactly the requested correction');
select is(public.publish_publication_draft('report','49000000-0000-0000-0000-000000000011',4)->>'revision','5','repeat click does not create a new publication');
select is(public.publish_publication_draft('law',(select id from workspace_law_id),3)->>'revision','4','administrator publishes the legal correction atomically');
select is((select review_payload#>>'{document,sections,0,lines,0,text}' from public.law_versions where id=(select id from workspace_law_id)),'수정 법률 본문','legal public snapshot contains corrected text');
select is((select translation_ko from public.provision_nodes where law_version_id=(select id from workspace_law_id) and node_key='main-a1-p1'),'수정 법률 본문','normalized provision text changes with its snapshot');
select is((select count(*) from public.comparison_cells where law_version_id=(select id from workspace_law_id) and status='published'),17::bigint,'legal replacement retains all 17 published comparison cells');
select is((select summary_ko from public.comparison_cells c join public.criteria cr on cr.id=c.criterion_id where c.law_version_id=(select id from workspace_law_id) and cr.criterion_key=(select payload#>>'{cells,0,criterionId}' from workspace_law_payload)),'수정 비교 요약','comparison update is committed with the text');
select is(public.unpublish_publication('report','49000000-0000-0000-0000-000000000011',5)->>'revision','6','administrator unpublishes without deleting');
select is(public.unpublish_publication('law',(select id from workspace_law_id),4)->>'revision','5','administrator unpublishes legal snapshot');
set local role anon;
select is_empty($$select id from public.reports where id='49000000-0000-0000-0000-000000000011'$$,'unpublished report is hidden from anonymous readers');
select is_empty($$select id from public.law_versions where content_hash=repeat('5',64)$$,'unpublished law is hidden from anonymous readers');
select throws_ok($$select * from public.publication_working_copies$$,'42501',null,'anonymous readers cannot inspect working payloads');
select ok(not has_function_privilege('anon','public.save_publication_draft(text,uuid,bigint,jsonb)','execute'),'anonymous cannot invoke workspace writes');
set local role authenticated;
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000001',true);
select is(public.trash_publication_draft('report','49000000-0000-0000-0000-000000000011',6)->>'revision','7','editor can trash an unpublished report');
select is(public.trash_publication_draft('law',(select id from workspace_law_id),5)->>'revision','6','editor can trash an unpublished law');
select throws_ok($$select public.save_publication_draft('report','49000000-0000-0000-0000-000000000011',7,'{}')$$,'22023','Restore this material from the trash first','trashed material must be restored before saving');
select is(public.restore_publication_draft('report','49000000-0000-0000-0000-000000000011',7)->>'revision','8','editor restores report with content retained');
select is(public.restore_publication_draft('law',(select id from workspace_law_id),6)->>'revision','7','editor restores law with content retained');
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000002',true);
select is(public.publish_publication_draft('report','49000000-0000-0000-0000-000000000011',8)->>'status','published','restored report can be republished');
select is(public.publish_publication_draft('law',(select id from workspace_law_id),7)->>'status','published','restored legal snapshot can be republished');
select throws_ok($$select public.save_publication_draft('law',(select id from workspace_law_id),8,jsonb_set((select payload from workspace_law_payload),'{cells}','[]'))$$,'22023','Exactly 17 matching legal criteria are required','invalid legal edit fails before replacing any public data');
select is((select count(*) from public.comparison_cells where law_version_id=(select id from workspace_law_id)),17::bigint,'invalid edit and retries never duplicate or remove comparison cells');
select throws_ok($$select public.save_publication_draft('law',(select id from workspace_law_id),8,jsonb_set((select payload from workspace_law_payload),'{cells,0,summary}','""'))$$,'22023','Exactly 17 matching legal criteria are required','empty comparison text is rejected without replacing a publication');
select throws_ok($$select public.save_publication_draft('law',(select id from workspace_law_id),8,jsonb_set((select payload from workspace_law_payload),'{document,sections,0,lines,0,text}','""'))$$,'22023','Invalid legal text','empty translated text is rejected without replacing a publication');
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000003',true);
select is_empty($$select * from public.publication_working_copies$$,'ordinary authenticated visitors cannot see working drafts');
select throws_ok($$select public.restore_publication_draft('report','49000000-0000-0000-0000-000000000011',9)$$,'42501','Active editor is required','ordinary authenticated visitors cannot restore or edit');
reset role;
select ok(exists(select 1 from public.review_events where entity_id='49000000-0000-0000-0000-000000000011' and action='previous_publication_preserved' and note like '%기존 공개 본문%'),'previous public report body is retained in internal audit');
select ok(not has_column_privilege('anon','public.reports','reviewed_by','select') and not has_column_privilege('authenticated','public.reports','reviewed_by','select'),'reviewer identities remain private');
select * from finish();
rollback;
