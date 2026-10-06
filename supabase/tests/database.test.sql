begin;

select plan(28);

select has_table('public', 'sources', 'sources table exists');
select has_table('public', 'legal_instruments', 'legal instruments table exists');
select has_table('public', 'criteria', 'criteria table exists');
select has_table('public', 'review_events', 'review events table exists');
select has_table('public', 'review_states', 'review states table exists');
select has_function(
  'public',
  'set_review_state',
  array['text', 'uuid', 'text', 'text'],
  'atomic review action function exists'
);

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
  ('10000000-0000-0000-0000-000000000003', 'outsider@example.test', 'Outsider')
on conflict (id) do update set display_name = excluded.display_name;

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
select results_eq(
  'select count(*)::bigint from public.legal_instruments',
  array[7::bigint],
  'anonymous visitors can read the legal catalog on /team'
);
select results_eq(
  'select count(*)::bigint from public.criteria',
  array[17::bigint],
  'anonymous visitors can read the comparison criteria on /team'
);
select ok(
  has_column_privilege('anon', 'public.review_states', 'status', 'select'),
  'anonymous visitors can read review status'
);
select ok(
  not has_column_privilege('anon', 'public.review_states', 'note', 'select'),
  'review notes remain private'
);
select throws_ok(
  $$insert into public.legal_instruments (jurisdiction_code, short_name, official_name) values ('ZZ', 'ANON-NOPE', 'Denied')$$,
  '42501',
  null,
  'anonymous visitors cannot edit catalog entries'
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
select throws_ok(
  $$select public.set_review_state('laws', (select id from public.legal_instruments limit 1), 'approved', 'no access')$$,
  '42501',
  'Active reviewer membership is required',
  'authenticated non-members cannot save a review'
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
select lives_ok(
  $$select public.set_review_state('laws', (select id from public.legal_instruments where short_name = 'APPI'), 'approved', 'official source checked')$$,
  'reviewers can approve an existing item'
);
select results_eq(
  $$select status from public.review_states where entity_type = 'laws' and entity_id = (select id from public.legal_instruments where short_name = 'APPI')$$,
  array['approved'::text],
  'the latest review state is stored'
);
select results_eq(
  $$select count(*)::bigint from public.review_events where entity_type = 'laws' and entity_id = (select id from public.legal_instruments where short_name = 'APPI') and action = 'approved'$$,
  array[1::bigint],
  'an immutable review event is recorded'
);
select throws_ok(
  $$select public.set_review_state('laws', (select id from public.legal_instruments where short_name = 'APPI'), 'rejected', null)$$,
  '22023',
  'A rejection note is required',
  'a rejection requires a note'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$insert into public.legal_instruments (jurisdiction_code, short_name, official_name) values ('ZZ', 'EDITOR-OK', 'Allowed')$$,
  'editors can insert legal instruments'
);
select lives_ok(
  $$select public.set_review_state('laws', (select id from public.legal_instruments where short_name = 'EDITOR-OK'), 'in_review', 'editor started review')$$,
  'editors can save a review state'
);

select * from finish();
rollback;
