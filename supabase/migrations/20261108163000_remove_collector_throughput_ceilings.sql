-- Remove hand-picked collector caps that could stop discovery mid-source.
-- The FTC snapshot table provides durable per-row continuation, and URLs are
-- queried against the prior completed snapshot instead of copying a fixed-size
-- hash list into the progress cursor. No routes, approvals, cursors, or existing
-- source data are reset by this migration.

-- Every source rewrite must match the expected number of old expressions and
-- leave none of them behind. This prevents a successful migration that silently
-- failed to update a function after upstream SQL changed.
create function pg_temp.collector_replace_regex_once(
  input text, pattern text, replacement text, expected_matches integer,
  flags text default 'g'
) returns text language plpgsql immutable set search_path=pg_catalog as $$
declare actual_matches integer; output text; count_flags text;
begin
  -- `regexp_count` always counts globally and rejects the `g` option.
  count_flags := replace(flags,'g','');
  actual_matches := regexp_count(input, pattern, 1, count_flags);
  if actual_matches <> expected_matches then
    raise exception 'collector migration rewrite expected % matches, found %: %',
      expected_matches, actual_matches, pattern;
  end if;
  output := regexp_replace(input, pattern, replacement, flags);
  if regexp_count(output, pattern, 1, count_flags) <> 0 then
    raise exception 'collector migration rewrite left its old pattern behind: %', pattern;
  end if;
  return output;
end; $$;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.collector_cloud_listing_scans'::regclass
      and contype='c' and lower(pg_get_constraintdef(oid)) like '%row_count%'
  loop
    execute format('alter table public.collector_cloud_listing_scans drop constraint %I',c.conname);
  end loop;
  alter table public.collector_cloud_listing_scans
    add constraint collector_cloud_listing_scans_row_count_positive check (row_count >= 1);

  for c in
    select conname from pg_constraint
    where conrelid='public.collector_cloud_listing_rows'::regclass
      and contype='c'
      and lower(pg_get_constraintdef(oid)) ~ '(ordinal|canonical_url|row_data)'
  loop
    execute format('alter table public.collector_cloud_listing_rows drop constraint %I',c.conname);
  end loop;
  alter table public.collector_cloud_listing_rows
    add constraint collector_cloud_listing_rows_ordinal_nonnegative check (ordinal >= 0),
    add constraint collector_cloud_listing_rows_url_allowed check (
      canonical_url ~ '^https://www[.]ftc[.]gov/'
      and position('?' in canonical_url)=0 and position('#' in canonical_url)=0
    ),
    add constraint collector_cloud_listing_rows_data_identity check (
      jsonb_typeof(row_data)='object' and row_data->>'url'=canonical_url
    );
end; $$;

-- Match the Python-side complete-body contract: retain a meaningful body floor,
-- but do not reject a complete article based on title/body length.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.collector_web_ingest(text,jsonb,text)'::regprocedure)
    into definition;
  definition := pg_temp.collector_replace_regex_once(definition,
    $rx$octet_length\(body\)\s+not between\s+100\s+and\s+400000\s+or\s+length\(title\)\s+not between\s+1\s+and\s+1000$rx$,
    $rep$octet_length(body) < 100 or length(title) < 1$rep$,1,'g');
  if definition ~ 'octet_length\(body\)\s+not between\s+100\s+and\s+400000'
     or definition ~ 'length\(title\)\s+not between\s+1\s+and\s+1000' then
    raise exception 'collector web content caps were not removed';
  end if;
  execute definition;
end; $$;

