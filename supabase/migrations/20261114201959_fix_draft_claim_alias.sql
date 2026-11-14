-- Fix the qualified reference in versions of the claim function that record
-- date_absent_at_claim. Earlier installations do not contain that expression.
do $migration$
declare
  definition text;
  broken text := 'update public.draft_jobs set status';
begin
  definition := pg_get_functiondef('public.claim_trend_draft_jobs(text,integer,uuid)'::regprocedure);
  if position('date_absent_at_claim' in definition) > 0
     and position(broken in definition) > 0 then
    execute replace(definition, broken, 'update public.draft_jobs as j set status');
  end if;
end;
$migration$;
