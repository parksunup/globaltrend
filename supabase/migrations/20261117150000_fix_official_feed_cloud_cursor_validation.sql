-- The EC News feed and its frozen page are official cloud-Python routes.
-- Accept their real cursor host and give the frozen official-feed snapshots
-- enough space while keeping every other source on the original 4 KB bound.
do $cloud_cursor$
declare
  definition text;
  old_branch text;
  new_branch text;
  old_limit text := 'octet_length(c::text)>4000';
  new_limit text := 'octet_length(c::text)>case when slug in (''ec'',''ec-news'',''eu-parliament'') then 50000 else 4000 end';
  n integer;
begin
  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  old_branch=$old$when slug='ec' then '^https://ec[.]europa[.]eu/commission/presscorner/'$old$;
  new_branch=$new$when slug='ec' then '^https://ec[.]europa[.]eu/commission/presscorner/' when slug='ec-news' then '^https://commission[.]europa[.]eu/'$new$;
  n=(length(definition)-length(replace(definition,old_branch,'')))/length(old_branch);
  if n<>1 then raise exception 'cloud cursor host guard drift: expected one EC branch, found %',n; end if;
  definition=replace(definition,old_branch,new_branch);
  n=(length(definition)-length(replace(definition,old_limit,'')))/length(old_limit);
  if n=1 then
    definition=replace(definition,old_limit,new_limit);
  elsif definition ~ 'octet_length\(c::text\)\s*>' then
    raise exception 'cloud cursor size guard drift: unexpected base cursor limit';
  end if;
  execute definition;

end;
$cloud_cursor$;

-- Rebuild the frozen cursor validator in one canonical definition. Production
-- and clean migration replay had accumulated different branch formatting,
-- which made replacement based on a historical function body unreliable.
create or replace function private.collector_cloud_frozen_cursor_valid(c jsonb,slug text)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare u jsonb; path_pattern text; listing_pattern text; count_urls integer;
begin
 if not (c ? 'frozen_urls') then return not (c ? 'frozen_next'); end if;
 if slug not in ('ec','ec-news','eu-parliament') or jsonb_typeof(c->'frozen_urls') is distinct from 'array' then return false; end if;
 count_urls=jsonb_array_length(c->'frozen_urls');
 if count_urls not between 1 and 100
  or octet_length(c::text)>50000
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

-- Supabase owns the daily enqueue clock; GitHub Actions runs the Crawlee/Python
-- collectors afterward. Restore the provisioned enqueue schedule if it exists.
do $daily_enqueue$
declare v_job record;
begin
  select jobid,command,active into v_job
    from cron.job where jobname='trend-collector-daily';
  if found then
    if v_job.command='select public.collector_edge_enqueue(''daily-cron'');' then
      perform cron.alter_job(job_id := v_job.jobid, schedule := '0 19 * * *', active := true);
    else
      -- Keep isolated test fixtures disabled; only re-enable the known
      -- production enqueue command, never an arbitrary job with this name.
      perform cron.alter_job(job_id := v_job.jobid, schedule := '0 19 * * *', active := v_job.active);
    end if;
  end if;
end;
$daily_enqueue$;
