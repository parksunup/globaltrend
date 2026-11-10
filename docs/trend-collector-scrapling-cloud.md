# Scrapling 6개 출처 클라우드 수집·중복 필터·Codex 초안

## 처리 흐름

1. Scrapling worker는 기존 Supabase Cron + Queues 계약에 연결되어야 합니다. 현재 GitHub Actions workflow는 수동 검증만 가능하며 일일 운영 예약으로 활성화하지 않았습니다. 운영 예약을 구성하기 전에는 사용자의 PC에서 실행하지 않습니다. 수집 시작 전에 `collector_source_allowed(source_id)`와 `collector_capacity()`를 확인합니다. 승인되지 않은 출처는 요청하지 않습니다.
2. OECD, CAC, PCPD, 베트남 정부 전자신문, FTC, CalPrivacy의 기존 전용 Scrapling 어댑터로 최근 3일 범위를 점검합니다. 목록 10페이지·상세 30건 제한을 두며, robots 규칙과 출처별 최소 5초 간격을 계속 적용합니다.
3. 수집한 원문은 기존 중앙 저장소 `source_items`와 `source_item_revisions`에 들어갑니다. 같은 출처·canonical URL은 기존 `ingest_source_item`이 판본·SHA-256·재수집 idempotency를 처리합니다. 신규 run과 각 item metadata에 execution/run ID를 남깁니다. 새 원문을 별도 파일 artifact에 복제하지 않습니다.
4. 기존 Supabase `reports` 및 다른 출처의 `source_items`와 비교하는 필터 판단은 `scrapling_filter_decisions`에 run·revision·매칭 대상·근거와 함께 기록합니다. exact URL/hash는 시스템에서 비교하고, 번역·재게시·같은 사건의 보도자료처럼 의미 판단이 필요한 후보는 제목만으로 버리지 않고 기존 원문·작성 보고서와 대조합니다. 정정·후속 문서처럼 새로운 사실을 담은 자료는 별도 자료로 보존합니다.
5. 새 Scrapling 자료의 `draft_jobs`는 필터 승인 전에는 만들어지지 않습니다. `accepted` 판단만 기존 `collector_retain_for_draft`를 호출해 한국어 작성 작업으로 연결합니다. 중복/무관은 제외 사유를 저장하고, 확신할 수 없는 건은 `needs_review`로 남깁니다.
6. 매일 05:00 KST Codex 예약 작업은 미처리 Scrapling 자료를 대조·분류한 뒤 보존 대상의 원문·연결 공식 자료를 읽고 기존 작성지침, 참고 기록, 용어집에 따라 한국어 초안을 작성합니다. `trend-report.mjs --seal`과 `--check --source` 및 기존 `submit_trend_draft` 검사를 통과한 초안만 `/work`에 미검수 draft로 저장합니다. 사람 검수 전 공개·발행하지 않습니다.

## 저장·중복 판정 구조

- 중앙 원문 풀: `source_items`, `source_item_revisions`
- 수집 실행 이력: `scrapling_collection_runs`
- 자동 필터의 감사 기록: `scrapling_filter_decisions`
- 중복/관련성/출처 승인 필터를 통과한 자료만 기존 `draft_jobs` 및 보고서 작성 경로에 전달
- 새 테이블은 RLS를 켜고 `service_role` 접근만 허용합니다. 사용자 브라우저 권한을 추가하지 않습니다.
- 기존 Crawlee/Edge 수집기, 기존 source cursor, 기존 작업실 원고는 바꾸거나 지우지 않습니다.

## 자동화 상태와 연결 순서

Scrapling GitHub Actions workflow는 현재 `workflow_dispatch`만 지원하며 일일 운영 예약이 아닙니다. 별도 worker를 기존 Supabase Cron + Queues 계약에 연결하고 DB migration을 배포하기 전까지 production schedule이 작동한다고 간주하지 않습니다.

한국어 작성은 사용자 Codex 구독을 사용하는 클라우드 Codex 예약 워커로 실행해야 합니다. 사용자 PC·데스크톱 앱이 꺼져 있어도 동작해야 하며, 로컬 Codex 예약이나 로컬 cron으로 대체하지 않습니다. 별도 OpenAI API·생성 API는 사용하지 않습니다. 이 작업환경에서 확인 가능한 예약 생성기는 로컬 실행만 지원하므로, 클라우드 예약은 아직 구성·검증되지 않았습니다. 클라우드 예약 도구와 실제 DB 접근 권한이 확인되기 전에는 예약이 설정됐다고 보고하지 않습니다. 예약 워커는 저장소의 최신 지침 파일과 Supabase 대기열에 접근해야 하며, 필수 migration/RPC/정책/출처 승인 gate가 준비되지 않으면 쓰기 없이 종료해야 합니다.

베트남 정부 출처는 운영 `sources` 등록 및 `terms_reviewed_at` 승인 gate가 현재 충족되지 않으면 collector가 해당 사이트에 요청하지 않고 `source_not_active_or_terms_not_reviewed`로 기록합니다. 이 workflow가 DB 출처를 생성하거나 약관·재사용 검토 표시를 자동으로 바꾸지 않습니다.

## 실패·재실행

- URL·본문 SHA-256·revision은 동일 자료 재실행을 idempotent하게 처리합니다.
- run 시작을 DB에 먼저 기록합니다. 완료 상태와 출처별 건수·부분 범위·실패 원인을 run에 갱신합니다. 본문·비밀값은 run summary에 넣지 않습니다.
- DB 저장 오류가 나면 collector를 성공으로 기록하지 않습니다. 기존 source cursor를 직접 전진시키거나 이전 수집기 checkpoint를 바꾸지 않습니다.
- 3일 overlap과 URL/hash upsert가 중복 실행을 견디며, coverage 제한·날짜 충돌·비어 있는 날은 성공 완료로 과장하지 않습니다.
- Codex 작업은 제출된 `reports`/`publication_working_copies`를 다시 확인하고 이미 제출된 자료는 재작성하지 않습니다. 자동 검사가 사실 검증이나 사람 승인을 대신하지 않습니다.

## 비밀값·모델 사용

수집 worker는 기존 GHA secret에서 DB 쓰기 자격을 받아 안전한 RPC만 호출합니다. 서비스 키·lease 비밀을 출력하지 않습니다. Scraping runner는 모델을 호출하지 않습니다. 한국어 초안은 예약된 Codex 작업이 현재 Codex 계정으로 생성하며, OpenAI API 호출은 없습니다.
