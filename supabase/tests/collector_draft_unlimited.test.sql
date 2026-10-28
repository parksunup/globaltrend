begin;
set local search_path = public, extensions;
select plan(16);

select is(public.collector_draft_policy()->>'policy_version', 'trend-draft-unlimited-v2', 'unlimited policy is identified');
select ok(public.collector_draft_policy()->'daily_claim_limit' = 'null'::jsonb, 'no daily claim limit is advertised');
select ok((public.collector_draft_policy()->>'targeted_claim_supported')::boolean, 'targeted claims are advertised');
select ok(not has_function_privilege('anon', 'public.claim_trend_draft_jobs(text,integer,uuid)', 'execute'), 'anonymous cannot claim a targeted job');
select ok(not has_function_privilege('authenticated', 'public.collector_draft_policy()', 'execute'), 'browser users cannot inspect the worker policy');

update public.sources set terms_reviewed_at = now() where name = 'EDPB 뉴스·보도자료';
create temporary table target_jobs (kind text primary key, job uuid not null);
insert into target_jobs(kind, job)
select 'other', draft_job_id from public.ingest_source_item(
 (select id from public.sources where name = 'EDPB 뉴스·보도자료'), null,
 'https://www.edpb.europa.eu/test-unlimited-other', 'Other item', '2026-10-07', null, now(), 'en', 'news',
 'The board published a separate final guideline on personal data processing.', repeat('a', 64), null,
 '{"ai_ready":true}'::jsonb, 'trend-ko-v1');
insert into target_jobs(kind, job)
select 'target', draft_job_id from public.ingest_source_item(
 (select id from public.sources where name = 'EDPB 뉴스·보도자료'), null,
 'https://www.edpb.europa.eu/test-unlimited-target', 'Target item', '2026-10-07', null, now(), 'en', 'news',
 'The board published the targeted final guideline on personal data processing.', repeat('b', 64), null,
 '{"ai_ready":true}'::jsonb, 'trend-ko-v1');
insert into target_jobs(kind, job)
select 'already-reported', draft_job_id from public.ingest_source_item(
 (select id from public.sources where name = 'EDPB 뉴스·보도자료'), null,
 'https://www.edpb.europa.eu/test-unlimited-already-reported', 'Already reported item', '2026-10-07', null, now(), 'en', 'news',
 'The board published another final guideline on personal data processing.', repeat('f', 64), null,
 '{"ai_ready":true}'::jsonb, 'trend-ko-v1');
insert into target_jobs(kind, job)
select 'undated', draft_job_id from public.ingest_source_item(
 (select id from public.sources where name = 'EDPB 뉴스·보도자료'), null,
 'https://www.edpb.europa.eu/test-unlimited-undated', 'Undated item', null, null, now(), 'en', 'news',
 'The board published an undated guideline on personal data processing.', repeat('9', 64), null,
 '{"ai_ready":true}'::jsonb, 'trend-ko-v1');
insert into public.reports(source_item_id, title_ko)
select j.source_item_id, '기존 검수 보고서'
from public.draft_jobs j join target_jobs t on t.job = j.id
where t.kind = 'already-reported';

insert into public.collector_draft_daily_usage(day, claims)
values ((now() at time zone 'Asia/Seoul')::date, 10)
on conflict (day) do update set claims = 10;
select is(jsonb_array_length(public.claim_trend_draft_jobs('missing-worker', 1, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)), 0,
 'unknown target does not claim another job');
select is(jsonb_array_length(public.claim_trend_draft_jobs('undated-worker', 1,
 (select job from target_jobs where kind = 'undated'))), 0,
 'an undated item cannot be claimed even when a faulty importer marks it ready');
select throws_ok(format('insert into public.reports(source_item_id,title_ko,automation_metadata) values (%L::uuid,%L,%L::jsonb)',
 (select j.source_item_id from public.draft_jobs j join target_jobs t on t.job=j.id where t.kind='undated'),
 '날짜 없는 자동 초안', '{"job_id":"undated-test"}'),
 '22023', 'Auto draft requires a verified publication date',
 'an existing worker lease cannot submit an undated automatic report');
select is((public.claim_trend_draft_jobs('target-worker', 1, (select job from target_jobs where kind = 'target'))->0->>'job_id')::uuid,
 (select job from target_jobs where kind = 'target'), 'targeted claim returns only the requested job');
select is((select status from public.draft_jobs where id = (select job from target_jobs where kind = 'other')),
 'pending', 'targeted claim leaves a different job untouched');
select is(jsonb_array_length(public.claim_trend_draft_jobs('reported-target-worker', 1,
 (select job from target_jobs where kind = 'already-reported'))), 0,
 'targeted claim skips an item that already has a report');
select is((select status from public.draft_jobs where id = (select job from target_jobs where kind = 'already-reported')),
 'pending', 'skipping an existing report does not alter the pending job');
select is(jsonb_array_length(public.claim_trend_draft_jobs('generic-worker', 1)), 1,
 'generic claim still works after ten claims today');
select is((select status from public.draft_jobs where id = (select job from target_jobs where kind = 'already-reported')),
 'pending', 'generic claim does not take an item with an existing report');
select is((select attempts from public.draft_jobs where id = (select job from target_jobs where kind = 'already-reported')),
 0, 'existing report does not consume a draft attempt');
select is((select claims from public.collector_draft_daily_usage where day = (now() at time zone 'Asia/Seoul')::date),
 10, 'legacy daily usage stays unchanged');

select * from finish();
rollback;
