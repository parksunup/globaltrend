begin;
select plan(8);
select ok(has_function_privilege('anon','public.get_trend_catalog(integer,integer,uuid)','execute'),'catalog metadata is publicly searchable');
select ok(not has_function_privilege('anon','public.save_written_weekly_draft(text,text,date,date,jsonb)','execute'),'anonymous cannot select issue articles');
select ok(not has_function_privilege('anon','public.publish_written_weekly_issue(text)','execute'),'anonymous cannot publish');
select ok(has_function_privilege('service_role','public.save_written_weekly_draft(text,text,date,date,jsonb)','execute'),'scheduled editor can save a draft');
select ok(not has_function_privilege('service_role','public.publish_written_weekly_issue(text)','execute'),'producer has no automatic publication grant');
select is((select count(*)::integer from get_trend_catalog(0,200)),least(200,(select count(*)::integer from source_items i join sources s on s.id=i.source_id where s.is_active and s.terms_reviewed_at is not null and exists(select 1 from reports r where r.source_item_id=i.id and r.status = 'published' and nullif(btrim(r.title_ko),'') is not null and nullif(btrim(r.one_line_summary_ko),'') is not null and nullif(btrim(r.detailed_summary_ko),'') is not null))),'public catalog contains only published Korean reports');
select ok(not exists(select 1 from get_trend_catalog(0,200) where editorial_status <> 'published' or report_id is null),'no unreviewed report enters public catalog');
create temporary table undated_weekly_fixture as
with inserted as (
 insert into source_items(source_id,canonical_url,title_original,published_at,document_type,pipeline_status,relevance_status)
 select id,'https://www.edpb.europa.eu/weekly-undated-fixture','Undated official report',null,'news','drafted','relevant'
 from sources where name='EDPB 뉴스·보도자료' returning id
) select id from inserted;
insert into reports(source_item_id,title_ko,one_line_summary_ko,detailed_summary_ko,status,human_reviewed)
select id,'날짜 없는 자료','게시일 미확인 자료의 요약입니다.','주간호 대상에서 제외되어야 하는 초안입니다.','draft',false
from undated_weekly_fixture;
select throws_ok($$
 select public.save_written_weekly_draft('2026-W44','Undated exclusion test','2026-10-26','2026-11-01',
   (select jsonb_build_array(jsonb_build_object('report_id',id,'reason','fixture')) from reports where source_item_id=(select id from undated_weekly_fixture)))
$$,'P0001','report unavailable or outside week','weekly issue selection rejects reports whose source date is missing');
select * from finish();
rollback;
