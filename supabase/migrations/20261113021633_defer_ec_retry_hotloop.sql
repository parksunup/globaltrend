-- Keep repeated EC response-type failures from hot-looping in the scheduled
-- cloud worker. Preserve the source cursor and retry the failed page later.
do $migration$
declare
  function_sql text;
  old_fragment text := $old$delay_seconds=case when slug='ec' and result->>'reason' in ('ec_listing_schema_or_page_changed','ec_listing_document_type_unverified') then 0 else 3600 end;$old$;
  new_fragment text := $new$delay_seconds=3600;$new$;
  occurrences integer;
begin
  function_sql := pg_get_functiondef(
    'public.collector_cloud_commit(uuid,text,uuid,jsonb,text)'::regprocedure
  );
  occurrences := (length(function_sql) -
    length(replace(function_sql, old_fragment, ''))) / length(old_fragment);
  if occurrences <> 2 then
    raise exception 'expected two EC retry-delay branches; found %', occurrences;
  end if;
  execute replace(function_sql, old_fragment, new_fragment);
end;
$migration$;
