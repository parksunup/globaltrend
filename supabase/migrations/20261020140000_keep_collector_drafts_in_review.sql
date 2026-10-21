-- The collector review page shows the 100 most recent source items, but a new
-- collection run must not push older, still-unreviewed reports out of its inbox.
-- Keep every unreviewed draft visible in addition to the recent-item window.
create or replace function private.get_trend_collector_review() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;
begin
 if not private.is_team_member('reviewer') then raise insufficient_privilege using message='Active reviewer membership is required'; end if;
 with recent_items as (
   select si.id from public.source_items si
   where si.current_revision_id is not null or si.metadata ? 'fetch_failure'
   order by si.discovered_at desc,si.id limit 100
 ), review_queue as (
   select r.source_item_id from public.reports r
   where r.status in ('draft','in_review') and r.human_reviewed = false
 )
 select coalesce(jsonb_agg(to_jsonb(x) - 'review_priority' - 'sort_discovered_at'
   order by x.review_priority,x.sort_discovered_at desc,x.id),'[]'::jsonb)
 into result from (
  select si.id,si.title_original,si.canonical_url,si.published_at,s.name as source_name,si.current_revision_id,
  si.pipeline_status,si.relevance_status,si.metadata,
  (select r.content_text from public.source_item_revisions r where r.id=si.current_revision_id) as current_content_text,
  (select r.content_text from public.source_item_revisions r join public.reports report on report.source_item_revision_id=r.id where report.source_item_id=si.id) as report_content_text,
  (select coalesce(jsonb_agg(to_jsonb(j)||jsonb_build_object('input_content_text',rev.content_text)),'[]'::jsonb) from public.draft_jobs j left join public.source_item_revisions rev on rev.id=j.source_item_revision_id where j.source_item_id=si.id) as jobs,
  (select to_jsonb(r) from public.reports r where r.source_item_id=si.id) as report,
  (select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.report_evidence e join public.reports r on e.report_id=r.id where r.source_item_id=si.id) as evidence,
  case when si.id in (select source_item_id from review_queue) then 0 else 1 end as review_priority,
  si.discovered_at as sort_discovered_at
  from public.source_items si join public.sources s on s.id=si.source_id
  where (si.current_revision_id is not null or si.metadata ? 'fetch_failure')
    and (si.id in (select id from recent_items) or si.id in (select source_item_id from review_queue))
 ) x;
 return jsonb_build_object('items',result,'limit',100,'database_bytes',pg_database_size(current_database()));
end; $$;

revoke all on function private.get_trend_collector_review() from public,anon,authenticated;
grant execute on function private.get_trend_collector_review() to authenticated;
