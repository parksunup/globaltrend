-- Extraction readiness is metadata, not a blocker for an individual Korean draft.
-- Completion status must describe the actual draft job state instead.
create or replace function public.collector_completion_gaps(p_since date,p_until date)
returns table(item_id uuid,source_name text,original_title text,job_id uuid,job_status text,reason text)
language sql stable security invoker set search_path=public,pg_temp as $$
 select i.id,s.name,i.title_original,j.id,j.status,
 case when j.status='claimed' then 'draft_in_progress'
      when j.status='failed' then 'draft_failed'
      else 'korean_draft_required' end
 from public.source_items i
 join public.sources s on s.id=i.source_id
 left join public.draft_jobs j
   on j.source_item_id=i.id and j.source_item_revision_id=i.current_revision_id
 where s.is_active and s.terms_reviewed_at is not null
   and i.relevance_status<>'irrelevant'
   and (i.published_at at time zone 'Asia/Seoul')::date between p_since and p_until
   and not exists(
     select 1 from public.reports rp
      where rp.source_item_id=i.id
        and rp.status in ('draft','in_review','approved','published')
        and nullif(btrim(rp.title_ko),'') is not null
        and nullif(btrim(rp.one_line_summary_ko),'') is not null
        and nullif(btrim(rp.detailed_summary_ko),'') is not null
   )
 order by s.name,i.id;
$$;
