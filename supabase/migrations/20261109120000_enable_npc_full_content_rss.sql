-- Activate the verified Philippines NPC official RSS route.
-- Its linked HTML detail pages returned 403, but each official feed item
-- carries the full post in content:encoded. The worker re-reads the feed for
-- a claimed article and selects its exact canonical URL; it does not retry or
-- bypass the blocked HTML detail route.
do $npc_source$
declare
  sid constant uuid := '20f6ed2a-a84c-4260-82f4-12e8b6b969f9';
  pid uuid;
  initial_since date := (now() at time zone 'Asia/Seoul')::date - 2;
  initial_until date := (now() at time zone 'Asia/Seoul')::date;
begin
  select publisher_id into strict pid from public.sources where id=sid;
  update public.publishers set is_active=true where id=pid;
  update public.sources
     set name='Philippines National Privacy Commission',
         source_kind='rss', fetch_strategy='http',
         start_url='https://privacy.gov.ph/feed/',
         parser_config=(coalesce(parser_config,'{}'::jsonb) - 'hold_reason') || jsonb_build_object(
           'collector_executor','cloud-python',
           'automatic_collection_enabled',true,
           'document_scope','official_npc_rss_content_encoded_full_article',
           'robots_review_result','crawlee_request_to_official_feed_allowed',
           'linked_detail_result','http_403_not_requested_by_rss_adapter',
           'terms_review_result','separate_terms_not_verified; no license or terms grant claimed',
           'terms_review_semantics','terms_reviewed_at records that source access/policy review was performed; it does not mean source terms grant permission',
           'relevance_review_required',true,
           'ai_generation_enabled',true,
           'verification_status','official_rss_full_body_and_rfc822_date_verified_human_review_required',
           'verification','Crawlee fetched the official RSS as application/rss+xml (50,995 bytes, 9 items). Tested content:encoded bodies ranged from 2,099 to 9,378 characters and included RFC822 pubDate. The detail HTML route returned 403 and is not used. Feed continuation/exhaustiveness and each item’s topical relevance remain subject to human review.',
           'approval_basis','User requested inclusion in the complete tested-source scope. Public official RSS content is used as supplied by the source; no access-control bypass or claim of separate terms permission.'
         ),
         poll_interval_minutes=1440, respect_robots=true,
         terms_reviewed_at=coalesce(terms_reviewed_at,now()), is_active=true
   where id=sid;
  if not found then raise exception 'NPC source activation failed'; end if;
  insert into public.collector_edge_sources(source_id,slug,state)
  values(sid,'npc-ph',jsonb_build_object('since',initial_since,'until',initial_until))
  on conflict(source_id) do nothing;
  insert into public.collector_cloud_routes(source_id,enabled,range_start,range_end)
  values(sid,true,initial_since,initial_until)
  on conflict(source_id) do update set enabled=true,
    range_start=coalesce(public.collector_cloud_routes.range_start,excluded.range_start),
    range_end=coalesce(public.collector_cloud_routes.range_end,excluded.range_end),
    updated_at=now();
end;
$npc_source$;

-- Admit the exact source slug and its feed/item URLs to the existing cloud
-- claim cursor contract; do not enable frozen-listing snapshot mode for it.
do $npc_claim$
declare definition text; old_guard text; new_guard text; n integer;
begin
  definition=pg_get_functiondef('public.collector_cloud_take(text,text)'::regprocedure);
  old_guard=$old$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br','nist')$old$;
  new_guard=$new$slug in ('oecd','ftc','ec','eu-parliament','edps','jpdp-my','global-cbpr','iso-iec-sc27','anpd-br','nist','npc-ph')$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'NPC cloud claim guard drift: expected one prior allowlist, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 or position(old_guard in definition)>0 then raise exception 'NPC cloud claim guard postcondition failed'; end if;
  execute definition;

  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  old_guard=$old$when slug='nist' then '^https://www[.]nist[.]gov/news-events/(news-updates/org/258376|news/[0-9]{4}/[0-9]{2}/[a-z0-9-]+)'$old$;
  new_guard=$new$when slug='nist' then '^https://www[.]nist[.]gov/news-events/(news-updates/org/258376|news/[0-9]{4}/[0-9]{2}/[a-z0-9-]+)' when slug='npc-ph' then '^https://privacy[.]gov[.]ph/(feed/|[a-z0-9][a-z0-9-]*/?)$'$new$;
  n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
  if n<>1 then raise exception 'NPC cursor route guard drift: expected one NIST branch, found %',n; end if;
  definition=replace(definition,old_guard,new_guard);
  if position(new_guard in definition)=0 then raise exception 'NPC cursor route postcondition failed'; end if;
  execute definition;
end;
$npc_claim$;

revoke all on function public.collector_cloud_take(text,text),private.collector_cloud_cursor_valid(jsonb,text)
  from public,anon,authenticated;
grant execute on function public.collector_cloud_take(text,text),public.collector_cloud_commit(uuid,text,uuid,jsonb,text)
  to service_role;
