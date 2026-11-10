-- Keep the cloud writer's server policy hashes aligned with the canonical
-- writing-policy JSON on main. The preceding route migration may have applied
-- either the earlier or intermediate document hashes, so accept only those
-- known states and fail closed on any unexpected drift.
do $sync_writer_policy$
declare
  definition text;
  style_hash text := '71c73f5b4e96bec88ba750dacfacd51ebab015653edcf7bd704063a1b1504f49';
  old_style_hash text := 'b9c46b82180f584e4ffee3c2b9a4e36ef1e16d2c34ad326e3d3fef4c4a7f7d03';
  notes_hash text := 'cb25f1ed918b6dfedbd7fb54716877ffb07bf5f033e49ccc90b35cdd0c94b4d8';
  old_notes_hash text := '06178ac572f978c7140c2fc4ab3e13955ee324b4b15d53a1fcdfe2d9f8f1452f';
  intermediate_notes_hash text := '52b75c5c25517a7f1b93aef462e829fe50d8eb07c17bf864d879f8fe03823599';
  glossary_hash text := '50cd3d64f063088e1e11b7e98537b19609b383bd864c31be98c828317726f5f3';
  old_glossary_hash text := '2441ae7c18d2f5e4e0e906587512ebb6211b6b42b5e02a81bbc5179f684f6d78';
  style_count integer;
  old_style_count integer;
  notes_count integer;
  old_notes_count integer;
  intermediate_notes_count integer;
  glossary_count integer;
  old_glossary_count integer;
begin
  definition = pg_get_functiondef('public.collector_writing_policy()'::regprocedure);

  style_count = (length(definition) - length(replace(definition, style_hash, ''))) / length(style_hash);
  old_style_count = (length(definition) - length(replace(definition, old_style_hash, ''))) / length(old_style_hash);
  if style_count = 1 and old_style_count = 0 then
    null;
  elsif style_count = 0 and old_style_count = 1 then
    definition = replace(definition, old_style_hash, style_hash);
  else
    raise exception 'writer policy style hash drift: current %, intermediate %', style_count, old_style_count;
  end if;

  notes_count = (length(definition) - length(replace(definition, notes_hash, ''))) / length(notes_hash);
  old_notes_count = (length(definition) - length(replace(definition, old_notes_hash, ''))) / length(old_notes_hash);
  intermediate_notes_count = (length(definition) - length(replace(definition, intermediate_notes_hash, ''))) / length(intermediate_notes_hash);
  if notes_count = 1 and old_notes_count = 0 and intermediate_notes_count = 0 then
    null;
  elsif notes_count = 0 and old_notes_count = 1 and intermediate_notes_count = 0 then
    definition = replace(definition, old_notes_hash, notes_hash);
  elsif notes_count = 0 and old_notes_count = 0 and intermediate_notes_count = 1 then
    definition = replace(definition, intermediate_notes_hash, notes_hash);
  else
    raise exception 'writer policy reference-notes hash drift: target %, old %, intermediate %',
      notes_count, old_notes_count, intermediate_notes_count;
  end if;

  glossary_count = (length(definition) - length(replace(definition, glossary_hash, ''))) / length(glossary_hash);
  old_glossary_count = (length(definition) - length(replace(definition, old_glossary_hash, ''))) / length(old_glossary_hash);
  if glossary_count = 1 and old_glossary_count = 0 then
    null;
  elsif glossary_count = 0 and old_glossary_count = 1 then
    definition = replace(definition, old_glossary_hash, glossary_hash);
  else
    raise exception 'writer policy glossary hash drift: current %, intermediate %', glossary_count, old_glossary_count;
  end if;

  if (length(definition) - length(replace(definition, style_hash, ''))) / length(style_hash) <> 1
     or (length(definition) - length(replace(definition, notes_hash, ''))) / length(notes_hash) <> 1
     or (length(definition) - length(replace(definition, glossary_hash, ''))) / length(glossary_hash) <> 1
     or position(old_style_hash in definition) > 0
     or position(old_notes_hash in definition) > 0
     or position(intermediate_notes_hash in definition) > 0
     or position(old_glossary_hash in definition) > 0 then
    raise exception 'writer policy hash synchronization postcondition failed';
  end if;

  execute definition;
end;
$sync_writer_policy$;

