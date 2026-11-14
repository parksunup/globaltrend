-- Large but non-empty source texts may be read in chunks by the writing
-- workflow; the claim gate must not silently park them at 80,000 characters.
do $$
declare definition text; original text;
begin
  definition=pg_get_functiondef('public.claim_trend_draft_jobs(text,integer,uuid)'::regprocedure);
  original=definition;
  definition=replace(definition,
    'and length(r.content_text) between 10 and 80000',
    'and nullif(btrim(r.content_text), '''') is not null');
  if definition=original
    or position('and nullif(btrim(r.content_text), '''') is not null' in definition)=0 then
    raise exception 'draft claim source-text gate changed; review required';
  end if;
  execute definition;
end $$;
