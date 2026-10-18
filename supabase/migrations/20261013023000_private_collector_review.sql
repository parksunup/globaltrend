-- Keep the privileged team projection outside the exposed API schema.
create function private.get_trend_collector_review() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;
begin
 if not private.is_team_member('reviewer') then raise insufficient_privilege using message='Active reviewer membership is required'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
  select si.id,si.title_original,si.canonical_url,si.published_at,s.name as source_name,si.current_revision_id,
  si.pipeline_status,si.relevance_status,si.metadata,
  (select r.content_text from public.source_item_revisions r where r.id=si.current_revision_id) as current_content_text,
  (select r.content_text from public.source_item_revisions r join public.reports report on report.source_item_revision_id=r.id where report.source_item_id=si.id) as report_content_text,
  (select coalesce(jsonb_agg(to_jsonb(j)||jsonb_build_object('input_content_text',rev.content_text)),'[]'::jsonb) from public.draft_jobs j left join public.source_item_revisions rev on rev.id=j.source_item_revision_id where j.source_item_id=si.id) as jobs,
  (select to_jsonb(r) from public.reports r where r.source_item_id=si.id) as report,
  (select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.report_evidence e join public.reports r on e.report_id=r.id where r.source_item_id=si.id) as evidence
  from public.source_items si join public.sources s on s.id=si.source_id
  where si.current_revision_id is not null or si.metadata ? 'fetch_failure'
  order by si.discovered_at desc,si.id limit 100
 ) x;
 return jsonb_build_object('items',result,'limit',100,'database_bytes',pg_database_size(current_database()));
end; $$;


revoke all on function private.get_trend_collector_review() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.get_trend_collector_review() to authenticated;
create or replace function public.get_trend_collector_review() returns jsonb
language sql security invoker set search_path=pg_catalog,private as $$
 select private.get_trend_collector_review();
$$;
revoke all on function public.get_trend_collector_review() from public,anon;
grant execute on function public.get_trend_collector_review() to authenticated;
