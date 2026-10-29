-- Editorial policy is independent of the unchanged trend-ko-v1 job contract.
create function public.collector_writing_policy() returns jsonb language sql stable
set search_path=pg_catalog as $$ select $policy${"policy_id": "privacy-report-ko-48-reference-v2", "job_instruction_version": "trend-ko-v1", "required_documents": ["docs/trend-report-style.md", "docs/trend-reference-reading-notes.md", "docs/translation/glossary.md"], "common_aspects": ["context", "action", "scope", "grounds", "follow_up"], "article_types": {"enforcement": ["conduct", "decision"], "court": ["question", "procedural_effect"], "legislation": ["changes", "exceptions", "legal_stage"], "guidance": ["practical_requirements", "document_status"], "report": ["method", "findings", "limits"], "technology": ["mechanism", "applications", "limits"], "event": ["substantive_outputs", "speaker_attribution"], "cooperation": ["commitments", "implementation"], "brief_notice": []}, "editorial_checks": ["content", "flow", "legal_stage", "terminology", "numbers_dates", "reader_notes"], "thin_draft_warning": {"details_chars_below": 700, "source_chars_at_least": 1500}, "semantics": "Checks establish recorded review and source/draft binding, not truth, literary quality, human approval or publication. Length is a review signal, not a universal minimum.", "instruction_hashes": {"docs/trend-report-style.md": "71c73f5b4e96bec88ba750dacfacd51ebab015653edcf7bd704063a1b1504f49", "docs/trend-reference-reading-notes.md": "06178ac572f978c7140c2fc4ab3e13955ee324b4b15d53a1fcdfe2d9f8f1452f", "docs/translation/glossary.md": "50cd3d64f063088e1e11b7e98537b19609b383bd864c31be98c828317726f5f3"}}$policy$::jsonb; $$;
revoke all on function public.collector_writing_policy() from public,anon,authenticated;
grant execute on function public.collector_writing_policy() to service_role;

create function private.validate_trend_writing_review(d jsonb,revision_id uuid,input_hash text,source_body text,official_url text,source_metadata jsonb default '{}'::jsonb)
returns void language plpgsql set search_path=pg_catalog,public,extensions as $$
declare p jsonb=public.collector_writing_policy(); r jsonb=d->'writing_review'; s jsonb; c jsonb; e jsonb;
 aspect text; check_name text; known_url text; idx jsonb; paragraph text; kind text; expected_hash text; observed_at timestamptz;
