CREATE OR REPLACE FUNCTION public.sync_draft_job_with_editorial_triage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_WHEN = 'BEFORE' AND NEW.decision = 'accepted' THEN
    UPDATE public.draft_jobs j
       SET status = 'pending',
           claimed_by = NULL,
           claimed_at = NULL,
           lease_until = NULL,
           last_error = NULL,
           updated_at = clock_timestamp()
      FROM public.source_item_revisions r
     WHERE r.id = NEW.source_item_revision_id
       AND j.source_item_id = NEW.source_item_id
       AND j.source_item_revision_id = r.id
       AND j.input_hash = NEW.input_hash
       AND j.status = 'cancelled'
       AND j.attempts = 0;
  ELSIF TG_WHEN = 'AFTER' AND NEW.decision IN ('irrelevant', 'low_significance', 'needs_review') THEN
    UPDATE public.draft_jobs j
       SET status = 'cancelled',
           claimed_by = NULL,
           claimed_at = NULL,
           lease_until = NULL,
           updated_at = clock_timestamp()
      FROM public.source_item_revisions r
     WHERE r.id = NEW.source_item_revision_id
       AND j.source_item_id = NEW.source_item_id
       AND j.source_item_revision_id = r.id
       AND j.input_hash = NEW.input_hash
       AND j.status = 'pending';
  END IF;
  RETURN NEW;
END;
$function$;

-- Reconcile existing pending jobs using the newest decision for the exact
-- current source revision. Jobs with prior attempts or an existing report
-- remain untouched for their existing recovery/manual-review procedures.
WITH latest AS (
  SELECT DISTINCT ON (d.source_item_id)
         d.source_item_id, d.source_item_revision_id, d.input_hash, d.decision
    FROM public.trend_editorial_triage_decisions d
   ORDER BY d.source_item_id, d.created_at DESC, d.id DESC
)
UPDATE public.draft_jobs j
   SET status = 'cancelled',
       claimed_by = NULL,
       claimed_at = NULL,
       lease_until = NULL,
       updated_at = clock_timestamp()
  FROM latest d
  JOIN public.source_items i ON i.id = d.source_item_id
 WHERE j.source_item_id = d.source_item_id
   AND j.source_item_revision_id = d.source_item_revision_id
   AND j.input_hash = d.input_hash
   AND i.current_revision_id = d.source_item_revision_id
   AND d.decision IN ('irrelevant', 'low_significance', 'needs_review')
   AND j.status = 'pending'
   AND j.attempts = 0
   AND NOT EXISTS (SELECT 1 FROM public.reports r WHERE r.source_item_id = i.id);