-- The existing EC and European Parliament adapters freeze one listing page in
-- their JSON cursor. Remove its arbitrary 100-URL, 4 KB, URL-length and
-- offset-digit ceilings while retaining identity, host, and cursor checks.
do $$
declare definition text; old_guard text; new_guard text; guard_count integer;
begin
  select pg_get_functiondef('private.collector_cloud_frozen_cursor_valid(jsonb,text)'::regprocedure)
    into definition;
  if regexp_count(definition,
    $rx$count_urls\s+not between\s+1\s+and\s+100\s+or\s+octet_length\(c::text\)\s*>\s*4000$rx$) <> 1 then
    raise exception 'expected exactly one frozen cursor URL/byte ceiling';
  end if;
  definition := pg_temp.collector_replace_regex_once(definition,
    $rx$count_urls\s+not between\s+1\s+and\s+100\s+or\s+octet_length\(c::text\)\s*>\s*4000$rx$,
    $rep$count_urls < 1$rep$,1,'g');
  if regexp_count(definition,
    $rx$\(c->>'offset'\)\s*!~\s*'\^\[0-9\]\{1,6\}\$'$rx$) <> 1 then
    raise exception 'expected exactly one frozen cursor offset digit ceiling';
  end if;
  definition := pg_temp.collector_replace_regex_once(definition,
    $rx$\(c->>'offset'\)\s*!~\s*'\^\[0-9\]\{1,6\}\$'$rx$,
    $rep$(c->>'offset') !~ '^[0-9]+$'$rep$,1,'g');
  -- The unbounded decimal string must not be cast to PostgreSQL integer. Keep
  -- all positive offsets admissible while returning false cleanly for values
  -- too large for PostgreSQL numeric, rather than raising from an RPC.
  old_guard := $old$if jsonb_typeof(c->'offset') is distinct from 'number' or (c->>'offset') !~ '^[0-9]+$' or (c->>'offset')::integer>count_urls then return false; end if;$old$;
  new_guard := $new$begin
 if jsonb_typeof(c->'offset') is distinct from 'number' or (c->>'offset') !~ '^[0-9]+$' then return false; end if;
 begin
  if (c->>'offset')::numeric>count_urls then return false; end if;
 exception when numeric_value_out_of_range then return false;
 end;
