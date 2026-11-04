DO $migration$
DECLARE definition text; old_rule text := 'if result->>''status''=''failed'' then delay_seconds=3600;'; new_rule text := 'if result->>''status''=''failed'' then delay_seconds=case when slug=''ec'' and result->>''reason'' in (''ec_listing_schema_or_page_changed'',''ec_listing_document_type_unverified'') then 0 else 3600 end;';
BEGIN
 definition:=pg_get_functiondef('public.collector_cloud_commit(uuid,text,uuid,jsonb,text)'::regprocedure);
 if position(old_rule in definition)=0 then raise exception 'expected retry rule not found'; end if;
 execute replace(definition,old_rule,new_rule);
END $migration$;
-- Repair-ready parser failures remain queued, immediately claimable. HTTP,
-- robots, rate limits and other source failures retain existing backoff.
