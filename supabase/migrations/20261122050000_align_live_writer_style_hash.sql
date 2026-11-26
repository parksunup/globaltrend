-- The current main writing guide hashes to 71c73f5b4e96bec88ba750dacfacd51ebab015653edcf7bd704063a1b1504f49.
-- Keep the existing DB-only editorial checks and writer instructions; update
-- only the style-document hash when the stale value is present.
do $migration$
declare
  policy jsonb := public.collector_writing_policy();
  definition text;
begin
  if policy->>'policy_id' <> 'privacy-report-ko-48-reference-v2' then
    raise exception 'unexpected writing policy ID';
  end if;
  if policy->'instruction_hashes'->>'docs/trend-report-style.md' = '71c73f5b4e96bec88ba750dacfacd51ebab015653edcf7bd704063a1b1504f49' then
    return;
  end if;
  if policy->'instruction_hashes'->>'docs/trend-report-style.md' <> '1b1d0bf1cba81f340a40833b163983d4a99f5b94a9608a7de4b66f1d3b4c7d25' then
    raise exception 'unexpected writing guide hash';
  end if;
  select pg_get_functiondef('public.collector_writing_policy()'::regprocedure)
    into definition;
  if length(definition) - length(replace(definition, '1b1d0bf1cba81f340a40833b163983d4a99f5b94a9608a7de4b66f1d3b4c7d25', ''))
     <> length('1b1d0bf1cba81f340a40833b163983d4a99f5b94a9608a7de4b66f1d3b4c7d25') then
    raise exception 'expected exactly one old writing guide hash';
  end if;
  execute replace(definition, '1b1d0bf1cba81f340a40833b163983d4a99f5b94a9608a7de4b66f1d3b4c7d25', '71c73f5b4e96bec88ba750dacfacd51ebab015653edcf7bd704063a1b1504f49');
end
$migration$;
