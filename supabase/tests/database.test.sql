begin;

select plan(17);

select has_table('public', 'sources', 'sources table exists');
select has_table('public', 'legal_instruments', 'legal instruments table exists');
select has_table('public', 'criteria', 'criteria table exists');
select has_table('public', 'review_events', 'review events table exists');

select results_eq(
  'select count(*)::bigint from public.publishers',
  array[3::bigint],
  'three initial publishers are seeded'
);
select results_eq(
  'select count(*)::bigint from public.sources',
  array[3::bigint],
  'three initial sources are seeded'
);
select results_eq(
  'select count(*)::bigint from public.legal_instruments',
  array[7::bigint],
  'seven legal instruments are seeded'
);
select results_eq(
  'select count(*)::bigint from public.criteria',
  array[17::bigint],
  'seventeen comparison criteria are seeded'
);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'reviewer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'editor@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, email, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'reviewer@example.test', 'Reviewer'),
  ('10000000-0000-0000-0000-000000000002', 'editor@example.test', 'Editor'),
  ('10000000-0000-0000-0000-000000000003', 'outsider@example.test', 'Outsider');

insert into public.team_memberships (user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', 'reviewer'),
  ('10000000-0000-0000-0000-000000000002', 'editor');

set local role anon;

select results_eq(
  'select count(*)::bigint from public.sources',
  array[3::bigint],
  'anonymous users can read active source metadata'
);
select is_empty(
  'select * from public.legal_instruments',
  'anonymous users cannot read unpublished legal instruments'
);
select is_empty(
  'select * from public.criteria',
  'anonymous users cannot read unpublished criteria'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

select is_empty(
  'select * from public.legal_instruments',
  'authenticated non-members cannot read unpublished legal instruments'
);
select throws_ok(
  $$insert into public.legal_instruments (jurisdiction_code, short_name, official_name) values ('ZZ', 'NOPE', 'Denied')$$,
  '42501',
  null,
  'authenticated non-members cannot insert legal instruments'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select results_eq(
  'select count(*)::bigint from public.legal_instruments',
  array[7::bigint],
  'reviewers can read unpublished legal instruments'
);
select results_eq(
  'select count(*)::bigint from public.criteria',
  array[17::bigint],
  'reviewers can read unpublished criteria'
);
select throws_ok(
  $$insert into public.legal_instruments (jurisdiction_code, short_name, official_name) values ('ZZ', 'REVIEWER-NOPE', 'Denied')$$,
  '42501',
  null,
  'reviewers cannot insert legal instruments'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$insert into public.legal_instruments (jurisdiction_code, short_name, official_name) values ('ZZ', 'EDITOR-OK', 'Allowed')$$,
  'editors can insert legal instruments'
);

select * from finish();
rollback;
