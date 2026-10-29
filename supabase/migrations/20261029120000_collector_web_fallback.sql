-- ChatGPT web is an independent executor, not a permissive HTTP fallback.
-- Activating an attempt does not verify full-body access or period coverage.
do $register$
declare c jsonb; slug text;
begin
 for slug,c in select key,value from jsonb_each($routes${"edps": {"source_id": "2239debc-9ce2-5cfd-99f3-c555b7cd0c94", "routes": ["^https://www[.]edps[.]europa[.]eu/(press-publications/|system/files/)[^?#]+$"], "discovery": ["https://www.edps.europa.eu/feed/news_en", "https://www.edps.europa.eu/press-publications/press-news/press-releases_en"], "verification": "RSS discovery verified; substantive linked body access remains blocked"}, "hk-pcpd": {"source_id": "d4d64477-c45b-5f10-883d-374a7cd0ddfe", "routes": ["^https://www[.]pcpd[.]org[.]hk/english/(news_events/media_statements/press_[0-9]+[.]html|whatsnew/[0-9]+[.]html)$", "^https://www[.]info[.]gov[.]hk/gia/general/[0-9]{6}/[0-9]{2}/P[0-9]+[.]htm$"], "discovery": ["https://www.pcpd.org.hk/english/news_events/media_statements/index.html", "https://www.info.gov.hk/gia/general/today.htm"], "verification": "Official government republication body verified; not all PCPD releases are republished"}, "eu-council": {"source_id": "f4dc010a-0c02-5b24-8799-bd64f20b2e25", "routes": ["^https://www[.]consilium[.]europa[.]eu/en/press/press-releases/[0-9]{4}/[0-9]{2}/[0-9]{2}/[^?#]+/$"], "discovery": ["https://www.consilium.europa.eu/en/press/press-releases/"], "verification": "Official full article and publication date verified through web open"}, "eur-lex": {"source_id": "76ed096b-7297-5e5a-b85d-bda00b89a82f", "routes": ["^https://eur-lex[.]europa[.]eu/content/(news|development)/[^/?#]+[.]html$"], "discovery": ["https://eur-lex.europa.eu/content/news/index.html", "https://eur-lex.europa.eu/content/development/index.html"], "verification": "Challenge remains; developments are site updates; no verified in-scope full article"}}$routes$::jsonb) loop
  update public.sources set is_active=true,terms_reviewed_at=coalesce(terms_reviewed_at,now()),
   parser_config=parser_config || jsonb_build_object('collector_executor','chatgpt-web','hold_reason',null,
    'web_routes',c->'routes','web_discovery',c->'discovery','verification',c->>'verification',
    'automatic_collection_enabled',false,'lookback_days',3,'coverage_complete',false)
   where id=(c->>'source_id')::uuid;
  update public.publishers set is_active=true where id=(select publisher_id from public.sources where id=(c->>'source_id')::uuid);
 end loop;
end; $register$;

-- Exclude web rows both before queue creation and at selection. Preserve every
-- existing source state, queued message, lease and failed URL.
do $routing$
declare definition text; target text;
begin
 definition=pg_get_functiondef('public.collector_edge_enqueue(text)'::regprocedure);
 target='where not queued for update skip locked';
 if position(target in definition)=0 then raise exception 'enqueue routing drift'; end if;
 execute replace(definition,target,
  $replacement$where not queued and not exists(select 1 from public.sources ws where ws.id=collector_edge_sources.source_id and ws.parser_config->>'collector_executor'='chatgpt-web') for update skip locked$replacement$);
 definition=pg_get_functiondef('public.collector_edge_take()'::regprocedure);
 target='where q.vt<=now() and not exists';
 if position(target in definition)=0 then raise exception 'take routing drift'; end if;
 execute replace(definition,target,
  $replacement$where q.vt<=now() and not exists(select 1 from public.sources ws where ws.id=(q.message->>'source_id')::uuid and ws.parser_config->>'collector_executor'='chatgpt-web') and not exists$replacement$);
end; $routing$;

