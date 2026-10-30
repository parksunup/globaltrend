begin;
\ir fixtures/writing-review.inc
set local search_path=public,extensions;
select plan(8);

update sources set terms_reviewed_at=now() where name='EDPB 뉴스·보도자료';
create temporary table completion_context as
select source_item_id item, source_item_revision_id revision, draft_job_id job
from ingest_source_item(
  (select id from sources where name='EDPB 뉴스·보도자료'),
  null,
  'https://www.edpb.europa.eu/daily-completion-guard-fixture',
  'Official privacy guidance awaiting editorial decision',
  '2026-10-30',null,now(),'en','news',
  'The board published guidance on processing personal data.',
  repeat('9',64),null,'{"ai_ready":true}'::jsonb,'trend-ko-v1'
);

insert into collector_edge_events(source_id,trigger_kind,execution_id,started_at,result)
values(
  null,'cloud-automation-summary','daily-gap-guard-fixture',now(),
  '{"role":"daily-producer","status":"success","target_window_kst":{"from_inclusive":"2026-10-28","through_inclusive":"2026-10-30"}}'
);

select is(
  (select result->>'status' from collector_edge_events where execution_id='daily-gap-guard-fixture'),
  'partial',
  'unclassified source item prevents producer success'
);
select is(
  (select (result->>'completion_gap_count')::integer from collector_edge_events where execution_id='daily-gap-guard-fixture'),
  1,
  'producer summary records all Korean draft or relevance-decision gaps'
);

update collector_edge_events
set result=result||'{"status":"success"}'::jsonb
where execution_id='daily-gap-guard-fixture';
select is(
  (select result->>'status' from collector_edge_events where execution_id='daily-gap-guard-fixture'),
  'partial',
  'summary update cannot bypass completion guard'
);

select is(
  (collector_daily_pipeline_status('2026-10-28','2026-10-30')->>'ready_to_complete')::boolean,
  false,
  'daily pipeline status remains open while a relevance decision is pending'
);

select is(
  collector_finalize_daily_producer(
    'daily-finalize-fixture',now(),now(),'2026-10-28','2026-10-30',
    '{"role":"daily-producer","status":"success","target_window_kst":{"from_inclusive":"2026-10-28","through_inclusive":"2026-10-30"}}'
  )->>'status',
  'partial',
  'atomic finalizer refuses success with a completion gap'
);

update source_items
set relevance_status='irrelevant',
    metadata=metadata||'{"relevance_review":{"reason":"fixture is outside editorial scope"}}'::jsonb
where id=(select item from completion_context);

select is(
  (collector_daily_pipeline_status('2026-10-28','2026-10-30')->>'ready_to_complete')::boolean,
  true,
  'explicit irrelevant decision closes the gap'
);
select is(
  collector_finalize_daily_producer(
    'daily-finalize-fixture',now(),now(),'2026-10-28','2026-10-30',
    '{"role":"daily-producer","status":"success","target_window_kst":{"from_inclusive":"2026-10-28","through_inclusive":"2026-10-30"}}'
  )->>'status',
  'success',
  'atomic finalizer records success only after every item is decided and drafted'
);
select is(
  (select count(*)::integer from collector_edge_events where execution_id='daily-finalize-fixture'),
  1,
  'finalizer updates one durable summary instead of duplicating it'
);

select * from finish();
rollback;
