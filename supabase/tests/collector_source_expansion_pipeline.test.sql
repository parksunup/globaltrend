begin;
select plan(4);
select lives_ok($test$
DO $validation$
DECLARE saved record; retained jsonb; claimed jsonb; status text; run_id uuid=gen_random_uuid();
BEGIN
 SELECT * INTO saved FROM public.ingest_source_item(
 '2cf414f7-68d3-59a0-98cb-8eaca785a9d0'::uuid,NULL,
 'https://www.priv.gc.ca/en/opc-news/news-and-announcements/2026/collector-expansion-rollback-check/',
 'Synthetic transaction validation only',clock_timestamp(),NULL,NULL,'en','news',
 'Synthetic source-to-draft pipeline transaction validation; all rows are rolled back.',
 repeat('e',64),NULL,'{"ai_ready":true,"requires_review":false,"test_scope":"rollback_only"}'::jsonb,'trend-ko-v1');
 IF saved.draft_job_id IS NULL THEN RAISE EXCEPTION 'new source failed to create draft job'; END IF;
 retained=public.collector_retain_for_draft(saved.source_item_id,saved.source_item_revision_id,repeat('e',64),'Synthetic rollback-only pipeline validation');
 IF retained->>'status'<>'draft_required' THEN RAISE EXCEPTION 'retained draft handoff failed'; END IF;
 claimed=public.claim_trend_draft_jobs('expansion-rollback-check',1,saved.draft_job_id);
 IF jsonb_array_length(claimed)<>1 THEN RAISE EXCEPTION 'new source targeted drafting claim failed'; END IF;
 INSERT INTO public.collector_edge_events(source_id,execution_id,trigger_kind,started_at,result)
 VALUES(NULL,run_id::text,'cloud-automation-summary',clock_timestamp(),'{"role":"daily-producer","status":"success","test_scope":"rollback_only"}'::jsonb);
 SELECT result->>'status' INTO status FROM public.collector_edge_events WHERE execution_id=run_id::text;
 IF status<>'partial' THEN RAISE EXCEPTION 'unfinished Korean draft incorrectly marked complete'; END IF;
 IF EXISTS(SELECT 1 FROM public.reports WHERE source_item_id=saved.source_item_id) THEN RAISE EXCEPTION 'collection published or fabricated a Korean report'; END IF;
 PERFORM set_config('collector.expansion_validation',jsonb_build_object('draft_job_created',true,'retention_handoff','draft_required','targeted_claim_count',jsonb_array_length(claimed),'completion_guard',status)::text,true);
END; $validation$;
$test$,'new source ingestion connects to required Korean drafting without public report');
select is(current_setting('collector.expansion_validation')::jsonb->>'retention_handoff','draft_required','retention automatically requires a draft');
select is((current_setting('collector.expansion_validation')::jsonb->>'targeted_claim_count')::integer,1,'exact new-source draft job is claimable');
select is(current_setting('collector.expansion_validation')::jsonb->>'completion_guard','partial','unfinished Korean draft blocks completion');
select * from finish();
rollback;
