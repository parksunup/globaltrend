-- Keep draft_jobs aligned with the editorial queue.
-- A non-accepted editorial decision is terminal for this revision's draft job;
-- a later accepted decision may reopen only an unattempted cancelled job.
create or replace function public.sync_draft_job_with_editorial_triage()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if tg_op = 'BEFORE' and new.decision = 'accepted' then
    update public.draft_jobs j
       set status = 'pending',
           claimed_by = null,
           claimed_at = null,
           lease_until = null,
           last_error = null,
           updated_at = clock_timestamp()
      from public.source_item_revisions r
     where r.id = new.source_item_revision_id
       and j.source_item_id = new.source_item_id
       and j.source_item_revision_id = r.id
       and j.input_hash = new.input_hash
       and j.status = 'cancelled'
       and j.attempts = 0;
  elsif tg_op = 'AFTER' and new.decision in ('irrelevant', 'low_significance', 'needs_review') then
    update public.draft_jobs j
       set status = 'cancelled',
           claimed_by = null,
           claimed_at = null,
           lease_until = null,
           updated_at = clock_timestamp()
      from public.source_item_revisions r
     where r.id = new.source_item_revision_id
       and j.source_item_id = new.source_item_id
       and j.source_item_revision_id = r.id
       and j.input_hash = new.input_hash
       and j.status = 'pending';
  end if;
  return new;
end;
$function$;

drop trigger if exists editorial_triage_reopen_unattempted_draft on public.trend_editorial_triage_decisions;
create trigger editorial_triage_reopen_unattempted_draft
before insert on public.trend_editorial_triage_decisions
for each row execute function public.sync_draft_job_with_editorial_triage();

drop trigger if exists editorial_triage_cancel_nonaccepted_draft on public.trend_editorial_triage_decisions;
create trigger editorial_triage_cancel_nonaccepted_draft
after insert on public.trend_editorial_triage_decisions
for each row execute function public.sync_draft_job_with_editorial_triage();

revoke all on function public.sync_draft_job_with_editorial_triage() from public, anon, authenticated;

-- Verify the status transition contract without changing production rows.
do $verify_editorial_triage_draft_sync$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.draft_jobs'::regclass
      and conname = 'draft_jobs_status_check'
      and pg_get_constraintdef(oid) like '%cancelled%'
  ) then
    raise exception 'draft_jobs must support the cancelled terminal state';
  end if;
end;
$verify_editorial_triage_draft_sync$;