create function public.collector_web_ingest(p_slug text,p_document jsonb,p_execution_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare s public.sources; d jsonb=p_document; ev jsonb; url text; body text; title text;
 since_day date; until_day date; published_day date; observed_at timestamptz; saved jsonb; event_id uuid;
begin
 if p_slug not in ('edps','hk-pcpd','eu-council','eur-lex') or nullif(btrim(p_execution_id),'') is null
  or length(p_execution_id)>200 or jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>480000 then
  raise invalid_parameter_value using message='bounded web document required'; end if;
 select ss.* into strict s from public.sources ss join public.collector_edge_sources e on e.source_id=ss.id
  where e.slug=p_slug and ss.parser_config->>'collector_executor'='chatgpt-web';
 perform pg_advisory_xact_lock(hashtext('collector-web:'||s.id::text));
 if not (select enabled from public.collector_edge_control where singleton)
  or not public.collector_source_allowed(s.id) or not (public.collector_capacity()->>'can_write')::boolean then
  raise exception 'source approval or capacity gate failed'; end if;
 since_day=(d->>'since')::date; until_day=(d->>'until')::date; published_day=(d->>'published_date')::date;
 if since_day is null or until_day is null or until_day-since_day<>2
  or until_day>(now() at time zone 'Asia/Seoul')::date or published_day is null
  or published_day not between since_day and until_day then
  raise invalid_parameter_value using message='matching three calendar day window required'; end if;
 url=d->>'url'; body=btrim(d->>'body'); title=btrim(d->>'title'); ev=d->'evidence';
 if url is null or url ~ '[%\\[:space:]]' or url ~ '/[.]{1,2}(/|$)'
  or not exists(select 1 from jsonb_array_elements_text(s.parser_config->'web_routes') route where url ~ route) then
  raise invalid_parameter_value using message='canonical official article path required'; end if;
 if d->>'read_scope' is distinct from 'official_full_article' or ev->>'method' is distinct from 'web_open'
  or ev->'complete_body' is distinct from 'true'::jsonb or ev->'linked_content_verified'='false'::jsonb
  or nullif(btrim(ev->>'ref'),'') is null or nullif(btrim(ev->>'publication_locator'),'') is null
  or nullif(btrim(ev->>'body_locator'),'') is null then
  raise invalid_parameter_value using message='full official article evidence required; RSS discovery and snippets cannot be ingested'; end if;
 observed_at=(ev->>'accessed_at')::timestamptz;
 if observed_at is null or observed_at>clock_timestamp()+interval '5 minutes' or body is null
  or octet_length(body) not between 100 and 400000 or length(title) not between 1 and 1000
  or title is null or body ~* '^[[:space:]]*(verify that you.re not a robot|in order to continue, we need to verify|enable javascript|access denied|checking your browser|complete the captcha|javascript is disabled)' then
  raise invalid_parameter_value using message='actual article body and access time required'; end if;
 if p_slug='hk-pcpd' and (ev->>'issuer' is distinct from 'Office of the Privacy Commissioner for Personal Data'
  or nullif(btrim(ev->>'issuer_locator'),'') is null or body !~* 'privacy commissioner|PCPD') then
  raise invalid_parameter_value using message='PCPD issuer evidence required'; end if;
 select to_jsonb(x) into saved from public.ingest_source_item(s.id,null,url,title,
  published_day::timestamp at time zone 'UTC',null,observed_at,'en','press_release',body,
  encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex'),null,
  jsonb_build_object('collector_executor','chatgpt-web','read_scope','official_full_article','web_evidence',ev,
   'published_date_evidence',jsonb_build_object('value',published_day,'locator',ev->>'publication_locator'),
   'ai_ready',true,'requires_review',false,'coverage_complete',false),'trend-ko-v1') x;
 insert into public.collector_edge_events(source_id,execution_id,trigger_kind,started_at,result)
 values(s.id,p_execution_id,'web-validation',observed_at,jsonb_build_object('runtime','chatgpt-web','source',p_slug,
  'status','partial','stage','detail','since',since_day,'until',until_day,'url',url,'saved',saved,
  'coverage_complete',false,'korean_submission_complete',false)) returning id into event_id;
 return jsonb_build_object('saved',saved,'event_id',event_id,'coverage_complete',false,'korean_submission_complete',false);
end; $$;

create function public.collector_web_record_attempt(p_slug text,p_since date,p_until date,p_result jsonb,p_execution_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare sid uuid; eid uuid;
begin
 if p_slug not in ('edps','hk-pcpd','eu-council','eur-lex') or p_since is null or p_until is null
  or p_until-p_since<>2 or p_until>(now() at time zone 'Asia/Seoul')::date
  or jsonb_typeof(p_result) is distinct from 'object' or octet_length(p_result::text)>20000
  or nullif(btrim(p_execution_id),'') is null or length(p_execution_id)>200
  or p_result->>'status' not in ('partial','blocked','no_material_unverified') or p_result->>'status' is null then
  raise invalid_parameter_value using message='bounded web attempt required'; end if;
 select ss.id into strict sid from public.sources ss join public.collector_edge_sources e on e.source_id=ss.id
  where e.slug=p_slug and ss.parser_config->>'collector_executor'='chatgpt-web';
 if not (public.collector_capacity()->>'can_write')::boolean then raise exception 'storage gate failed'; end if;
 insert into public.collector_edge_events(source_id,execution_id,trigger_kind,started_at,result)
 values(sid,p_execution_id,'cloud-automation-summary',now(),
  jsonb_build_object('runtime','chatgpt-web','role','web-source-attempt','source',p_slug,
   'status',p_result->>'status','since',p_since,'until',p_until,'coverage_complete',false,
   'discovery',coalesce(p_result->'discovery','[]'::jsonb),'failed_urls',coalesce(p_result->'failed_urls','[]'::jsonb),
   'notice_only',coalesce(p_result->'notice_only','[]'::jsonb),'reason',p_result->>'reason',
   'korean_submission_complete',false)) returning id into eid;
 return eid;
end; $$;
revoke all on function public.collector_web_ingest(text,jsonb,text),public.collector_web_record_attempt(text,date,date,jsonb,text) from public,anon,authenticated;
grant execute on function public.collector_web_ingest(text,jsonb,text),public.collector_web_record_attempt(text,date,date,jsonb,text) to service_role;
