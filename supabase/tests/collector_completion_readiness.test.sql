begin;
select plan(3);

update public.sources set terms_reviewed_at=now()
 where name='EDPB 뉴스·보도자료';

create temporary table completion_status_fixture as
select source_item_id as item_id,draft_job_id as job_id
  from public.ingest_source_item(
    (select id from public.sources where name='EDPB 뉴스·보도자료'),
    null,
    'https://www.edpb.europa.eu/test-completion-readiness',
    'Unready metadata fixture',
    '2026-11-26T09:00:00Z',
    null,
    now(),
    'en',
    'news',
    'A readable official source text for an individual Korean draft.',
    repeat('c',64),
    null,
    '{"ai_ready":false,"requires_review":true}'::jsonb,
    'trend-ko-v1'
  );

update public.source_items set relevance_status='relevant'
 where id=(select item_id from completion_status_fixture);
update public.source_item_revisions set metadata=metadata||'{"ai_ready":false}'::jsonb
 where id=(select current_revision_id from public.source_items
            where id=(select item_id from completion_status_fixture));

select is(
  (select reason from public.collector_completion_gaps('2026-11-26','2026-11-26')
    where item_id=(select item_id from completion_status_fixture)),
  'korean_draft_required',
  'false extraction readiness does not masquerade as a draft blocker'
);
select is(
  (select count(*)::integer from public.collector_completion_gaps('2026-11-26','2026-11-26')
    where item_id=(select item_id from completion_status_fixture)),
  1,
  'dated incomplete drafts remain visible in the completion window'
);
select ok(
  (select metadata->>'ai_ready'='false' from public.source_item_revisions
    where id=(select current_revision_id from public.source_items
              where id=(select item_id from completion_status_fixture))),
  'review metadata remains unchanged while the status explanation is corrected'
);

select * from finish();
rollback;
