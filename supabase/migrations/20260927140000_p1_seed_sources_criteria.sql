-- P1 seed data: initial collection sources, legal instrument catalog, and comparison criteria.
-- All legal instruments and criteria stay unpublished until the team verifies them.

insert into public.publishers (name, acronym, publisher_type, website_url, description_ko)
select v.name, v.acronym, v.publisher_type, v.website_url, v.description_ko
from (values
  ('European Data Protection Board', 'EDPB', 'international_org', 'https://www.edpb.europa.eu/news_en', '유럽 데이터보호이사회 공식 뉴스·보도자료'),
  ('Organisation for Economic Co-operation and Development', 'OECD', 'international_org', 'https://www.oecd.org/en/topics/privacy-and-data-protection.html', 'OECD 개인정보·데이터 보호 주제 페이지'),
  ('Court of Justice of the European Union', 'CJEU', 'court', 'https://curia.europa.eu/site/', '유럽연합 사법재판소(CURIA) 공식 사이트')
) as v(name, acronym, publisher_type, website_url, description_ko)
where not exists (
  select 1 from public.publishers p where p.acronym = v.acronym
);

insert into public.sources (publisher_id, name, source_kind, fetch_strategy, start_url, parser_config, poll_interval_minutes, next_run_at)
select p.id, v.name, 'html', 'http', v.start_url, v.parser_config::jsonb, 1440, now()
from (values
  ('EDPB', 'EDPB 뉴스·보도자료', 'https://www.edpb.europa.eu/news_en', '{"content_selector":"main","link_selector":"a","document_type":"press_release"}'),
  ('OECD', 'OECD 개인정보·데이터 보호', 'https://www.oecd.org/en/topics/privacy-and-data-protection.html', '{"content_selector":"main","link_selector":"a","document_type":"report"}'),
  ('CJEU', 'CJEU/CURIA 보도자료·판결 안내', 'https://curia.europa.eu/site/', '{"content_selector":"main","link_selector":"a","document_type":"other"}')
) as v(acronym, name, start_url, parser_config)
join public.publishers p on p.acronym = v.acronym
where not exists (
  select 1 from public.sources s where s.name = v.name and s.publisher_id = p.id
);

insert into public.legal_instruments (jurisdiction_code, short_name, official_name, instrument_type, official_url)
select v.jurisdiction_code, v.short_name, v.official_name, 'law', v.official_url
from (values
  ('KR', 'PIPA', '개인정보 보호법', 'https://www.law.go.kr/법령/개인정보보호법'),
  ('JP', 'APPI', 'Act on the Protection of Personal Information', 'https://www.ppc.go.jp/en/legal/'),
  ('CN', 'PIPL', 'Personal Information Protection Law of the People''s Republic of China', 'https://www.gov.cn/xinwen/2021-08/21/content_5632486.htm'),
  ('EU', 'GDPR', 'Regulation (EU) 2016/679 (General Data Protection Regulation)', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj'),
  ('GB', 'UK GDPR', 'UK GDPR (retained Regulation (EU) 2016/679)', 'https://www.legislation.gov.uk/eur/2016/679/contents'),
  ('US-CA', 'CCPA', 'California Consumer Privacy Act of 2018', 'https://oag.ca.gov/privacy/ccpa'),
  ('SG', 'PDPA', 'Personal Data Protection Act 2012', 'https://sso.agc.gov.sg/Act/PDPA2012')
) as v(jurisdiction_code, short_name, official_name, official_url)
where not exists (
  select 1 from public.legal_instruments li
  where li.jurisdiction_code = v.jurisdiction_code and li.short_name = v.short_name
);

insert into public.criteria_sets (name, description, version, is_published)
values (
  '한국·일본 개인정보 보호법 비교 기준',
  '한국·일본 비교표를 기준으로 정리한 1차 비교 기준. 법제 검수 완료 전까지 비공개.',
  1,
  false
)
on conflict (name, version) do update
set description = excluded.description,
    is_published = false;

insert into public.criteria (criteria_set_id, criterion_key, label_ko, sort_order)
select cs.id, v.criterion_key, v.label_ko, v.sort_order
from public.criteria_sets cs
cross join (values
  ('personal_information_scope', '개인정보 범위', 1),
  ('law_application_scope', '법 적용 대상', 2),
  ('privacy_principles', '개인정보보호 원칙', 3),
  ('data_subject_rights', '정보주체 권리', 4),
  ('processing_basis_collection', '처리근거 — 수집', 5),
  ('processing_basis_use', '처리근거 — 이용', 6),
  ('third_party_provision', '제공', 7),
  ('sensitive_information', '특별한 보호가 필요한 정보', 8),
  ('pseudonymous_anonymous_information', '가명·익명정보', 9),
  ('children_information', '아동 개인정보', 10),
  ('security_measures', '안전성 확보조치', 11),
  ('processor_contracting', '처리 위탁', 12),
  ('cross_border_transfer', '국외이전', 13),
  ('administrative_fines', '과징금', 14),
  ('corrective_measures', '시정조치 등', 15),
  ('breach_notification', '유출 등의 통지·신고', 16),
  ('data_use_promotion', '데이터활용 촉진', 17)
) as v(criterion_key, label_ko, sort_order)
where cs.name = '한국·일본 개인정보 보호법 비교 기준' and cs.version = 1
on conflict (criteria_set_id, criterion_key) do update
set label_ko = excluded.label_ko,
    sort_order = excluded.sort_order;