end;$new$;
  guard_count := (length(definition)-length(replace(definition,old_guard,''))) / length(old_guard);
  if guard_count <> 1 then raise exception 'expected exactly one integer offset guard; found %',guard_count; end if;
  definition := replace(definition,old_guard,new_guard);
  definition := pg_temp.collector_replace_regex_once(definition,
    $rx$octet_length\(u#>>'\{\}'\)\s*>\s*2048$rx$,'false',1,'g');
  if definition ~ 'count_urls\s+not between\s+1\s+and\s+100'
     or definition ~ 'octet_length\(c::text\)\s*>\s*4000'
     or definition ~ $rx$octet_length\(u#>>'\{\}'\)\s*>\s*2048$rx$
     or definition ~ '\{1,6\}' then
    raise exception 'collector frozen cursor caps were not removed';
  end if;
  if definition !~ $rx$\(c->>'offset'\)::numeric\s*>\s*count_urls$rx$
     or definition ~ $rx$\(c->>'offset'\)::integer\s*>\s*count_urls$rx$ then
    raise exception 'collector frozen cursor offset guard was not made overflow-safe';
  end if;
  execute definition;
end; $$;

-- Keep the cursor shape/URL validation, but do not reject a valid continuation
-- because of a fixed byte count, offset digit count, or URL-hash array size.
do $$
declare definition text;
begin
  select pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure)
    into definition;
  definition := pg_temp.collector_replace_regex_once(definition,$rx$octet_length\(c::text\)\s*>\s*4000$rx$,'false',1,'g');
  definition := pg_temp.collector_replace_regex_once(definition,$rx$\(c->>'offset'\)\s*!~\s*'\^\[0-9\]\{1,6\}\$'$rx$,$rep$(c->>'offset') !~ '^[0-9]+$'$rep$,1,'g');
  definition := pg_temp.collector_replace_regex_once(definition,$rx$\(c->>field\)\s*!~\s*'\^\[0-9\]\{1,9\}\$'$rx$,$rep$(c->>field) !~ '^[0-9]+$'$rep$,1,'g');
  definition := pg_temp.collector_replace_regex_once(definition,$rx$jsonb_array_length\(c->'processed_url_hashes'\)\s*>\s*50$rx$,'false',1,'g');
  if definition ~ 'octet_length\(c::text\)\s*>\s*4000'
     or definition ~ 'jsonb_array_length\(c->''processed_url_hashes''\)\s*>\s*50' then
    raise exception 'collector cursor caps were not removed';
  end if;
  execute definition;

  select pg_get_functiondef('public.collector_set_progress(uuid,date,date,jsonb,boolean)'::regprocedure)
    into definition;
  definition := pg_temp.collector_replace_regex_once(definition,$rx$octet_length\(coalesce\(p_cursor::text,\s*''\)\)\s*>\s*4000$rx$,'false',1,'g');
  if definition ~ 'octet_length\(coalesce\(p_cursor::text' then
    raise exception 'collector progress cursor byte cap was not removed';
  end if;
  execute definition;
end; $$;

-- The source-level listing and article bodies are streamed in full. A cloud
-- bundle still commits at most one article per queue claim for atomic retry;
-- that is continuation granularity, not a source-wide article ceiling.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.collector_cloud_commit(uuid,text,uuid,jsonb,text)'::regprocedure)
    into definition;
  definition := pg_temp.collector_replace_regex_once(definition,$rx$octet_length\(p_bundle::text\)\s*>\s*500000$rx$,'false',1,'g');
  definition := pg_temp.collector_replace_regex_once(definition,$rx$jsonb_array_length\(listing->'rows'\)\s+not between\s+1\s+and\s+100$rx$,$rep$jsonb_array_length(listing->'rows') < 1$rep$,1,'g');
  definition := pg_temp.collector_replace_regex_once(definition,$rx$octet_length\(x->>'url'\)\s*>\s*2048\s+or\s+octet_length\(x->>'title'\)\s*>\s*1000$rx$,'false',1,'g');
  definition := pg_temp.collector_replace_regex_once(definition,$rx$jsonb_array_length\(coalesce\(x->'date_observations','\[\]'::jsonb\)\)\s*>\s*4\s+or\s+octet_length\(x::text\)\s*>\s*5000$rx$,'false',1,'g');
  if definition ~ 'octet_length\(p_bundle::text\)\s*>\s*500000'
     or definition ~ 'jsonb_array_length\(listing->''rows''\)\s+not between\s+1\s+and\s+100'
     or definition ~ 'octet_length\(x->>''url''\)\s*>\s*2048' then
    raise exception 'collector cloud bundle/listing caps were not removed';
  end if;
  execute definition;

  select pg_get_functiondef('public.collector_cloud_take(text,text)'::regprocedure)
    into definition;
  definition := pg_temp.collector_replace_regex_once(definition,
    $rx$select coalesce\(jsonb_agg\(lr.url_hash order by lr.ordinal\),'\[\]'::jsonb\) into snapshot_hashes\s+from public.collector_cloud_listing_rows lr\s+where lr.scan_id=scan.id and lr.source_id=p_source_id;$rx$,
    $rep$snapshot_hashes='[]'::jsonb;$rep$,1,'g');
  definition := pg_temp.collector_replace_regex_once(definition,
    $rx$'row',staged_row.row_data,\s*'url_hashes',snapshot_hashes$rx$,
    $rep$'row',staged_row.row_data,'seen_before',
   (r.cursor ? 'processed_url_hashes' and coalesce(r.cursor->'processed_url_hashes','[]'::jsonb) @> to_jsonb(staged_row.url_hash))
   or exists(select 1 from public.collector_cloud_listing_scans old_scan
    join public.collector_cloud_listing_rows old_row on old_row.scan_id=old_scan.id and old_row.source_id=old_scan.source_id
   where old_scan.source_id=s.source_id and old_scan.status='completed' and old_row.url_hash=staged_row.url_hash)$rep$,1,'g');
  -- Don't materialize every previous FTC hash in each queue claim. The current
  -- snapshot row carries its own `seen_before` fact from the durable scan table.
  definition := pg_temp.collector_replace_regex_once(definition,
    $rx$select coalesce\(jsonb_agg\(h order by h\),'\[\]'::jsonb\) into previous_hashes from \(.*?\) seen;$rx$,
    $rep$previous_hashes='[]'::jsonb;$rep$,1,'gs');
  execute definition;
end; $$;

revoke all on function private.collector_cloud_cursor_valid(jsonb,text) from public,anon,authenticated;
revoke all on function public.collector_set_progress(uuid,date,date,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.collector_cloud_take(text,text),public.collector_cloud_commit(uuid,text,uuid,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.collector_cloud_take(text,text),public.collector_cloud_commit(uuid,text,uuid,jsonb,text)
  to service_role;
