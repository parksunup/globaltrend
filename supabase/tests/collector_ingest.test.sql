begin;

select plan(17);

select has_table('public', 'source_item_revisions', 'source item revisions table exists');
select has_column('public', 'source_items', 'current_revision_id', 'source items point to the current revision');
select has_column('public', 'draft_jobs', 'source_item_revision_id', 'draft jobs point to their exact input revision');
select has_function(
  'public',
  'ingest_source_item',
  array['uuid', 'text', 'text', 'text', 'timestamptz', 'date', 'timestamptz', 'text', 'text', 'text', 'text', 'text', 'jsonb', 'text'],
  'collector ingest function exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.source_item_revisions'::regclass),
  'source item revisions use RLS'
);
select ok(
  not has_function_privilege('anon', 'public.ingest_source_item(uuid,text,text,text,timestamptz,date,timestamptz,text,text,text,text,text,jsonb,text)', 'execute'),
  'anonymous users cannot call the collector ingest function'
);
select ok(
  not has_function_privilege('authenticated', 'public.ingest_source_item(uuid,text,text,text,timestamptz,date,timestamptz,text,text,text,text,text,jsonb,text)', 'execute'),
  'signed-in users cannot call the collector ingest function'
);
select ok(
  has_function_privilege('service_role', 'public.ingest_source_item(uuid,text,text,text,timestamptz,date,timestamptz,text,text,text,text,text,jsonb,text)', 'execute'),
  'the trusted worker role can call the collector ingest function'
);

set local role service_role;

select lives_ok(
  $$select public.ingest_source_item(
    (select id from public.sources where name = 'EDPB 뉴스·보도자료' limit 1),
    'test-001',
    'https://example.test/privacy/item-1',
    'Test privacy item',
    '2026-09-29T00:00:00Z',
    null,
    '2026-09-30T00:00:00Z',
    'en',
    'press_release',
    'First fetched body',
    repeat('a', 64),
    null,
    '{"fixture":true}'::jsonb,
    'trend-draft-v1'
  )$$,
  'a trusted worker can ingest a fetched item'
);
select results_eq(
  $$select count(*)::bigint from public.source_items where canonical_url = 'https://example.test/privacy/item-1'$$,
  array[1::bigint],
  'one normalized source item is stored'
);
select results_eq(
  $$select count(*)::bigint from public.source_item_revisions where content_hash = repeat('a', 64)$$,
  array[1::bigint],
  'one immutable content revision is stored'
);
select results_eq(
  $$select count(*)::bigint from public.draft_jobs where input_hash = repeat('a', 64)$$,
  array[1::bigint],
  'one draft job is queued'
);

select lives_ok(
  $$select public.ingest_source_item(
    (select id from public.sources where name = 'EDPB 뉴스·보도자료' limit 1),
    'test-001',
    'https://example.test/privacy/item-1',
    'Test privacy item',
    '2026-09-29T00:00:00Z',
    null,
    '2026-09-30T01:00:00Z',
    'en',
    'press_release',
    'First fetched body',
    repeat('a', 64),
    null,
    '{"seen_again":true}'::jsonb,
    'trend-draft-v1'
  )$$,
  'redelivery of the same input succeeds'
);
select results_eq(
  $$select (select count(*) from public.source_items where canonical_url = 'https://example.test/privacy/item-1')::bigint
          + (select count(*) from public.source_item_revisions where content_hash = repeat('a', 64))::bigint
          + (select count(*) from public.draft_jobs where input_hash = repeat('a', 64))::bigint$$,
  array[3::bigint],
  'redelivery creates no duplicate item, revision, or job'
);

select lives_ok(
  $$select public.ingest_source_item(
    (select id from public.sources where name = 'EDPB 뉴스·보도자료' limit 1),
    'test-001',
    'https://example.test/privacy/item-1',
    'Test privacy item corrected',
    '2026-09-29T00:00:00Z',
    null,
    '2026-09-30T02:00:00Z',
    'en',
    'press_release',
    'Corrected fetched body',
    repeat('b', 64),
    null,
    '{"corrected":true}'::jsonb,
    'trend-draft-v1'
  )$$,
  'changed content creates a new revision'
);
select results_eq(
  $$select (select count(*) from public.source_item_revisions where source_item_id = (select id from public.source_items where canonical_url = 'https://example.test/privacy/item-1'))::bigint,
          (select count(*) from public.draft_jobs where source_item_id = (select id from public.source_items where canonical_url = 'https://example.test/privacy/item-1'))::bigint$$,
  array[2::bigint, 2::bigint],
  'changed content keeps both revisions and queues a second job'
);

select throws_ok(
  $$select public.ingest_source_item(
    (select id from public.sources where name = 'EDPB 뉴스·보도자료' limit 1),
    null,
    'file:///private/item',
    'Invalid URL item',
    null,
    null,
    null,
    'en',
    'other',
    null,
    null,
    null,
    '{}'::jsonb,
    'trend-draft-v1'
  )$$,
  '22023',
  'Canonical URL must use HTTP or HTTPS',
  'non-HTTP source URLs are rejected'
);

select * from finish();
rollback;
