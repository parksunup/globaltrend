-- Exact historical source records reviewed on 2026-10-27.
-- Preserve original content and missing dates. Do not create a fabricated date,
-- overwrite a report, or turn a redirected guidance page into an old news item.
-- Re-run is deliberately rejected by the state guards rather than silently
-- changing the same records twice.
begin;

create temporary table historical_source_holds (
  id uuid primary key,
  reason text not null
) on commit drop;

insert into historical_source_holds (id, reason) values
  ('1096e255-4ae5-4ff9-ad51-deaa6720edf3', 'ico_retired_news_url_redirected_to_undated_guidance'),
  ('2dbdb1f6-9b84-4465-b3ea-0e788d0fd583', 'ico_retired_news_url_original_date_unverified'),
  ('36cddc15-8974-4c9b-a1ca-d53bd90d0049', 'ico_retired_news_url_redirected_to_annual_reports'),
  ('3f664d94-b700-40ad-8b25-bf22b6cdca97', 'ico_retired_news_url_redirected_to_different_document'),
  ('4ba32dba-7232-4ad6-9fe7-c8cb8bafd494', 'ico_retired_news_url_original_date_unverified'),
  ('4c7dda0e-59b0-455c-a5d4-7fa5b65cac2a', 'ico_retired_news_url_redirected_to_undated_guidance'),
  ('a800d02d-000c-4631-8853-9c63286d458e', 'ico_retired_news_url_redirected_to_annual_report'),
  ('bc16c1c5-4ffe-4ea0-951a-cd9871b6642d', 'ico_retired_news_url_original_date_unverified'),
  ('d12f0621-592a-4cd1-bc71-8a29c593444b', 'ico_consultation_start_is_not_publication_date'),
  ('d6c8c066-065a-4f2d-aa6f-c74939bd41a2', 'ico_retired_news_url_redirected_to_undated_guidance'),
  ('f10d5e84-e167-4edb-8cea-197e5dd07982', 'dpc_podcast_url_redirected_to_removed_page_notice'),
  ('a36b979c-9439-446e-9142-67d56737ab20', 'pdpc_pdf_creation_and_listing_dates_not_publication_proof'),
  ('4b91e925-e5b2-4df4-a6d3-104aca2b6b94', 'pdpc_event_page_has_no_publication_date_or_article_body'),
  ('902fcc68-3d36-4054-bc21-746de0c8f0e8', 'oecd_general_report_title_only_not_full_publication_body');

do $archive$
declare
  changed integer;
begin
  if (select count(*) from historical_source_holds) <> 14 or
     (select count(*) from historical_source_holds t
      join public.source_items si on si.id = t.id
      where si.pipeline_status in ('queued', 'discovered')
        and (si.content_text is null or btrim(si.content_text) = '' or si.published_at is null)
        and si.metadata->>'ai_ready' is distinct from 'true'
        and not exists (select 1 from public.reports r where r.source_item_id = si.id)) <> 14 or
     (select count(*) from public.draft_jobs j
      join historical_source_holds t on t.id = j.source_item_id
      where j.status = 'pending') <> 12 then
    raise exception 'historical_source_holds_precondition_changed';
  end if;

  update public.source_items si
  set pipeline_status = 'ignored',
      relevance_status = 'needs_review',
      metadata = coalesce(si.metadata, '{}'::jsonb) || jsonb_build_object(
        'ai_ready', false,
        'requires_review', true,
        'historical_resolution', jsonb_build_object(
          'state', 'archived_pending_official_evidence',
          'reason', t.reason,
          'reviewed_at', now()
        )
      ),
      updated_at = now()
  from historical_source_holds t
  where si.id = t.id;
  get diagnostics changed = row_count;
  if changed <> 14 then raise exception 'historical_source_items_update_mismatch'; end if;

  update public.draft_jobs j
  set status = 'cancelled',
      last_error = 'historical_source_evidence_unavailable:' || t.reason,
      updated_at = now()
  from historical_source_holds t
  where j.source_item_id = t.id and j.status = 'pending';
  get diagnostics changed = row_count;
  if changed <> 12 then raise exception 'historical_draft_jobs_update_mismatch'; end if;
end
$archive$;

select (select count(*) from public.source_items si join historical_source_holds t on t.id=si.id where si.pipeline_status='ignored') archived_items,
       (select count(*) from public.draft_jobs j join historical_source_holds t on t.id=j.source_item_id where j.status='cancelled') cancelled_jobs;
commit;
