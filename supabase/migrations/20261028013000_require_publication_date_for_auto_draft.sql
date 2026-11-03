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
     and si.published_at is not null
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

-- Existing 30-minute claims can predate this guard. A second gate applies
-- only to reports created by submit_trend_draft (which supplies job_id).
create function private.collector_require_auto_report_date() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if new.automation_metadata ? 'job_id' and not exists (
    select 1 from public.source_items si
    where si.id = new.source_item_id and si.published_at is not null
  ) then
    raise exception 'Auto draft requires a verified publication date'
      using errcode = '22023';
  end if;
  return new;
end; $$;
revoke all on function private.collector_require_auto_report_date() from public, anon, authenticated;
create trigger collector_require_auto_report_date_before_insert
  before insert on public.reports
  for each row execute function private.collector_require_auto_report_date();
