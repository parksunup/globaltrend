-- Draft writing is allowed for the exact 31 sources in the original-19 and
-- additional-12 cohorts. Collection activation and access-review fields are
-- intentionally left untouched; they govern collection, not writer eligibility.
create or replace function private.trend_draft_source_allowed(p_source_id uuid)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select coalesce(p_source_id = any (array[
    'a23ccfc6-4ad0-4ae7-bc85-0da35cfd2c1e'::uuid, -- edpb
    '50ec0b84-7c04-4f85-895e-50bf43219a98'::uuid, -- oecd
    '9a15e0d8-d980-41e2-8613-309a566de227'::uuid, -- curia
    '7e8b50e2-4dc6-4748-9de9-2d34c2380b47'::uuid, -- cnil
    'd7c96a28-2fca-49ad-a631-3a62cf0a03b9'::uuid, -- ico
    'b4a60458-7c61-485e-8de2-0d1126398f06'::uuid, -- dpc
    'ea7465ec-48fb-4b6e-8f82-7345da7e6a75'::uuid, -- pdpc
    '1f948872-529c-4db2-85af-4740d5f2bae3'::uuid, -- ppc
    '430bd32d-19b1-4752-8280-7b2d2acbda88'::uuid, -- ftc
    '5e5d193b-d98c-524a-9949-c35e8938caad'::uuid, -- ec
    'b064fc3c-766d-540f-9b65-3aa71e632663'::uuid, -- calprivacy
    'be57ed94-3216-5c00-bc22-63c1db22e5e0'::uuid, -- oaic
    '2cf414f7-68d3-59a0-98cb-8eaca785a9d0'::uuid, -- ca-opc
    'd4d64477-c45b-5f10-883d-374a7cd0ddfe'::uuid, -- hk-pcpd
    '0d91c2b9-8884-5533-95c2-09469c6db19b'::uuid, -- eu-parliament
    'f4dc010a-0c02-5b24-8799-bd64f20b2e25'::uuid, -- eu-council
    'd743f9ab-5194-5263-ab22-ef127336e2f2'::uuid, -- cn-cac
    'caa6854c-3e3a-5879-bbb2-fc66b648d923'::uuid, -- cn-tc260
    '5310c233-56e1-5a53-9ade-f7373140e4dc'::uuid, -- es-aepd
    '2239debc-9ce2-5cfd-99f3-c555b7cd0c94'::uuid, -- edps
    '8999005f-a0b3-4261-b073-bfce8f1834aa'::uuid, -- anpd-br
    '20f6ed2a-a84c-4260-82f4-12e8b6b969f9'::uuid, -- npc-ph
    '0db916d5-a210-4bd8-b5f3-97571fdd1e60'::uuid, -- jpdp-my
    '37bea39f-6ebe-4684-880d-19c715399c4b'::uuid, -- nist
    '4f056a27-ce76-40f8-b7ec-3eb21dc1d439'::uuid, -- iapp
    'e532813d-f9af-484b-ae30-1fa5e3cbe9cb'::uuid, -- fpf
    'e55fce7d-7b55-445d-9c8b-0841095ac7f1'::uuid, -- gpa
    'c1c51983-486c-4a6e-98ef-43eaaee88d5a'::uuid, -- g7-dpa
    'ed10f3a1-4d0d-4409-9ae4-7d320ae92abc'::uuid, -- global-cbpr
    'd5a9b352-8ebf-401a-8d83-378262cc0c12'::uuid, -- ripd
    '3fd924b0-3a38-4ba6-b9b2-5154ecca3a39'::uuid  -- iso-iec-sc27
  ]::uuid[]), false);
$$;
revoke all on function private.trend_draft_source_allowed(uuid) from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.trend_draft_source_allowed(uuid) to service_role;

