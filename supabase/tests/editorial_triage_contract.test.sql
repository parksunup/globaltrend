begin;
select plan(6);
select ok(to_regclass('public.trend_editorial_triage_decisions') is not null,
  'editorial triage decisions are persisted');
select ok(has_function_privilege('service_role',
  'public.record_trend_editorial_triage(uuid,uuid,uuid,text,text,text,text,jsonb)','execute'),
  'service role can record an editorial decision');
select ok(not has_function_privilege('anon',
  'public.record_trend_editorial_triage(uuid,uuid,uuid,text,text,text,text,jsonb)','execute'),
  'anonymous users cannot record editorial decisions');
select ok(not has_table_privilege('anon','public.trend_editorial_triage_decisions','select'),
  'anonymous users cannot read editorial decisions');
select ok(exists(select 1 from pg_trigger where tgname='editorial_triage_reopen_unattempted_draft' and not tgisinternal),
  'current accepted decisions reopen only eligible cancelled drafts');
select ok(exists(select 1 from pg_trigger where tgname='editorial_triage_cancel_nonaccepted_draft' and not tgisinternal),
  'nonaccepted decisions cancel pending drafts');
select * from finish();
rollback;
