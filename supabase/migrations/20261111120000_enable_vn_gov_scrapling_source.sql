-- Register the previously approved Vietnam Government source for the separate Scrapling runtime.
-- This is a review/activation record, not a claim that the publisher grants reuse rights.
begin;

insert into public.publishers(
  id, name, acronym, jurisdiction_code, publisher_type, website_url, description_ko, is_active
) values (
  '6d736b06-8da2-4e27-aeaf-77ecd43094ad',
  'Vietnam Government Online Newspaper',
  'VN GOV',
  'VN',
  'government',
  'https://en.baochinhphu.vn/',
  '베트남 정부 전자신문 영문판. Scrapling의 공식 홈페이지·정책 목록·타임라인·상세 본문 경로를 사용합니다.',
  true
)
on conflict (id) do update set
  name = excluded.name,
  acronym = excluded.acronym,
  jurisdiction_code = excluded.jurisdiction_code,
  publisher_type = excluded.publisher_type,
  website_url = excluded.website_url,
  description_ko = excluded.description_ko,
  is_active = true,
  updated_at = now();

insert into public.sources(
  id, publisher_id, name, source_kind, fetch_strategy, start_url,
  parser_config, poll_interval_minutes, respect_robots, terms_reviewed_at, is_active
) values (
  '9e9815e2-2028-4384-a5e5-6ebd1f2e2f55',
  '6d736b06-8da2-4e27-aeaf-77ecd43094ad',
  'Vietnam Government Online Newspaper',
  'html',
  'http',
  'https://en.baochinhphu.vn/',
  jsonb_build_object(
    'collector_executor', 'scrapling',
    'automatic_collection_enabled', true,
    'document_scope', 'official_homepage_focus_plus_policy_timeline_and_article_body',
    'verification_status', 'official_homepage_and_timeline_routes_verified_known_relevant_story_found_homepage_not_policy_timeline',
    'coverage_complete', false,
    'respect_robots', true,
    'minimum_request_interval_seconds', 5,
    'approval_basis', 'User explicitly approved inclusion in the automated source set; this timestamp records completion of access/policy review and does not claim a reuse license.',
    'terms_review_semantics', 'Review completion is recorded; this is not evidence that the publisher granted permission or a license.'
  ),
  1440,
  true,
  now(),
  true
)
on conflict (id) do update set
  publisher_id = excluded.publisher_id,
  name = excluded.name,
  source_kind = excluded.source_kind,
  fetch_strategy = excluded.fetch_strategy,
  start_url = excluded.start_url,
  parser_config = coalesce(public.sources.parser_config, '{}'::jsonb) || excluded.parser_config,
  poll_interval_minutes = excluded.poll_interval_minutes,
  respect_robots = true,
  terms_reviewed_at = coalesce(public.sources.terms_reviewed_at, excluded.terms_reviewed_at),
  is_active = true,
  updated_at = now();

commit;
