-- Make a source-specific deduplication gate visible to the editorial caller.
-- Editorial acceptance must not pretend a draft job exists when a collector's
-- independent duplicate filter still needs its own decision.
do $$
declare definition text; original text; old_return text; new_return text;
begin
  definition=pg_get_functiondef(
    'public.record_trend_editorial_triage(uuid,uuid,uuid,text,text,text,text,jsonb)'::regprocedure
  );
  original=definition;
  old_return=$old$return jsonb_build_object('status',retained->>'status','decision','accepted',
      'decision_id',saved.id,'item_id',item.id,'revision_id',revision.id,'job_id',retained->>'job_id');$old$;
  new_return=$new$if retained->>'job_id' is null then
      return jsonb_build_object('status',case when item.metadata->>'collector'='scrapling-separate-v1'
        then 'source_filter_required' else 'draft_job_missing' end,
        'reason',case when item.metadata->>'collector'='scrapling-separate-v1'
          then 'scrapling_duplicate_filter_decision_required' else 'accepted_item_draft_job_not_created' end,
        'decision','accepted','decision_id',saved.id,'item_id',item.id,'revision_id',revision.id);
    end if;
    return jsonb_build_object('status',retained->>'status','decision','accepted',
      'decision_id',saved.id,'item_id',item.id,'revision_id',revision.id,'job_id',retained->>'job_id');$new$;
  definition=replace(definition,old_return,new_return);
  if definition=original or position('scrapling_duplicate_filter_decision_required' in definition)=0 then
    raise exception 'editorial triage accepted-return definition changed; review required';
  end if;
  execute definition;
end $$;