-- Keep the server-side policy hashes tied to the current required documents.
-- A drift here blocks every packet before writing, even when the draft is valid.
create or replace function public.collector_writing_policy() returns jsonb language sql stable
set search_path=pg_catalog as $$ select $policy${"policy_id": "privacy-report-ko-48-reference-v2", "job_instruction_version": "trend-ko-v1", "required_documents": ["docs/trend-report-style.md", "docs/trend-reference-reading-notes.md", "docs/translation/glossary.md"], "common_aspects": ["context", "action", "scope", "grounds", "follow_up"], "article_types": {"enforcement": ["conduct", "decision"], "court": ["question", "procedural_effect"], "legislation": ["changes", "exceptions", "legal_stage"], "guidance": ["practical_requirements", "document_status"], "report": ["method", "findings", "limits"], "technology": ["mechanism", "applications", "limits"], "event": ["substantive_outputs", "speaker_attribution"], "cooperation": ["commitments", "implementation"], "brief_notice": []}, "editorial_checks": ["content", "flow", "legal_stage", "terminology", "numbers_dates", "reader_notes"], "thin_draft_warning": {"details_chars_below": 700, "source_chars_at_least": 1500}, "semantics": "Checks establish recorded review and source/draft binding, not truth, literary quality, human approval or publication. Length is a review signal, not a universal minimum.", "instruction_hashes": {"docs/trend-report-style.md": "71c73f5b4e96bec88ba750dacfacd51ebab015653edcf7bd704063a1b1504f49", "docs/trend-reference-reading-notes.md": "cb25f1ed918b6dfedbd7fb54716877ffb07bf5f033e49ccc90b35cdd0c94b4d8", "docs/translation/glossary.md": "50cd3d64f063088e1e11b7e98537b19609b383bd864c31be98c828317726f5f3"}}$policy$::jsonb; $$;
revoke all on function public.collector_writing_policy() from public,anon,authenticated;
grant execute on function public.collector_writing_policy() to service_role;

-- Apply the same allowlist to the queue claim path without changing its other
-- independent checks (current revision, publication date, relevance, duplicate,
-- content, retry and lease handling).
do $draft_claim_source_gate$
declare
  definition text;
  old_gate text := $old$and s.is_active and s.terms_reviewed_at is not null$old$;
  new_gate text := $new$and private.trend_draft_source_allowed(s.id)$new$;
begin
  definition := pg_get_functiondef('public.claim_trend_draft_jobs(text,integer,uuid)'::regprocedure);
  if position(old_gate in definition) = 0 then
    raise exception 'draft claim source eligibility anchor drift';
  end if;
  definition := replace(definition, old_gate, new_gate);
  execute definition;
end;
$draft_claim_source_gate$;

-- A failing item must not disappear after three attempts or be retried in a
-- tight loop. Use updated_at as a one-hour retry backoff and expose storage
-- protection as an error instead of an indistinguishable empty queue.
do $draft_claim_retry_and_storage$
declare
  definition text;
  old_limit text := $old$and j.attempts < 3 and j.source_item_revision_id = si.current_revision_id$old$;
  new_limit text := $new$and j.source_item_revision_id = si.current_revision_id$new$;
  old_status text := $old$(j.status in ('pending', 'failed') or (j.status = 'claimed' and j.lease_until < now()))$old$;
  new_status text := $new$(j.status = 'pending' or (j.status = 'failed' and j.updated_at <= now() - interval '1 hour') or (j.status = 'claimed' and j.lease_until < now()))$new$;
  old_storage text := $old$if pg_database_size(current_database()) >= 400000000 then return v_result; end if;$old$;
  new_storage text := $new$if pg_database_size(current_database()) >= 400000000 then raise insufficient_resources using message = format('draft_queue_storage_guard: database_bytes=%s stop_bytes=400000000', pg_database_size(current_database())); end if;$new$;
begin
  definition := pg_get_functiondef('public.claim_trend_draft_jobs(text,integer,uuid)'::regprocedure);
  if position(old_limit in definition) = 0 or position(old_status in definition) = 0 or position(old_storage in definition) = 0 then
    raise exception 'draft claim retry/storage anchor drift';
  end if;
  definition := replace(definition, old_limit, new_limit);
  definition := replace(definition, old_status, new_status);
  definition := replace(definition, old_storage, new_storage);
  execute definition;
end;
$draft_claim_retry_and_storage$;

