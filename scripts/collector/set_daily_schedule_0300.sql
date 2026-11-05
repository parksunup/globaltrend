-- Operational schedule adjustment; not a schema migration.
-- User approved 03:00 KST on 2026-11-05. Preserve command and consumer.
BEGIN;
DO $$
DECLARE j bigint; tz text;
BEGIN
  tz := current_setting('cron.timezone', true);
  IF tz IS NULL OR tz NOT IN ('GMT','UTC') THEN
    RAISE EXCEPTION 'Unexpected cron timezone: %', tz;
  END IF;
  SELECT jobid INTO STRICT j FROM cron.job WHERE jobname='trend-collector-daily';
  PERFORM cron.alter_job(job_id := j, schedule := '0 18 * * *');
END $$;
COMMIT;
SELECT jobid,jobname,schedule,active FROM cron.job
WHERE jobname IN ('trend-collector-daily','trend-collector-consumer');
