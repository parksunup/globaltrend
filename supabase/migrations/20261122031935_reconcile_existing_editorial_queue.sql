-- Apply the current decision only to an exact source revision and input hash.
-- Existing reports are never rewritten, and attempted jobs are not retried.
with current_decision as (
  select distinct on (source_item_id,source_item_revision_id) *
    from public.trend_editorial_triage_decisions
   order by source_item_id,source_item_revision_id,created_at desc,id desc
)
update public.draft_jobs j
   set status='pending',claimed_by=null,claimed_at=null,lease_until=null,
       last_error=null,updated_at=clock_timestamp()
  from current_decision d,
       public.source_items i,
       public.source_item_revisions r
 where d.decision='accepted'
   and d.source_item_id=i.id
   and d.source_item_revision_id=i.current_revision_id
   and d.source_item_revision_id=r.id
   and r.source_item_id=i.id
   and d.input_hash=i.content_hash
   and d.input_hash=r.content_hash
   and j.source_item_id=i.id
   and j.source_item_revision_id=r.id
   and j.input_hash=d.input_hash
   and j.status='cancelled'
   and j.attempts=0
   and not exists(select 1 from public.reports rep where rep.source_item_id=i.id);

with current_decision as (
  select distinct on (source_item_id,source_item_revision_id) *
    from public.trend_editorial_triage_decisions
   order by source_item_id,source_item_revision_id,created_at desc,id desc
)
update public.draft_jobs j
   set status='cancelled',claimed_by=null,claimed_at=null,lease_until=null,
       updated_at=clock_timestamp()
  from current_decision d,
       public.source_items i,
       public.source_item_revisions r
 where d.decision in ('irrelevant','low_significance','needs_review')
   and d.source_item_id=i.id
   and d.source_item_revision_id=i.current_revision_id
   and d.source_item_revision_id=r.id
   and r.source_item_id=i.id
   and d.input_hash=i.content_hash
   and d.input_hash=r.content_hash
   and j.source_item_id=i.id
   and j.source_item_revision_id=r.id
   and j.input_hash=d.input_hash
   and j.status='pending'
   and not exists(select 1 from public.reports rep where rep.source_item_id=i.id);
