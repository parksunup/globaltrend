-- Copied into supabase/tests only by the isolated CI workflow.
begin;
select plan(3);
select is(
  (select schedule from cron.job where jobname = 'trend-collector-daily'),
  '0 19 * * *',
  'rescheduling migration updates the prepared CI job'
);
select is(
  (select command from cron.job where jobname = 'trend-collector-daily'),
  'SELECT 1',
  'CI collector job contains no network request or production credentials'
);
select is(
  (select active from cron.job where jobname = 'trend-collector-daily'),
  false,
  'CI collector job remains disabled after migration replay'
);
select * from finish();
rollback;
