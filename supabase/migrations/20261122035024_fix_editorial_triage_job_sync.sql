-- Finalize the trigger behavior: only unattempted cancellations can reopen.
create or replace function public.sync_draft_job_with_editorial_triage()
returns trigger
language plpgsql
set search_path=pg_catalog,public as $function$
begin
  if tg_when='BEFORE' and new.decision='accepted' then
    update public.draft_jobs j
       set status='pending',claimed_by=null,claimed_at=null,lease_until=null,
           last_error=null,updated_at=clock_timestamp()
      from public.source_item_revisions r
     where r.id=new.source_item_revision_id
       and j.source_item_id=new.source_item_id
       and j.source_item_revision_id=r.id
       and j.input_hash=new.input_hash
       and j.status='cancelled' and j.attempts=0;
  elsif tg_when='AFTER' and new.decision in ('irrelevant','low_significance','needs_review') then
    update public.draft_jobs j
       set status='cancelled',claimed_by=null,claimed_at=null,lease_until=null,
           updated_at=clock_timestamp()
      from public.source_item_revisions r
     where r.id=new.source_item_revision_id
       and j.source_item_id=new.source_item_id
       and j.source_item_revision_id=r.id
       and j.input_hash=new.input_hash
       and j.status='pending';
  end if;
  return new;
end;
$function$;
