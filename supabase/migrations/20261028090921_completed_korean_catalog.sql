-- A collected source is not a completed trend until a Korean draft exists.
create or replace function public.get_trend_catalog(p_offset integer default 0,p_limit integer default 200,p_item_id uuid default null)
returns table(item_id uuid,report_id uuid,title text,original_title text,official_url text,source_name text,published_date date,document_type text,editorial_status text,jurisdictions text[],topics text[])
language sql stable security definer set search_path=public,pg_temp as $$
 select i.id,case when r.status='published' then r.id else null end,r.title_ko,i.title_original,i.canonical_url,s.name,
 (i.published_at at time zone 'Asia/Seoul')::date,i.document_type,case when r.status='published' then 'published' else 'review_pending' end,
 coalesce(r.jurisdictions,'{}'::text[]),coalesce(r.topics,'{}'::text[])
 from source_items i join sources s on s.id=i.source_id
 join lateral(select * from reports x where x.source_item_id=i.id and x.status in ('draft','in_review','approved','published') and nullif(btrim(x.title_ko),'') is not null and nullif(btrim(x.one_line_summary_ko),'') is not null and nullif(btrim(x.detailed_summary_ko),'') is not null order by (x.status='published') desc,x.created_at desc,x.id limit 1) r on true
 where s.is_active and s.terms_reviewed_at is not null and (p_item_id is null or i.id=p_item_id)
 order by i.published_at desc nulls last,i.id
 limit least(greatest(p_limit,1),200) offset greatest(p_offset,0);
$$;
create function public.collector_completion_gaps(p_since date,p_until date)
returns table(item_id uuid,source_name text,original_title text,job_id uuid,job_status text,reason text)
language sql stable security invoker set search_path=public,pg_temp as $$
 select i.id,s.name,i.title_original,j.id,j.status,
 case when r.metadata->>'ai_ready' is distinct from 'true' then 'source_verification_required' when j.status='claimed' then 'draft_in_progress' when j.status='failed' then 'draft_failed' else 'korean_draft_required' end
 from source_items i join sources s on s.id=i.source_id
 left join source_item_revisions r on r.id=i.current_revision_id
 left join draft_jobs j on j.source_item_id=i.id and j.source_item_revision_id=i.current_revision_id
 where s.is_active and s.terms_reviewed_at is not null and i.relevance_status<>'irrelevant'
 and (i.published_at at time zone 'Asia/Seoul')::date between p_since and p_until
 and not exists(select 1 from reports rp where rp.source_item_id=i.id and rp.status in ('draft','in_review','approved','published') and nullif(btrim(rp.title_ko),'') is not null and nullif(btrim(rp.one_line_summary_ko),'') is not null and nullif(btrim(rp.detailed_summary_ko),'') is not null)
 order by s.name,i.id;
$$;
revoke all on function public.collector_completion_gaps(date,date) from public,anon,authenticated,service_role;
grant execute on function public.collector_completion_gaps(date,date) to service_role;

-- A missing publication date must never enter an automated weekly draft.
create or replace function public.claim_trend_draft_jobs(p_worker text, p_limit integer, p_target_job_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_job record; v_result jsonb = '[]'::jsonb;
begin
 if nullif(btrim(p_worker), '') is null or length(p_worker) > 160
    or p_limit is null or p_limit not between 1 and 10
    or (p_target_job_id is not null and p_limit <> 1) then
   raise invalid_parameter_value using message = 'Bounded worker and batch are required';
 end if;
 if pg_database_size(current_database()) >= 400000000 then return v_result; end if;

 for v_job in
   select j.id from public.draft_jobs j
   join public.source_items si on si.id = j.source_item_id
   join public.sources s on s.id = si.source_id
   join public.source_item_revisions r on r.id = j.source_item_revision_id
   where (p_target_job_id is null or j.id = p_target_job_id)
     and j.attempts < 3 and j.source_item_revision_id = si.current_revision_id
     and s.is_active and s.terms_reviewed_at is not null and r.metadata->>'ai_ready' = 'true'
     and si.published_at is not null and si.relevance_status <> 'irrelevant'
     and length(r.content_text) between 10 and 80000
     and not exists (select 1 from public.reports rep where rep.source_item_id = si.id)
     and (j.status in ('pending', 'failed') or (j.status = 'claimed' and j.lease_until < now()))
   order by j.created_at, j.id limit p_limit for update of j skip locked
 loop
   update public.draft_jobs set status = 'claimed', claimed_by = p_worker, claimed_at = now(),
     lease_until = now() + interval '30 minutes', attempts = attempts + 1,
     last_error = null, updated_at = now() where id = v_job.id;
   v_result = v_result || (select jsonb_build_array(jsonb_build_object(
     'job_id', j.id, 'revision_id', r.id, 'input_hash', j.input_hash,
     'instruction_version', j.instruction_version, 'lease_until', j.lease_until,
     'title_original', si.title_original, 'official_url', si.canonical_url,
     'published_at', si.published_at, 'content_text', r.content_text,
     'metadata', r.metadata, 'source_name', s.name))
     from public.draft_jobs j
     join public.source_item_revisions r on r.id = j.source_item_revision_id
     join public.source_items si on si.id = j.source_item_id
     join public.sources s on s.id = si.source_id where j.id = v_job.id);
 end loop;
 return v_result;
end; $$;

