-- Cloud scheduled writers may have the connected repository and Supabase MCP
-- tools without a repository shell. Keep the submission contract server-side.
create function public.collector_seal_trend_draft(p_draft jsonb)
returns jsonb
language plpgsql security invoker
set search_path = pg_catalog, extensions as $$
declare
  title text;
  summary text;
  details text;
  sealed_review jsonb;
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

do $extend_server_editorial_checks$
declare
  definition text;
  anchor text;
  replacement text;
begin
  definition = pg_get_functiondef(
    'private.validate_trend_writing_review(jsonb,uuid,text,text,text,jsonb)'::regprocedure
  );
  anchor = $anchor$if (d->>'summary_ko') ~ '[\r\n]' then raise exception 'Writing review summary must be one paragraph' using errcode='22023'; end if;$anchor$;
  if position(anchor in definition) = 0 then
    raise exception 'trend writing summary validation anchor drift';
  end if;
  replacement = anchor || E'\n' ||
    $checks$if (d->>'summary_ko') ~ '주요 내용' then raise exception 'Writing review summary must not contain a section label' using errcode='22023'; end if;
if (d->>'summary_ko') ~ '(합니다|했습니다|됩니다|이다|했다|한다|밝혔다|설명한다|안내한다|요구한다)[.!]?[[:space:]]*$' then raise exception 'Writing review summary must use report style' using errcode='22023'; end if;
if ((d->>'summary_ko') || E'\n' || (d->>'details_ko')) ~ '(검토 필요|확인 필요|일반화하지|추정하지|작성하지|원문을 정확히|사람 검토|검수 대기|샘플 ID|evidence_index)' then raise exception 'Writing review forbidden editorial directions in report body' using errcode='22023'; end if;$checks$;
  definition = replace(definition, anchor, replacement);
  execute definition;
end;
$extend_server_editorial_checks$;
