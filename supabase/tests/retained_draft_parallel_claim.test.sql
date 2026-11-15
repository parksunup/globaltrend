begin;
set local search_path=public,extensions;
select plan(12);

select ok(to_regprocedure('public.collector_claim_retained_drafts(text,integer)') is not null,
  'retained writer has a batch claim RPC');
select ok(not has_function_privilege('anon','public.collector_claim_retained_drafts(text,integer)','execute'),
  'anonymous users cannot claim writer work');
select ok(not has_function_privilege('authenticated','public.collector_claim_retained_drafts(text,integer)','execute'),
  'signed-in browser users cannot claim writer work');

update public.sources set terms_reviewed_at=now() where name='EDPB 뉴스·보도자료';
create temporary table parallel_fixture(n integer primary key, item uuid, revision uuid, job uuid, input_hash text);
insert into parallel_fixture(n,item,revision,job,input_hash)
select g.n, ing.source_item_id, ing.source_item_revision_id, ing.draft_job_id, repeat(substr(md5(g.n::text),1,1),64)
from generate_series(1,4) g(n)
cross join lateral public.ingest_source_item(
  (select id from public.sources where name='EDPB 뉴스·보도자료'),null,
  'https://www.edpb.europa.eu/parallel-fixture-'||g.n,
  'Official privacy guideline fixture '||g.n,'2026-10-28',null,now(),'en','news',
  'The board published a final guideline on personal data processing, fixture '||g.n||'.',
  repeat(substr(md5(g.n::text),1,1),64),null,'{"ai_ready":true}'::jsonb,'trend-ko-v1'
) ing;
update public.source_items set relevance_status='relevant' where id in (select item from parallel_fixture);
select public.collector_retain_for_draft(item,revision,input_hash,'병렬 선점 시험 fixture') from parallel_fixture;

create temporary table first_batch as
select public.collector_claim_retained_drafts('parallel-fixture-run',3) payload;
select is((select payload->>'status' from first_batch),'claimed','three retained jobs can be claimed together');
select is(jsonb_array_length((select payload->'jobs' from first_batch)),3,'batch returns three complete claim packets');
select is((select count(distinct value->>'job_id') from first_batch, lateral jsonb_array_elements(payload->'jobs'))::integer,
  3,'batch contains three different jobs');
select is((select count(*) from parallel_fixture f join public.draft_jobs j on j.id=f.job where j.status='claimed'),
  3::bigint,'three fixture jobs receive active leases');
select is((select count(*) from parallel_fixture f join public.draft_jobs j on j.id=f.job where j.status='pending'),
  1::bigint,'unclaimed retained work stays pending');
select public.fail_trend_draft((select j.id from parallel_fixture f join public.draft_jobs j on j.id=f.job
  where j.status='claimed' order by j.created_at,j.id limit 1),'parallel-fixture-run','isolated fixture failure');
select is((select count(*) from parallel_fixture f join public.draft_jobs j on j.id=f.job where j.status='claimed'),
  2::bigint,'one failed job leaves the other claimed jobs active');
select is((select count(*) from parallel_fixture f join public.draft_jobs j on j.id=f.job where j.status='failed'),
  1::bigint,'one packet can fail independently');
select is((public.collector_claim_retained_drafts('parallel-fixture-second',3)->>'status'),
  'claimed','a second worker can claim the remaining independent job');
select is((public.collector_claim_retained_drafts('parallel-fixture-third',3)->>'status'),
  'no_claimable_retained_job','active leases are not claimed twice');

select * from finish();
rollback;