begin
 if r->'instruction_hashes' is distinct from p->'instruction_hashes' then raise exception 'Writing review instruction hashes mismatch' using errcode='22023'; end if;
 if jsonb_typeof(r) is distinct from 'object' or r->>'policy_id' is distinct from p->>'policy_id'
  or r->>'source_revision_id' is distinct from revision_id::text or r->>'input_hash' is distinct from input_hash then
  raise exception 'Writing review policy or source binding is missing or stale' using errcode='22023'; end if;
 expected_hash=encode(extensions.digest(convert_to((d->>'title_ko')||E'\n'||(d->>'summary_ko')||E'\n'||(d->>'details_ko'),'UTF8'),'sha256'),'hex');
 if r->>'draft_hash' is distinct from expected_hash then raise exception 'Writing review draft hash mismatch' using errcode='22023'; end if;
 kind=r->>'article_type';
 if kind is null or not (p->'article_types' ? kind) then raise exception 'Writing review article type required' using errcode='22023'; end if;
 s=r->'source_reading';
 if jsonb_typeof(s) is distinct from 'object' or s->>'url' is distinct from official_url
  or s->>'read_scope' is distinct from 'full_official_body' or jsonb_typeof(s->'locator') is distinct from 'string' or length(btrim(coalesce(s->>'locator','')))<12
  or jsonb_typeof(s->'reviewed_at') is distinct from 'string' or nullif(btrim(s->>'reviewed_at'),'') is null then
  raise exception 'Writing review complete official source reading required' using errcode='22023'; end if;
 observed_at=(s->>'reviewed_at')::timestamptz;
 if not isfinite(observed_at) or observed_at>clock_timestamp()+interval '5 minutes' then raise exception 'Writing review actual reading time required' using errcode='22023'; end if;
 if jsonb_typeof(r->'supplements') is distinct from 'array' then raise exception 'Writing review supplements required' using errcode='22023'; end if;
 for s in select value from jsonb_array_elements(r->'supplements') loop
  if jsonb_typeof(s) is distinct from 'object' or coalesce(s->>'url','') !~ '^https://'
   or jsonb_typeof(s->'material') is distinct from 'boolean' or coalesce(s->>'status','') not in ('read','unavailable','not_material')
   or jsonb_typeof(s->'reason') is distinct from 'string' or length(btrim(coalesce(s->>'reason','')))<12 or (s->>'status'='read' and (jsonb_typeof(s->'locator') is distinct from 'string' or length(btrim(coalesce(s->>'locator','')))<12 or s->'complete' is distinct from 'true'::jsonb or coalesce(s->>'read_scope','') not in ('full_document','complete_relevant_sections')))
   or (s->'material'='true'::jsonb and s->>'status'<>'read') then
   raise exception 'Writing review material attachment missing or incomplete' using errcode='22023'; end if;
 end loop;
 for known_url in select distinct case when jsonb_typeof(x)='string' then x#>>'{}' else x->>'url' end
  from jsonb_array_elements((case when jsonb_typeof(source_metadata->'related_documents')='array' then source_metadata->'related_documents' else '[]'::jsonb end)||
   (case when jsonb_typeof(source_metadata->'unread_attachments')='array' then source_metadata->'unread_attachments' else '[]'::jsonb end)) x loop
  if known_url is not null and not exists(select 1 from jsonb_array_elements(r->'supplements') q where q->>'url'=known_url) then
   raise exception 'Writing review known attachment classification required' using errcode='22023'; end if;
 end loop;
 if jsonb_typeof(r->'coverage') is distinct from 'array' then raise exception 'Writing review coverage required' using errcode='22023'; end if;
 if (select count(*)<>count(distinct value->>'aspect') from jsonb_array_elements(r->'coverage')) then
  raise exception 'Writing review duplicate coverage dimensions' using errcode='22023'; end if;
 for aspect in select jsonb_array_elements_text((p->'common_aspects')||(p->'article_types'->kind)) loop
  select value into c from jsonb_array_elements(r->'coverage') where value->>'aspect'=aspect;
  if c is null then raise exception 'Writing review coverage dimension missing: %',aspect using errcode='22023'; end if;
  if c->>'status'='covered' then
   if jsonb_typeof(c->'detail') is distinct from 'string' or length(btrim(coalesce(c->>'detail','')))<12 or jsonb_typeof(c->'evidence_indices') is distinct from 'array' then
    raise exception 'Writing review concrete coverage evidence required' using errcode='22023'; end if;
   if jsonb_array_length(c->'evidence_indices')=0 then raise exception 'Writing review coverage evidence required' using errcode='22023'; end if;
   for idx in select value from jsonb_array_elements(c->'evidence_indices') loop
    if jsonb_typeof(idx) is distinct from 'number' or idx::text !~ '^[0-9]+$' then
     raise exception 'Writing review evidence index invalid' using errcode='22023'; end if;
    if idx::numeric>=jsonb_array_length(d->'evidence') then raise exception 'Writing review evidence index invalid' using errcode='22023'; end if;
   end loop;
  elsif c->>'status' is distinct from 'not_applicable' or aspect in ('action','scope') or jsonb_typeof(c->'reason') is distinct from 'string' or length(btrim(coalesce(c->>'reason','')))<12 then
   raise exception 'Writing review specific absence reason required' using errcode='22023';
  end if;
 end loop;
 if jsonb_typeof(r->'editorial_review') is distinct from 'object' then raise exception 'Writing review editorial review required' using errcode='22023'; end if;
 for check_name in select jsonb_array_elements_text(p->'editorial_checks') loop
  if jsonb_typeof(r->'editorial_review'->check_name) is distinct from 'string'
   or length(btrim(coalesce(r->'editorial_review'->>check_name,'')))<12 then
   raise exception 'Writing review concrete editorial check required: %',check_name using errcode='22023'; end if;
 end loop;
 if length(source_body)>=(p#>>'{thin_draft_warning,source_chars_at_least}')::integer
  and length(d->>'details_ko')<(p#>>'{thin_draft_warning,details_chars_below}')::integer
  and (jsonb_typeof(r->'brevity_reason') is distinct from 'string' or length(btrim(coalesce(r->>'brevity_reason','')))<20) then
  raise exception 'Writing review brevity reason required for rich source' using errcode='22023'; end if;
 if (d->>'summary_ko') ~ '[\r\n]' then raise exception 'Writing review summary must be one paragraph' using errcode='22023'; end if;
 for paragraph in select unnest(regexp_split_to_array(btrim(replace(d->>'details_ko',E'\r\n',E'\n')),E'\n[[:space:]]*\n')) loop
  if paragraph !~ '^- [^[:space:]][^\r\n]*$' then raise exception 'Writing review report paragraph format required' using errcode='22023'; end if;
 end loop;
end; $$;
revoke all on function private.validate_trend_writing_review(jsonb,uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;

do $guard$
declare definition text; target text;
begin
 definition=pg_get_functiondef('public.submit_trend_draft(uuid,text,jsonb)'::regprocedure);
 target='-- Any pre-existing report may contain human work; never replace it automatically.';
 if position(target in definition)=0 then raise exception 'draft submit contract drift'; end if;
 definition=replace(definition,target,
  'perform private.validate_trend_writing_review(p_draft,r.id,r.content_hash,r.content_text,si.canonical_url,r.metadata);'||E'\n '||target);
 target=$target$'limitations',p_draft->'limitations','source_metadata',r.metadata$target$;
 if position(target in definition)=0 then raise exception 'draft metadata contract drift'; end if;
 definition=replace(definition,target,
  $replacement$'limitations',p_draft->'limitations','source_metadata',r.metadata,'writing_review',p_draft->'writing_review','writing_policy_id',p_draft#>>'{writing_review,policy_id}'$replacement$);
 execute definition;
end; $guard$;
