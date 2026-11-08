begin;
select plan(3);
select is((public.collector_capacity()->>'can_write')::boolean, current_setting('default_transaction_read_only')='off',
  'write gate only reflects PostgreSQL read-only mode');
select ok(not (public.collector_capacity() ? 'stop_bytes'),
  'collector capacity does not publish a project-specific byte ceiling');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and n.nspname in ('public','private')
    and (p.proname like 'collector\_%' escape '\'
      or p.proname in ('claim_trend_draft_jobs','submit_trend_draft','fail_trend_draft'))
    and p.prosrc ~* 'pg_database_size\s*\(\s*current_database\s*\(\s*\)\s*\)\s*>=\s*400000000|storage cap reached'
), 'collector and draft routines have no 400 MB application stop');
select * from finish();
rollback;
