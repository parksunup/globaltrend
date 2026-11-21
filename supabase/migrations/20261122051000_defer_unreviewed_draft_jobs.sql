-- Ingest every verified source revision, but create a draft job only for
-- already accepted items. New and changed items remain unscored until triage;
-- record_trend_editorial_triage/collector_retain_for_draft creates the job
-- after acceptance. Existing submitted reports and source revisions are kept.
do $migration$
declare
  function_definition text;
  old_block text := $old$
    insert into public.draft_jobs (
      source_item_id,
      source_item_revision_id,
      instruction_version,
      input_hash
    ) values (
      v_item.id,
      v_revision_id,
      btrim(p_instruction_version),
      p_content_hash
    )
    on conflict (source_item_id, instruction_version, input_hash) do update
    set source_item_revision_id = excluded.source_item_revision_id
    returning id into v_job_id;
$old$;
  new_block text := $new$
    if v_item.relevance_status = 'relevant' then
      insert into public.draft_jobs (
        source_item_id,
        source_item_revision_id,
        instruction_version,
        input_hash
      ) values (
        v_item.id,
        v_revision_id,
        btrim(p_instruction_version),
        p_content_hash
      )
      on conflict (source_item_id, instruction_version, input_hash) do update
      set source_item_revision_id = excluded.source_item_revision_id
      returning id into v_job_id;
    end if;
$new$;
begin
  select pg_get_functiondef(
    'public.ingest_source_item(uuid,text,text,text,timestamptz,date,timestamptz,text,text,text,text,text,jsonb,text)'::regprocedure
  ) into function_definition;

  if function_definition is null
     or length(function_definition) - length(replace(function_definition, old_block, ''))
        <> length(old_block) then
    raise exception 'ingest_source_item draft insertion shape changed; review migration';
  end if;

  execute replace(function_definition, old_block, new_block);
end
$migration$;
