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

-- Retention for drafting uses the same exact source allowlist. Patch only the
-- source predicate so installed retention behavior and unrelated checks survive.
do $draft_retention_source_gate$
declare
  definition text;
  old_gate text := $old$not exists(select 1 from public.sources where id=i.source_id and is_active and terms_reviewed_at is not null)$old$;
  new_gate text := $new$not private.trend_draft_source_allowed(i.source_id)$new$;
begin
  definition := pg_get_functiondef('public.collector_retain_for_draft(uuid,uuid,text,text)'::regprocedure);
  if position(old_gate in definition) = 0 then
    old_gate := $old$not exists(select 1 from sources where id=i.source_id and is_active and terms_reviewed_at is not null)$old$;
  end if;
  if position(old_gate in definition) = 0 then
    raise exception 'draft retention source eligibility anchor drift';
  end if;
  definition := replace(definition, old_gate, new_gate);
  execute definition;
end;
$draft_retention_source_gate$;
-- Submission rechecks the allowlist. Keep the unrelated ai_ready/revision/hash,
-- lease, duplicate and server-side content checks as they are.
do $draft_submit_source_gate$
declare
  definition text;
  old_gate text := $old$not exists(select 1 from public.sources s where s.id=si.source_id and s.is_active and s.terms_reviewed_at is not null)$old$;
  new_gate text := $new$not private.trend_draft_source_allowed(si.source_id)$new$;
begin
  definition := pg_get_functiondef('public.submit_trend_draft(uuid,text,jsonb)'::regprocedure);
  if position(old_gate in definition) = 0 then
    raise exception 'draft submit source eligibility anchor drift';
  end if;
  definition := replace(definition, old_gate, new_gate);
  execute definition;
end;
$draft_submit_source_gate$;

-- A review item may be marked not_applicable for any common or article-specific
-- aspect when its internal reason is concrete. It remains inside writing_review.
do $draft_review_not_applicable$
declare
  definition text;
  old_branch text := $old$or aspect in ('action','scope') or jsonb_typeof(c->'reason') is distinct from 'string' or length(btrim(coalesce(c->>'reason','')))<12$old$;
  new_branch text := $new$jsonb_typeof(c->'reason') is distinct from 'string' or length(btrim(coalesce(c->>'reason','')))<12$new$;
begin
  definition := pg_get_functiondef('private.validate_trend_writing_review(jsonb,uuid,text,text,text,jsonb)'::regprocedure);
  if position(old_branch in definition) = 0 then
    raise exception 'writing review not-applicable validation anchor drift';
  end if;
  definition := replace(definition, old_branch, new_branch);
  execute definition;
end;
$draft_review_not_applicable$;

-- Enforce the same boundary in the validator called directly by submit_trend_draft,
-- so callers cannot bypass it by skipping the seal RPC.
do $draft_body_review_separation$
declare
  definition text;
  anchor text := $anchor$if (d->>'summary_ko') ~ '[\r\n]' then raise exception 'Writing review summary must be one paragraph' using errcode='22023'; end if;$anchor$;
  replacement text;
begin
  definition := pg_get_functiondef('private.validate_trend_writing_review(jsonb,uuid,text,text,text,jsonb)'::regprocedure);
  if position(anchor in definition) = 0 then
    raise exception 'writing review body-separation validation anchor drift';
  end if;
  replacement := $checks$if ((coalesce(d->>'summary_ko','')) || E'\n' || coalesce(d->>'details_ko','')) ~* '(^|\n)[[:space:]]*-[[:space:]]*(context|action|scope|grounds|follow_up|목적|조치|대상|근거|후속조치|범위)[[:space:]]*[:：][[:space:]]*(해당[[:space:]]*없음|미해당|n/?a|not_applicable)([[:space:]]|$)' then raise exception 'Writing review coverage must stay out of report body' using errcode='22023'; end if;$checks$ || E'\n' || anchor;
  definition := replace(definition, anchor, replacement);
  execute definition;
end;
$draft_body_review_separation$;
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
