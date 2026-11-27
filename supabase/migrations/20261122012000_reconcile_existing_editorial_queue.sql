-- Reconcile unattempted pending draft jobs with their latest decision
-- for the same source revision. The editorial decision record is preserved.
with latest_triage as (
  select distinct on (source_item_id, source_item_revision_id)
    source_item_id,
    source_item_revision_id,
    decision
  from public.trend_editorial_triage_decisions
  order by source_item_id, source_item_revision_id, created_at desc, id desc
)
update public.draft_jobs j
   set status = 'cancelled',
       claimed_by = null,
       claimed_at = null,
       lease_until = null,
       updated_at = clock_timestamp()
  from public.source_items s,
       latest_triage t
 where s.id = j.source_item_id
   and t.source_item_id = j.source_item_id
   and t.source_item_revision_id = j.source_item_revision_id
   and s.current_revision_id = j.source_item_revision_id
   and t.decision in ('irrelevant', 'low_significance', 'needs_review')
   and j.status = 'pending'
   and j.attempts = 0
   and not exists (
     select 1 from public.reports rep where rep.source_item_id = s.id
   );

do $verify_editorial_triage_backfill$
begin
  if exists (
    select 1
    from public.draft_jobs j
    join public.source_items s on s.id=j.source_item_id
    join lateral (
      select d.decision
      from public.trend_editorial_triage_decisions d
      where d.source_item_id=j.source_item_id
        and d.source_item_revision_id=j.source_item_revision_id
      order by d.created_at desc,d.id desc
      limit 1
    ) t on true
    where j.status='pending'
      and j.attempts=0
      and s.current_revision_id=j.source_item_revision_id
      and t.decision in ('irrelevant','low_significance','needs_review')
      and not exists(select 1 from public.reports rep where rep.source_item_id=s.id)
  ) then
    raise exception 'current non-accepted triage decisions still have pending draft jobs';
  end if;
end;
$verify_editorial_triage_backfill$;
