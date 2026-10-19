begin;
select plan(16);
insert into auth.users(id,email) values
 ('31000000-0000-0000-0000-000000000001','legal-editor@example.test'),
 ('31000000-0000-0000-0000-000000000002','legal-admin@example.test');
insert into public.team_memberships(user_id,role) values
 ('31000000-0000-0000-0000-000000000001','editor'),
 ('31000000-0000-0000-0000-000000000002','admin');
create temporary table legal_test_payload as select jsonb_build_object(
 'recordId','kr-pipa','jurisdiction','KR','contentHash',repeat('a',64),
 'versionLabel','테스트 판본','availability','official_index','document',null,
 'instrument',jsonb_build_object('id','legal-kr-pipa','title','PIPA','subtitle','한국법',
   'links',jsonb_build_array(jsonb_build_object('url','https://example.test/law'))),
 'cells',jsonb_agg(jsonb_build_object('criterionId',criterion_key,'jurisdiction','KR','summary','비교 초안'))
) as payload from public.criteria where criteria_set_id=(select id from public.criteria_sets where name='한국·일본 개인정보 보호법 비교 기준' and version=1);
grant select on legal_test_payload to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.import_legal_review((select payload from legal_test_payload))$$,'editor imports immutable draft');
select results_eq($$select count(*)::bigint from public.law_versions where content_hash=repeat('a',64)$$,array[1::bigint],'one imported version');
select lives_ok($$select public.import_legal_review((select payload from legal_test_payload))$$,'same snapshot is idempotent');
select results_eq($$select count(*)::bigint from public.comparison_cells c join public.law_versions v on v.id=c.law_version_id where v.content_hash=repeat('a',64)$$,array[17::bigint],'17 criteria are stored');
select throws_ok($$select public.import_legal_review((select jsonb_set(payload,'{versionLabel}','"changed"') from legal_test_payload))$$,'22023','Snapshot hash already belongs to different content','cannot overwrite same snapshot');
select throws_ok($$select public.advance_legal_review((select id from public.law_versions where content_hash=repeat('a',64)),'verified',true)$$,'42501','Active administrator is required','editor cannot approve');
-- Team editors retain direct editing/deletion. Check privileges and the RLS
-- boundary without deleting shared criteria or the snapshot used below.
select lives_ok($$update public.law_versions set status=status where content_hash=repeat('a',64)$$,'editor can directly edit an imported version');
select throws_ok($$update public.law_versions set status='published' where content_hash=repeat('a',64)$$,
  '42501','Administrator approval is required','editor cannot directly promote a version to published');
select ok((select bool_and(has_table_privilege('authenticated','public.' || table_name,'UPDATE')
  and has_table_privilege('authenticated','public.' || table_name,'DELETE'))
  from unnest(array['law_versions','provision_nodes','comparison_cells','comparison_cell_provisions',
    'legal_instruments','criteria_sets','criteria']) as tables(table_name)),
  'authenticated retains update and delete grants on all seven legal tables');
select results_eq($$select count(*)::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('law_versions','provision_nodes','comparison_cells',
    'comparison_cell_provisions','legal_instruments','criteria_sets','criteria') and c.relrowsecurity$$,
  array[7::bigint],'all seven legal tables retain row level security');
select results_eq($$select count(*)::bigint from pg_policies
  where schemaname='public' and tablename in ('law_versions','provision_nodes','comparison_cells',
    'comparison_cell_provisions','legal_instruments','criteria_sets','criteria')
    and cmd='ALL' and roles=array['authenticated']::name[]
    and qual like '%is_team_member(''editor''::text)%'
    and with_check like '%is_team_member(''editor''::text)%'$$,
  array[7::bigint],'direct writes remain limited to active editor or administrator membership');
set local role anon;
select is_empty($$select id from public.law_versions where content_hash=repeat('a',64)$$,'anonymous cannot see drafts');
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.advance_legal_review((select id from public.law_versions where content_hash=repeat('a',64)),'published',true)$$,'22023','Invalid legal review transition','cannot skip approval');
select lives_ok($$select public.advance_legal_review((select id from public.law_versions where content_hash=repeat('a',64)),'verified',true)$$,'admin approves exact immutable snapshot');
select lives_ok($$select public.advance_legal_review((select id from public.law_versions where content_hash=repeat('a',64)),'published',true)$$,'admin publishes approved snapshot');
set local role anon;
select results_eq($$select count(*)::bigint from public.law_versions where content_hash=repeat('a',64)$$,array[1::bigint],'published snapshot is readable');
select * from finish();
rollback;
