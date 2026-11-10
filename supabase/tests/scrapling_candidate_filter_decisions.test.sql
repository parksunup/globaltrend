begin;
\ir fixtures/writing-review.inc
set local search_path=public,extensions;
select plan(9);

update sources set terms_reviewed_at=now() where name='EDPB 뉴스·보도자료';
create temporary table scrapling_fixture as
select gen_random_uuid() run_id, gen_random_uuid() execution_id;
select record_scrapling_collection_run(
  run_id,execution_id::text,current_date,current_date,now(),now(),'running',repeat('a',40),'{"test_scope":"rollback_only"}'::jsonb
) from scrapling_fixture;

create temporary table scrapling_items as
select 'accepted'::text kind,x.* from ingest_source_item(
  (select id from sources where name='EDPB 뉴스·보도자료'),null,
  'https://www.edpb.europa.eu/scrapling-filter-fixture/accepted',
  'Scrapling accepted fixture',now(),null,now(),'en','news',
  'The board published final privacy guidelines for the test fixture.',
  encode(extensions.digest('The board published final privacy guidelines for the test fixture.','sha256'),'hex'),null,
  jsonb_build_object('collector','scrapling-separate-v1','scrapling_run_id',(select run_id::text from scrapling_fixture),'ai_ready',false),
  'trend-ko-v1'
) x
union all
select 'duplicate'::text kind,x.* from ingest_source_item(
  (select id from sources where name='EDPB 뉴스·보도자료'),null,
  'https://www.edpb.europa.eu/scrapling-filter-fixture/duplicate',
  'Scrapling duplicate fixture',now(),null,now(),'en','news',
  'A duplicate announcement in a separate feed should remain out of the draft queue.',
  encode(extensions.digest('A duplicate announcement in a separate feed should remain out of the draft queue.','sha256'),'hex'),null,
  jsonb_build_object('collector','scrapling-separate-v1','scrapling_run_id',(select run_id::text from scrapling_fixture),'ai_ready',false),
  'trend-ko-v1'
) x;

select is((select draft_job_id from scrapling_items where kind='accepted'),null::uuid,
  'unfiltered Scrapling item has no draft job');
select is((select count(*)::integer from draft_jobs where source_item_id=(select source_item_id from scrapling_items where kind='accepted')),0,
  'unfiltered item cannot enter the writer queue');
select is((select count(*)::integer from draft_jobs where source_item_id=(select source_item_id from scrapling_items where kind='duplicate')),0,
  'second collected candidate also waits outside the writer queue');

select record_scrapling_filter_decision(
  (select run_id from scrapling_fixture),(select source_item_id from scrapling_items where kind='accepted'),
  (select source_item_revision_id from scrapling_items where kind='accepted'),
  (select content_hash from source_item_revisions where id=(select source_item_revision_id from scrapling_items where kind='accepted')),
  'accepted',null,null,null,'Reviewed source text and found no matching item or report.','scrapling-dedup-v1','{}'::jsonb
);
select record_scrapling_filter_decision(
  (select run_id from scrapling_fixture),(select source_item_id from scrapling_items where kind='duplicate'),
  (select source_item_revision_id from scrapling_items where kind='duplicate'),
  (select content_hash from source_item_revisions where id=(select source_item_revision_id from scrapling_items where kind='duplicate')),
  'same_event_duplicate',(select source_item_id from scrapling_items where kind='accepted'),null,
  'title_date_body_match','Same official announcement as the already collected accepted item.','scrapling-dedup-v1','{}'::jsonb
);

select is((select count(*)::integer from draft_jobs where source_item_id=(select source_item_id from scrapling_items where kind='accepted')),1,
  'accepted item enters the existing retained Korean draft queue');
select is((select count(*)::integer from draft_jobs where source_item_id=(select source_item_id from scrapling_items where kind='duplicate')),0,
  'confirmed duplicate never enters the Korean draft queue');
select is((select relevance_status from source_items where id=(select source_item_id from scrapling_items where kind='accepted')),'relevant',
  'accepted candidate is marked relevant');
select is((select relevance_status from source_items where id=(select source_item_id from scrapling_items where kind='duplicate')),'irrelevant',
  'duplicate candidate is filtered from relevance processing');
select is((select decision from scrapling_filter_decisions where source_item_id=(select source_item_id from scrapling_items where kind='duplicate')),'same_event_duplicate',
  'duplicate match decision and reason are retained');
select ok(not has_function_privilege('anon','record_scrapling_filter_decision(uuid,uuid,uuid,text,text,uuid,uuid,text,text,text,jsonb)','execute'),
  'anonymous callers cannot create filter decisions');
select * from finish();
rollback;
