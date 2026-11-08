-- The collector must not silently impose a project-specific storage ceiling.
-- Supabase's actual plan/platform limits remain authoritative. The only local
-- write gate retained here is the database's explicit read-only transaction
-- mode.
create or replace function public.collector_capacity()
returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object(
   'database_bytes',pg_database_size(current_database()),
   'can_write',current_setting('default_transaction_read_only')='off'
 );
$$;

do $remove_project_ceiling$
declare
  target record;
  definition text;
  updated text;
begin
  for target in
    select p.oid,n.nspname,p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f'
      and n.nspname in ('public','private')
      and (p.proname like 'collector\_%' escape '\'
        or p.proname in ('claim_trend_draft_jobs','submit_trend_draft','fail_trend_draft'))
  loop
    definition=pg_get_functiondef(target.oid);
    updated=regexp_replace(definition,
      '\s*if\s+pg_database_size\(current_database\(\)\)\s*>=\s*400000000\s+then\s+raise\s+insufficient_resources\s+using\s+message\s*=\s*''Storage cap reached'';\s*end if;',
      '', 'gi');
    updated=regexp_replace(updated,
      '\s*if\s+pg_database_size\(current_database\(\)\)\s*>=\s*400000000\s+then\s+return\s+v_result;\s*end if;',
      '', 'gi');
    if updated is distinct from definition then execute updated; end if;
  end loop;
end;
$remove_project_ceiling$;

do $verify$
declare leftovers text;
begin
  select string_agg(n.nspname||'.'||p.proname,', ' order by n.nspname,p.proname)
  into leftovers
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and n.nspname in ('public','private')
    and (p.proname like 'collector\_%' escape '\'
      or p.proname in ('claim_trend_draft_jobs','submit_trend_draft','fail_trend_draft'))
    and p.prosrc ~* 'pg_database_size\s*\(\s*current_database\s*\(\s*\)\s*\)\s*>=\s*400000000|storage cap reached';
  if leftovers is not null then
    raise exception 'project-specific collector storage ceiling remains in: %',leftovers;
  end if;
  if public.collector_capacity() ? 'stop_bytes' then
    raise exception 'collector_capacity still advertises an application storage ceiling';
  end if;
end;
$verify$;
