begin;
select plan(13);
insert into auth.users(id,email) values ('33000000-0000-0000-0000-000000000001','criteria-editor@example.test');
insert into public.team_memberships(user_id,role) values ('33000000-0000-0000-0000-000000000001','editor');
create temporary table criteria_version_payloads as select cs.version,jsonb_build_object(
 'recordId','kr-pipa','jurisdiction','KR','contentHash',repeat(cs.version::text,64),
 'versionLabel','기준 판본 시험','availability','official_index','document',null,
 'instrument',jsonb_build_object('id','legal-kr-pipa','title','PIPA','links',jsonb_build_array(jsonb_build_object('url','https://example.test/law'))),
 'cells',jsonb_agg(jsonb_build_object('criterionId',cr.criterion_key,'jurisdiction','KR','summary','미검수 비교 초안') order by cr.sort_order)) payload
from public.criteria cr join public.criteria_sets cs on cs.id=cr.criteria_set_id
where cs.name='한국·일본 개인정보 보호법 비교 기준' and cs.version in (1,2) group by cs.version;
select is((select count(*) from public.criteria cr join public.criteria_sets cs on cs.id=cr.criteria_set_id where cs.version=1),17::bigint,'legacy criteria are retained');
select is((select count(*) from public.criteria cr join public.criteria_sets cs on cs.id=cr.criteria_set_id where cs.version=2),18::bigint,'v2 includes the additional criterion');
select is((select is_published from public.criteria_sets where version=2),false,'new criteria are not published');
grant select on criteria_version_payloads to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','33000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.import_legal_review(payload) from criteria_version_payloads where version=1$$,'legacy import remains supported');
select lives_ok($$select public.import_legal_review(payload) from criteria_version_payloads where version=2$$,'complete v2 can be imported as a draft');
select is((select count(*) from public.comparison_cells c join public.law_versions v on v.id=c.law_version_id where v.content_hash=repeat('2',64)),18::bigint,'all v2 cells are stored');
select ok((select bool_and(c.status='unreviewed') from public.comparison_cells c join public.law_versions v on v.id=c.law_version_id where v.content_hash=repeat('2',64)),'import does not approve any cell');
select throws_ok($$select public.import_legal_review(jsonb_set(payload,'{cells}',(payload->'cells')-0)) from criteria_version_payloads where version=2$$,'22023','Complete registered legal criteria are required','missing criterion is rejected');
select throws_ok($$select public.import_legal_review(jsonb_set(payload,'{cells,0,criterionId}','"unknown"')) from criteria_version_payloads where version=2$$,'22023','Complete registered legal criteria are required','unknown criterion is rejected');
select throws_ok($$select public.import_legal_review(jsonb_set(payload,'{cells,0,criterionId}',payload#>'{cells,1,criterionId}')) from criteria_version_payloads where version=2$$,'22023','Complete registered legal criteria are required','duplicate criterion is rejected');
reset role;
select lives_ok($$select private.validate_publication_payload('law',payload,payload) from criteria_version_payloads where version=2$$,'publication validation recognizes v2 without publishing');
-- Exercise materialization inside this rolled-back test only. Replacing v1 with v2 must not leave 35 cells.
select lives_ok($$select private.materialize_legal_working_copy((select id from public.law_versions where content_hash=repeat('1',64)),(select payload from criteria_version_payloads where version=2))$$,'explicit replacement resolves the matching set');
select is((select count(*) from public.comparison_cells c join public.law_versions v on v.id=c.law_version_id where v.content_hash=repeat('1',64)),18::bigint,'replaced materialization has 18 cells without stale duplicates');
select * from finish();
rollback;
