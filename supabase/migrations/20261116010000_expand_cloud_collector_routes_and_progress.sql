-- Restore the current approved cloud collector source set in production and
-- remove the stale cursor byte guard that prevented ANPD checkpoints.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.collector_cloud_take(text,text)'::regprocedure);
  if position($old$slug in ('oecd','ftc','ec','eu-parliament')$old$ in definition)=0 then
    raise exception 'collector_cloud_take route guard changed';
  end if;
  definition := replace(definition,
    $old$slug in ('oecd','ftc','ec','eu-parliament')$old$,
    $new$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br','nist','npc-ph','nl-ap','ico','g7-dpa','vn-gov','hk-pcpd','eu-council')$new$);
  execute definition;

  definition := pg_get_functiondef('public.collector_set_progress(uuid,date,date,jsonb,boolean)'::regprocedure);
  if position('octet_length(coalesce(p_cursor::text' in definition)=0 then
    raise exception 'collector_set_progress cursor guard changed';
  end if;
  definition := regexp_replace(definition,
    '\s+or\s+octet_length\(coalesce\(p_cursor::text,\s*''''\)\)\s*>\s*4000', '', 'g');
  if position('octet_length(coalesce(p_cursor::text' in definition)>0 then
    raise exception 'collector_set_progress cursor cap removal failed';
  end if;
  execute definition;
end; $$;
