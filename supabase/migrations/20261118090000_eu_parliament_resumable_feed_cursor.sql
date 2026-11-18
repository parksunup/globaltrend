-- Keep the European Parliament's recent-document cursor bounded while allowing
-- the full official API feed to resume and skip unchanged document versions.
create or replace function private.collector_cloud_cursor_valid(c jsonb,slug text) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare field text;
begin
 if c='null'::jsonb then return true; end if;
 if c is null or jsonb_typeof(c)<>'object'
  or octet_length(c::text)>(case when slug='eu-parliament' then 250000 when slug in ('ec','ec-news') then 50000 else 4000 end)
  or jsonb_typeof(c->'page') is distinct from 'string'
  or (c->>'page') !~ (case when slug='ftc' then '^https://www[.]ftc[.]gov/' when slug='oecd' then '^https://www[.]oecd[.]org/' when slug='ec' then '^https://ec[.]europa[.]eu/commission/presscorner/' when slug='ec-news' then '^https://commission[.]europa[.]eu/' when slug='eu-parliament' then '^https://data[.]europarl[.]europa[.]eu/api/v2/' when slug='imda' then '^https://www[.]imda[.]gov[.]sg/resources/press-releases-factsheets-and-speeches([?]page=[0-9]+)?$' else '^$' end)
  or jsonb_typeof(c->'offset') is distinct from 'number' or (c->>'offset') !~ '^[0-9]{1,6}$' then return false; end if;
 if not private.collector_cloud_frozen_cursor_valid(c,slug) then return false; end if;
 foreach field in array array['failures','unknown_dates','excluded_unapproved_host_count'] loop
  if c ? field and (jsonb_typeof(c->field) is distinct from 'number' or (c->>field) !~ '^[0-9]{1,9}$') then return false; end if;
 end loop;
 if c ? 'had_pagination' and jsonb_typeof(c->'had_pagination') is distinct from 'boolean' then return false; end if;
 if c ? 'fingerprint' and (c->>'fingerprint') !~ '^[0-9a-f]{64}$' then return false; end if;
 if c ? 'snapshot_id' and (c->>'snapshot_id') !~ '^[0-9a-fA-F-]{36}$' then return false; end if;
 if c ? 'processed_url_hashes' then
  if jsonb_typeof(c->'processed_url_hashes') is distinct from 'array' or jsonb_array_length(c->'processed_url_hashes')>50 then return false; end if;
  if exists(select 1 from jsonb_array_elements(c->'processed_url_hashes') h(value)
   where jsonb_typeof(value) is distinct from 'string' or value#>>'{}' !~ '^[0-9a-f]{64}$') then return false; end if;
 end if;
 if c ? 'processed_document_hashes' then
  if slug<>'eu-parliament' or jsonb_typeof(c->'processed_document_hashes') is distinct from 'array'
   or jsonb_array_length(c->'processed_document_hashes')>4000 then return false; end if;
  if exists(select 1 from jsonb_array_elements(c->'processed_document_hashes') h(value)
   where jsonb_typeof(value) is distinct from 'string' or value#>>'{}' !~ '^[0-9a-f]{64}$') then return false; end if;
  if (select count(distinct value) from jsonb_array_elements(c->'processed_document_hashes'))<>jsonb_array_length(c->'processed_document_hashes') then return false; end if;
 end if;
 return true;
end; $$;

create or replace function private.collector_cloud_frozen_cursor_valid(c jsonb,slug text)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare u jsonb; path_pattern text; listing_pattern text; count_urls integer;
begin
 if not (c ? 'frozen_urls') then return not (c ? 'frozen_next'); end if;
 if slug not in ('ec','ec-news','eu-parliament') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;
 count_urls=jsonb_array_length(c->'frozen_urls');
 if count_urls<1 or octet_length(c::text)>(case when slug='eu-parliament' then 250000 else 50000 end)
  or not (c ? 'frozen_next') then return false; end if;
 if jsonb_typeof(c->'offset') is distinct from 'number' or (c->>'offset') !~ '^[0-9]{1,6}$'
  or (c->>'offset')::integer>count_urls then return false; end if;
 if slug='ec' then
  path_pattern='^https://ec[.]europa[.]eu/commission/presscorner/detail/en/(ip|qanda|statement|speech|memo|mex)_[0-9]{2}_[0-9]+$';
  listing_pattern='^https://ec[.]europa[.]eu/commission/presscorner/api/rss[?]language=en$';
 elsif slug='ec-news' then
  path_pattern='^https://commission[.]europa[.]eu/news-and-media/news/[a-z0-9][a-z0-9-]*-[0-9]{4}-[0-9]{2}-[0-9]{2}_en$';
  listing_pattern='^https://commission[.]europa[.]eu/node/2/rss_en$';
 else
  path_pattern='^https://data[.]europarl[.]europa[.]eu/api/v2/documents/[A-Za-z0-9][A-Za-z0-9._-]*$';
  listing_pattern='^https://data[.]europarl[.]europa[.]eu/api/v2/documents/feed[?]format=application%2[Ff]atom%2[Bb]xml$';
 end if;
 if c->>'page' !~ listing_pattern then return false; end if;
 if jsonb_typeof(c->'frozen_next') not in ('null','string') then return false; end if;
 if c->'frozen_next'<>'null'::jsonb
  and (slug='eu-parliament' or c->>'frozen_next' !~ listing_pattern) then return false; end if;
 for u in select value from jsonb_array_elements(c->'frozen_urls') loop
  if jsonb_typeof(u) is distinct from 'string' or u#>>'{}' !~ path_pattern
   or octet_length(u#>>'{}')>2048 then return false; end if;
 end loop;
 if (select count(distinct value) from jsonb_array_elements(c->'frozen_urls'))<>count_urls then return false; end if;
 return true;
end; $$;

-- The bundle contains one bounded source item plus the resumable feed cursor.
-- Permit larger API/PDF text only for the already approved EP route.
do $bundle_limit$
declare definition text; old_guard text; new_guard text; n integer;
begin
 definition=pg_get_functiondef('public.collector_cloud_commit(uuid,text,uuid,jsonb,text)'::regprocedure);
 old_guard='octet_length(p_bundle::text)>500000';
 new_guard='octet_length(p_bundle::text)>(case when slug=''eu-parliament'' then 2000000 else 500000 end)';
 n=(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard);
 if n<>1 then raise exception 'cloud bundle byte guard drift: expected one 500 KB limit, found %',n; end if;
 definition=replace(definition,old_guard,new_guard);
 execute definition;
end;
$bundle_limit$;

revoke all on function private.collector_cloud_cursor_valid(jsonb,text),
  private.collector_cloud_frozen_cursor_valid(jsonb,text)
  from public,anon,authenticated;
