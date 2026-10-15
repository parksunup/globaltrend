begin;
select plan(14);

select has_function('public', 'create_report_draft',
  array['uuid','text','text','text','text','text','text[]','text[]','timestamptz'],
  'atomic editorial draft function exists');
select ok(not has_function_privilege('anon',
  'public.create_report_draft(uuid,text,text,text,text,text,text[],text[],timestamptz)', 'execute'),
  'anonymous readers cannot create drafts');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('20000000-0000-0000-0000-000000000001','flow-editor@example.test','{}','{}',now(),now()),
  ('20000000-0000-0000-0000-000000000002','flow-admin@example.test','{}','{}',now(),now());
insert into public.team_memberships (user_id, role) values
  ('20000000-0000-0000-0000-000000000001','editor'),
  ('20000000-0000-0000-0000-000000000002','admin');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.create_report_draft(
  (select id from public.sources where is_active order by name limit 1),
  'https://example.test/editorial-flow', 'Original report', '검수 흐름 예시',
  '사람이 확인할 요약', '상세 설명', array['EU'], array['아동'], now()
)$$, 'editor can save a Korean draft and its source together');
select results_eq($$select count(*)::bigint from public.reports where title_ko = '검수 흐름 예시'$$,
  array[1::bigint], 'draft report is stored');
select lives_ok($$update public.reports set status='in_review' where title_ko='검수 흐름 예시'$$,
  'editor can request review');
select throws_ok($$update public.reports set status='approved' where title_ko='검수 흐름 예시'$$,
  '42501', 'Administrator approval is required', 'editor cannot approve through Data API');
select throws_ok($$update public.reports set status='published' where title_ko='검수 흐름 예시'$$,
  '42501', 'Administrator approval is required', 'editor cannot publish through Data API');

set local role anon;
select is_empty($$select id from public.reports where title_ko='검수 흐름 예시'$$,
  'anonymous visitors cannot see the draft report');
select is_empty($$select id from public.source_items where canonical_url='https://example.test/editorial-flow'$$,
  'anonymous visitors cannot see its source record');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select lives_ok($$update public.reports set status='approved' where title_ko='검수 흐름 예시'$$,
  'admin can approve after review');
select results_eq($$select human_reviewed from public.reports where title_ko='검수 흐름 예시'$$,
  array[true], 'approval records human review');
select lives_ok($$update public.reports set status='published' where title_ko='검수 흐름 예시'$$,
  'admin can publish an approved report');

set local role anon;
select results_eq($$select count(*)::bigint from public.reports where title_ko='검수 흐름 예시'$$,
  array[1::bigint], 'published report is public');
select results_eq($$select count(*)::bigint from public.source_items where canonical_url='https://example.test/editorial-flow'$$,
  array[1::bigint], 'published report source is public');

select * from finish();
rollback;