-- Retention uses the same allowlist, but does not require an extraction flag or
-- a known publication date when the current source revision has usable text.
create or replace function public.collector_retain_for_draft(
  p_item_id uuid, p_revision_id uuid, p_input_hash text, p_reason text
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare i public.source_items; r public.source_item_revisions; j public.draft_jobs;
begin
  select * into strict i from public.source_items where id=p_item_id for update;
  select * into strict r from public.source_item_revisions where id=p_revision_id;
  if i.current_revision_id is distinct from r.id or r.source_item_id is distinct from i.id
     or r.content_hash is distinct from p_input_hash then
    raise exception 'retention_input_revision_mismatch' using errcode='22023';
  end if;
  if nullif(btrim(p_reason),'') is null then
    raise exception 'retention_reason_missing' using errcode='22023';
  end if;
  if nullif(btrim(r.content_text),'') is null then
    raise exception 'retention_source_text_empty' using errcode='22023';
  end if;
  if not private.trend_draft_source_allowed(i.source_id) then
    raise exception 'retention_source_not_in_draft_allowlist' using errcode='42501';
  end if;
  if exists(select 1 from public.reports where source_item_id=i.id) then
    return jsonb_build_object('status','existing_report_preserved','item_id',i.id);
  end if;
  insert into public.draft_jobs(source_item_id,source_item_revision_id,instruction_version,input_hash)
  values(i.id,r.id,'trend-ko-v1',r.content_hash)
  on conflict(source_item_id,instruction_version,input_hash)
  do update set source_item_revision_id=excluded.source_item_revision_id
  returning * into j;
  update public.source_items set relevance_status='relevant',
    metadata=metadata||jsonb_build_object('retention_decision','keep','retention_revision',r.id,
      'retention_reason',p_reason,'retained_at',now()),updated_at=now()
  where id=i.id;
  return jsonb_build_object('status','draft_required','item_id',i.id,'job_id',j.id,
    'revision_id',r.id,'input_hash',r.content_hash,'job_status',j.status,'attempts',j.attempts);
end; $$;

-- The retained-work selector follows the same unbounded retry/backoff contract.
create or replace function public.collector_claim_retained_draft(p_worker text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare target uuid; payload jsonb;
begin
  select j.id into target from public.draft_jobs j
  join public.source_items i on i.id=j.source_item_id
  where i.metadata->>'retention_decision'='keep' and i.relevance_status='relevant'
    and j.source_item_revision_id=i.current_revision_id
    and not exists(select 1 from public.reports where source_item_id=i.id)
    and (j.status='pending' or (j.status='failed' and j.updated_at<=now()-interval '1 hour')
      or (j.status='claimed' and j.lease_until<now()))
  order by j.created_at,j.id limit 1;
  if target is null then return jsonb_build_object('status','no_claimable_retained_job'); end if;
  payload=public.claim_trend_draft_jobs(p_worker,1,target);
  return jsonb_build_object('status',case when jsonb_array_length(payload)=1 then 'claimed' else 'blocked_or_leased' end,'jobs',payload);
end; $$;

-- Submission rechecks the same allowlist. Readiness and publication-date flags
-- are metadata, not a veto when the current revision contains usable evidence.
do $draft_submit_source_gate$
declare
  definition text;
  old_gate text := $old$not exists(select 1 from public.sources s where s.id=si.source_id and s.is_active and s.terms_reviewed_at is not null)$old$;
  new_gate text := $new$not private.trend_draft_source_allowed(si.source_id)$new$;
  old_readiness text := $old$or (r.metadata->>'ai_ready' is distinct from 'true' and si.published_at is not null and not j.date_absent_at_claim)$old$;
  old_quote text := $old$length(coalesce(evidence->>'quote',''))<12$old$;
begin
  definition := pg_get_functiondef('public.submit_trend_draft(uuid,text,jsonb)'::regprocedure);
  if position(old_gate in definition) = 0 or position(old_readiness in definition) = 0 or position(old_quote in definition) = 0 then
    raise exception 'draft submit source/readiness anchor drift';
  end if;
  definition := replace(definition, old_gate, new_gate);
  definition := replace(definition, old_readiness, '');
  definition := replace(definition, old_quote, $new$length(coalesce(evidence->>'quote',''))<1$new$);
  execute definition;
end;
$draft_submit_source_gate$;

-- Validate substantive review without requiring inaccessible linked material,
-- a complete official page, or arbitrary explanatory character counts.
create or replace function private.validate_trend_writing_review(
  d jsonb, revision_id uuid, input_hash text, source_body text,
  official_url text, source_metadata jsonb default '{}'::jsonb
) returns void language plpgsql set search_path=pg_catalog,public,extensions as $$
declare p jsonb=public.collector_writing_policy(); r jsonb=d->'writing_review'; s jsonb; c jsonb; aspect text; check_name text; idx jsonb; paragraph text; kind text; expected_hash text; observed_at timestamptz;
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
  or jsonb_typeof(s->'read_scope') is distinct from 'string' or nullif(btrim(s->>'read_scope'),'') is null
  or jsonb_typeof(s->'locator') is distinct from 'string' or nullif(btrim(s->>'locator'),'') is null
  or jsonb_typeof(s->'reviewed_at') is distinct from 'string' or nullif(btrim(s->>'reviewed_at'),'') is null then
  raise exception 'Writing review source and actual read scope required' using errcode='22023'; end if;
 observed_at=(s->>'reviewed_at')::timestamptz;
 if not isfinite(observed_at) or observed_at>clock_timestamp()+interval '5 minutes' then raise exception 'Writing review actual reading time required' using errcode='22023'; end if;
 if jsonb_typeof(r->'supplements') is distinct from 'array' then raise exception 'Writing review supplements array required' using errcode='22023'; end if;
 for s in select value from jsonb_array_elements(r->'supplements') loop
  if jsonb_typeof(s) is distinct from 'object' or coalesce(s->>'url','') !~ '^https://'
   or jsonb_typeof(s->'material') is distinct from 'boolean' or coalesce(s->>'status','') not in ('read','unavailable','not_material')
   or jsonb_typeof(s->'reason') is distinct from 'string' or nullif(btrim(s->>'reason'),'') is null
   or (s->>'status'='read' and (jsonb_typeof(s->'locator') is distinct from 'string' or nullif(btrim(s->>'locator'),'') is null
      or jsonb_typeof(s->'read_scope') is distinct from 'string' or nullif(btrim(s->>'read_scope'),'') is null)) then
   raise exception 'Writing review supplement record invalid' using errcode='22023'; end if;
 end loop;
 if jsonb_typeof(r->'coverage') is distinct from 'array' then raise exception 'Writing review coverage required' using errcode='22023'; end if;
 if (select count(*)<>count(distinct value->>'aspect') from jsonb_array_elements(r->'coverage')) then raise exception 'Writing review duplicate coverage dimensions' using errcode='22023'; end if;
 for aspect in select jsonb_array_elements_text((p->'common_aspects')||(p->'article_types'->kind)) loop
  select value into c from jsonb_array_elements(r->'coverage') where value->>'aspect'=aspect;
  if c is null then raise exception 'Writing review coverage dimension missing: %',aspect using errcode='22023'; end if;
  if c->>'status'='covered' then
   if jsonb_typeof(c->'detail') is distinct from 'string' or nullif(btrim(c->>'detail'),'') is null or jsonb_typeof(c->'evidence_indices') is distinct from 'array'
      or jsonb_array_length(c->'evidence_indices')=0 then raise exception 'Writing review concrete coverage evidence required' using errcode='22023'; end if;
   for idx in select value from jsonb_array_elements(c->'evidence_indices') loop
    if jsonb_typeof(idx) is distinct from 'number' or idx::text !~ '^[0-9]+$'
       or idx::numeric>=jsonb_array_length(d->'evidence') then raise exception 'Writing review evidence index invalid' using errcode='22023'; end if;
   end loop;
  elsif c->>'status'='not_applicable' then
   if jsonb_typeof(c->'reason') is distinct from 'string' or nullif(btrim(c->>'reason'),'') is null or btrim(c->>'reason') ~* '^(해당\s*없음|미해당|n/?a|not_applicable)$' then raise exception 'Writing review absence reason required' using errcode='22023'; end if;
  else raise exception 'Writing review coverage status invalid' using errcode='22023';
  end if;
 end loop;
 if jsonb_typeof(r->'editorial_review') is distinct from 'object' then raise exception 'Writing review editorial review required' using errcode='22023'; end if;
 for check_name in select jsonb_array_elements_text(p->'editorial_checks') loop
  if jsonb_typeof(r->'editorial_review'->check_name) is distinct from 'string' or nullif(btrim(r->'editorial_review'->>check_name),'') is null then raise exception 'Writing review editorial check required: %',check_name using errcode='22023'; end if;
 end loop;
 if (d->>'summary_ko') ~ '[\r\n]' then raise exception 'Writing review summary must be one paragraph' using errcode='22023'; end if;
 if (d->>'summary_ko') ~ '주요 내용' then raise exception 'Writing review summary must not contain a section label' using errcode='22023'; end if;
 if (d->>'summary_ko') ~ '(합니다|했습니다|됩니다|이다|했다|한다|밝혔다|설명한다|안내한다|요구한다)[.!]?[[:space:]]*$' then raise exception 'Writing review summary must use report style' using errcode='22023'; end if;
 if ((d->>'summary_ko') || E'\n' || (d->>'details_ko')) ~ '(검토 필요|확인 필요|일반화하지|추정하지|작성하지|원문을 정확히|사람 검토|검수 대기|샘플 ID|evidence_index)' then raise exception 'Writing review forbidden editorial directions in report body' using errcode='22023'; end if;
 if ((coalesce(d->>'summary_ko','')) || E'\n' || coalesce(d->>'details_ko','')) ~* '(^|\n)[[:space:]]*-[[:space:]]*(context|action|scope|grounds|follow_up|목적|조치|대상|근거|후속조치|범위)[[:space:]]*[:：][[:space:]]*(해당[[:space:]]*없음|미해당|n/?a|not_applicable)([[:space:]]|$)' then raise exception 'Writing review coverage must stay out of report body' using errcode='22023'; end if;
 for paragraph in select unnest(regexp_split_to_array(btrim(replace(d->>'details_ko',E'\r\n',E'\n')),E'\n[[:space:]]*\n')) loop
  if paragraph !~ '^- [^[:space:]][^\r\n]*$' then raise exception 'Writing review report paragraph format required' using errcode='22023'; end if;
 end loop;
end; $$;
revoke all on function private.validate_trend_writing_review(jsonb,uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;
-- Prevent the internal coverage checklist from leaking into the public-facing
-- report text. The review status and reason are stored separately in JSON.
create or replace function public.collector_seal_trend_draft(p_draft jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions
as $$
declare
  title text;
  summary text;
  details text;
  sealed_review jsonb;
  body_text text;
begin
  if jsonb_typeof(p_draft) is distinct from 'object'
     or jsonb_typeof(p_draft->'writing_review') is distinct from 'object' then
    raise invalid_parameter_value using message = 'trend_draft_payload_or_review_invalid';
  end if;
  title = p_draft->>'title_ko';
  summary = p_draft->>'summary_ko';
  details = p_draft->>'details_ko';
  if nullif(btrim(title), '') is null or length(title) > 500
     or nullif(btrim(summary), '') is null or length(summary) > 3000
     or nullif(btrim(details), '') is null or length(details) > 20000 then
    raise invalid_parameter_value using message = 'trend_draft_required_text_invalid';
  end if;
  body_text = summary || E'\n' || details;
  if body_text ~* '(^|\n)[[:space:]]*-[[:space:]]*(context|action|scope|grounds|follow_up|목적|조치|대상|근거|후속조치|범위)[[:space:]]*[:：][[:space:]]*(해당[[:space:]]*없음|미해당|n/?a|not_applicable)([[:space:]]|$)' then
    raise invalid_parameter_value using message = 'writing_review_coverage_must_not_appear_in_report_body';
  end if;

  sealed_review = (p_draft->'writing_review') || jsonb_build_object(
    'draft_hash', encode(extensions.digest(
      convert_to(title || E'\n' || summary || E'\n' || details, 'UTF8'), 'sha256'
    ), 'hex')
  );
  return jsonb_set(p_draft, '{writing_review}', sealed_review, true);
end;
$$;
revoke all on function public.collector_seal_trend_draft(jsonb) from public, anon, authenticated;
grant execute on function public.collector_seal_trend_draft(jsonb) to service_role;
