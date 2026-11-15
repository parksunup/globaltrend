# 한국어 동향 초안 처리 차단 요건 전수 점검

점검일: 2026-11-15 (KST)
범위: 후보 수집·중복/관련성 필터 → 보존 → 작업 등록 → claim/lease → 원고 검토 → seal/submit → 실패·재시도·예약 복구. 저장소 마이그레이션·작성 지침·테스트와 Supabase 운영 함수/대기열을 대조했다. 초기 차단 요건 점검은 읽기 전용으로 수행했으며, 이후 별도 재개 처리 결과는 아래 시간별 기록에 구분해 적었다. 승인·공개 발행은 하지 않았다.

## 핵심 발견

가장 먼저 고쳐야 할 것은 `ai_ready` 판정의 불일치다. 현재 운영 `claim_trend_draft_jobs`는 `ai_ready`를 보지 않고 조건에 맞는 작업을 선점하지만, 이어지는 `submit_trend_draft`는 게시일이 있는 `ai_ready=false` 자료를 `Source approval was revoked`로 거부한다. 즉 작성자가 제출할 수 없는 작업을 claim해 시도 횟수와 임대를 소모하는 경로다.

2026-11-15 08:33:43 UTC 운영 조회에서 작업은 `pending=246`, `failed=23`, `submitted=96`, `needs_human_review=1`이었다. 현재 claim 조건을 적용한 후보는 254건이고 그중 `ai_ready=false`가 103건이었다. 이 103건 중 게시일이 있는 102건은 현재 submit 조건에 걸릴 수 있다. 게시일 없는 1건은 submit의 `date_absent_at_claim` 예외 대상이다. 당시 유효 claim/만료 claim은 0건, DB 크기는 98,561,171바이트(약 94MiB)였다. 이는 당시 한 번의 읽기 결과이며 이후 상태는 달라질 수 있다.

| 판정 | 조치 |
|---|---|
| 그대로 유지 | 현재 판본·해시 결속, 실제 근거 인용, 기존 원고 보호, 출처 활성/약관 검토, 검수 전 draft 상태 |
| 정책 목적은 유지하되 막는 방식을 완화 | 관련성·중복 필터, 연결자료 분류, coverage·편집 검토, 날짜 미확인, 짧은 원문, 짧은 보고서 |
| 결함으로 수정 | claim과 submit 사이의 `ai_ready` 불일치, 날짜 처리의 코드·문서·운영 불일치, DB 용량 도달 시 조용한 빈 결과, 반복 실패가 나머지 큐를 지연시키는 동작 |
| 조건부 유지 | 접근 승인·약관 검토, 저장용량, 동시 처리 임대, JSON 구조 검사는 목적과 명확한 오류를 보존하고 재개 흐름을 붙인다. |

## 전체 경로별 근거와 판정

### 1. 수집 후보 등록과 관련성·중복 필터

| 요건 | 근거·현재 동작 | 판정 및 개선 |
|---|---|---|
| 수집 대상 출처 활성 및 약관/접근 정책 검토 | `claim_trend_draft_jobs`가 `sources.is_active` 및 `terms_reviewed_at`를 요구한다. `docs/trend-scrapling-daily-codex-task.md`도 출처 승인·도구 상태를 확인하도록 한다. | **유지.** 승인된 출처에서만 자동 처리하는 범위 통제다. 다만 `terms_reviewed_at`은 접근 정책을 검토했다는 내부 기록이지, 약관이 수집·재사용을 허락한다는 보증은 아니다. 출처가 막히면 출처별로 보류하고 다른 출처 작업은 계속한다. |
| Scrapling 후보는 수락(decision=accepted) 후에만 draft job 생성 | `20261109112809_scrapling_candidate_filter_decisions.sql`의 `guard_scrapling_draft_until_filtered`, `record_scrapling_filter_decision`. accepted는 관련성·중복 판정 후 `ai_ready=true`와 보존/작업 등록을 함께 한다. duplicate·irrelevant는 무시, `needs_review`·`source_held`는 보류한다. | **의도는 유지.** 중복/무관 자료가 초안 큐에 들어오는 것을 막는다. 다만 단순한 분류 불확실성을 영구 배제하지 말고 리뷰 후보로 남기고, 비-Scrapling 수집의 공통 큐까지 이 전용 decision을 요구하지 않아야 한다. |
| 기존 보고서가 있는 자료는 새 보고서를 만들지 않음 | 필터 RPC가 기존 `reports` 존재 시 `existing_report_preserved`를 반환하며 submit도 기존 원고를 덮어쓰지 않고 `needs_human_review`에 제안을 보낸다. | **유지.** 사용자 원고·검수 결과 보호를 위한 중복 방지다. 기존 원고가 있다는 이유로 자료나 이력을 삭제하지 않는다. |
| `relevance_status='relevant'` 필수 | 최신 운영 claim SQL은 `relevant`를 요구한다. `record_scrapling_filter_decision(accepted)`가 해당 상태로 설정한다. | **정확한 판정을 전제로 유지.** 잘못된 `needs_review`/`ai_ready=false`를 사실상 무기한 제외 상태로 만들지 않도록, 불확실 건도 큐에서 분리해 사람이 나중에 살필 수 있게 해야 한다. 개인정보와 무관하다는 판정은 제외 사유로 남긴다. |
| 보존(retain) 시 현재 판본·본문·이유·출처 승인 및 `ai_ready` 확인 | `collector_retain_for_draft`는 revision/hash 일치, 비어 있지 않은 본문, 비어 있지 않은 보존 이유, 활성·검토 출처를 요구하고, 게시일이 있을 때 revision의 `ai_ready=true`도 요구한다. | **판본·출처·본문 검사는 유지. `ai_ready`는 이 위치에서 제출 허가 조건으로 쓰지 않도록 변경 권고.** 추출기 플래그는 추출 품질/추가 검토 신호이지, 사람이 확인 가능한 원문 사실로도 작성할 수 없다는 판정과 같지 않다. 최신 판본 본문이 존재하면 작성자가 사용 가능한 근거만으로 쓰도록 하고, 모자란 내용은 쓰지 않으며 한계를 기록한다. |

### 2. Claim/lease, 실행 용량, 오래된 작업

| 요건 | 근거·현재 동작 | 판정 및 개선 |
|---|---|---|
| 현재 source revision, 본문 존재, relevance, 활성 출처, 약관검토, 기존 report 없음 | 운영 `claim_trend_draft_jobs` SQL을 직접 조회했다. | **유지.** 제출 원고가 다른 판본을 설명하거나 기존 작업을 덮는 것을 막는 핵심 보호다. revision이 바뀌었으면 새 판본에 맞춰 재평가·새 job을 연결한다. |
| `attempts < 3` | 운영 claim과 `docs/trend-draft-worker.md`가 3회 미만만 허용한다. 실패하면 `fail_trend_draft`가 `failed`로 기록하고 임대를 해제한다. 3회 소진 뒤에는 claim 대상에서 빠진다. | **영구 차단 상한은 제거 권고.** 같은 실패를 즉시 반복하지 않도록 실패 원인·재시도 시각·backoff를 기록하되, 3회라는 숫자 때문에 사람이 보기 전 영구 정지시키지 않는다. 한 항목 오류는 그 항목에 기록하고 큐의 나머지는 계속한다. 명백한 권한/출처 hold는 별도 `held` 상태와 재개 조건으로 보존한다. |
| 한 RPC 배치 1~10건 | claim은 `p_limit` 1~10을 받으며, 전체 pending 개수 제한은 아니다. 문서도 반복 claim을 지시한다. | **일일 총량 상한은 아님.** 한 건씩 처리하는 동작 자체는 lease·작업 격리를 돕는다. 실행 결과에 남은 pending/failed/claimed 수를 명시하고 다음 실행이 이어받게 한다. |
| 30분 lease, worker 소유권 확인 | claim이 30분 임대를 발급하고 `submit`/`fail`은 유효한 worker·lease를 요구한다. 오래된 claimed는 만료되면 다시 claim 조건에 들어간다. | **동시 실행 보호로 유지.** 오래된 claim이라는 이유만으로 제외하지 않는다. 실제 만료 여부와 worker·revision을 읽고, 만료된 건은 기존 claim 경로로 복구한다. 유효 lease를 다른 worker가 빼앗지 않는다. 임대 만료 직전 장시간 분석을 지원하도록 lease 연장 RPC나 안정적 재개를 검토한다. |
| DB 400,000,000바이트 상한 | claim은 DB가 400MB 이상이면 예외 없이 빈 배열을 반환하고, submit은 `Storage cap reached` 오류를 낸다. 2026-11-15 08:33 UTC 조회는 98,561,171바이트였다. | **현재는 차단 원인이 아니며, 조용한 빈 큐는 결함.** 실제 저장용량 안전을 위해 경고/정지를 둘 수 있지만, claim 결과에 `blocked_storage_cap`과 측정값을 반환해 예약 실행이 이를 실패·알림으로 드러내야 한다. 임의로 상한을 올리거나 안전 조건을 무시하지 않는다. |
| claim 응답 변환/패킷 생성 단계 | `docs/trend-draft-worker.md`는 응답 봉투와 `result`를 구분하라고 기록한다. `docs/trend-scrapling-daily-codex-task.md`는 Work 클라우드에서 로컬 Node 검사 대신 서버 seal→submit RPC를 사용한다고 명시한다. | **환경별 경로를 일치시킨다.** Node 셸이 없는 클라우드 Work에서는 연결 Supabase RPC 반환 구조를 확인하고 서버 검증을 호출한다. 로컬 packet 미생성만으로 막지 않는다. 실제 서비스/프로젝트 연결이 호출로 확인되면 provider 상태 조회 API 부재는 별도 사유가 아니다. |

### 3. 원문·연결자료 및 작성 검토

| 요건 | 근거·현재 동작 | 판정 및 개선 |
|---|---|---|
| `source_reading.read_scope='full_official_body'` | `private.validate_trend_writing_review`가 `docs/trend-report-style.md` 기반 writing review를 검증하며 공식 URL, full-official-body, locator, 실제 열람 시각을 요구한다. `docs/trend-scrapling-daily-codex-task.md`도 전문 읽기를 지시한다. | **사실 기반 원고 작성은 유지하되, ‘전문 확인’ 표기를 절대 선행 조건으로 두지 않는다.** 원문이 요약·보도자료·일부 공개 본문인 경우 실제 읽은 범위를 `full_page`, `excerpt`, `accessible_sections` 등 정확하게 기록하고 그 범위 안의 사실만 작성한다. 읽지 않은 법률·판결·첨부 내용은 추정하지 않는다. 독자가 원문 링크에서 더 찾을 수 있게 한다. |
| 연결 문서 전부를 supplements에 분류, material=true는 읽어야 함 | validator는 revision metadata의 `related_documents`와 `unread_attachments`를 전부 supplements에 적도록 요구한다. status는 `read`, `unavailable`, `not_material`; `material=true`면서 읽지 않은 항목은 거부한다. Daily 문서에는 “핵심 연결자료 미확보는 실패·재시도”가 있다. | **분류 기록은 유지, 미열람 연결자료 때문에 전체 원고를 실패 처리하는 규칙은 폐기.** 접근 가능한 공식 원문에서 확인된 핵심 사실은 먼저 작성한다. 링크가 차단되면 `unavailable`과 실제 오류를 기록하고 그 링크에만 있는 숫자·조건·판단은 본문에 쓰지 않는다. 연결 자료를 읽지 않았다고 읽은 것으로 표시하지 않는다. `material`은 원고에 실제로 사용한 주장에 대한 필수 근거 여부와 혼동하지 않게 정의한다. |
| 원문 근거 인용은 정확한 현재 revision `content_text`에 존재, quote 12자 이상 | live `submit_trend_draft`는 인용이 source revision 문자열에 있고 locator·claim이 비어 있지 않은지 확인한다. | **핵심은 유지.** 근거 출처와 실제 초안의 연결을 지키는 방어다. 12자는 기술적 최소치로 두되, 인용 문구를 억지로 늘리지 않고 실제 문구를 그대로 인용한다. 보조 PDF의 사실을 근거로 쓸 때는 그 텍스트가 현재 revision에 포함되지 않으면 보조 자료 사실은 초안에서 빼거나 정식 revision으로 보강한다. |
| 공통 5개 coverage와 기사 유형별 coverage, 6개 editorial review | writing policy는 context/action/scope/grounds/follow_up 및 유형별 항목, content/flow/legal_stage/terminology/numbers_dates/reader_notes를 요구한다. validator는 covered 세부 내용과 evidence index를 확인하고 `action`·`scope`의 not_applicable을 금지한다. 각 상세 문구는 12자 이상이어야 한다. | **검토는 유지하되 빈 항목에 맞춰 억지 내용을 만들지 않도록 수정.** brief notice, 행사 공지, 짧은 통계는 action/scope/grounds/follow-up이 실제로 없을 수 있다. `not_applicable`과 간결한 이유를 모든 항목에 허용하고, 12자 채우기 대신 사실·인용 참조 여부를 검사한다. “해당 없음”은 근거 부족을 숨기는 수단이 아니라 원문에 실제로 없는 경우만 사용한다. |
| 1,500자 이상 원문 + 700자 미만 상세 본문이면 20자 brevity_reason 필수 | `collector_writing_policy`가 이를 `thin_draft_warning`이라고 부르지만 `validate_trend_writing_review`는 20자 이유가 없으면 제출을 거부한다. | **차단 요건 제거.** 700자는 절대 최소가 아니며, 사용자가 짧은 공식 발표는 참고 가능한 사실에 근거해 짧게 작성하고 주간호에서만 제외할 수 있다고 지시했다. 700자는 품질 확인 알림으로만 보여주고, 이유 문구를 채우지 않아도 정상 제출되게 한다. 사실을 늘리기 위해 일반론이나 추정을 덧붙이지 않는다. |
| 요약 1문단, 본문 각 문단 `- ` 형식 | validator는 요약 줄바꿈을 금지하고 상세 문단마다 `- `를 요구한다. 작성 지침도 개조식 동향 보고 형식을 요청한다. | **유지.** 이는 자료의 표시 형식에 관한 공통 편집 규칙이며 작성 차단의 실질 부담은 낮다. 단, 문단 수·소제목 수·최소 문장/글자 수를 별도로 강제하지 않는다. |
| 전체 JSON 100KB, 제목 500자, 요약 3,000자, 상세 20,000자, evidence 1~30 | 운영 submit 함수의 구조/크기 검증이다. | **필수 필드·DB 무결성 검사는 유지.** 이 크기들은 원고의 최소 분량이 아니라 데이터 전달 상한이다. `100KB` 같은 요청 payload 제한에 닿으면 내용을 잘라 저장하지 말고 검토기록과 인용 구조를 간결하게 구성한다. 실제로 초안을 차단했다면 오류를 실행결과에 노출한다. 장문 원문 전체를 초안 JSON에 복제하지 않는다. |

### 4. 날짜 판정과 주간호

| 요건 | 근거·현재 동작 | 판정 및 개선 |
|---|---|---|
| 게시일 없는 자료의 개별 초안 허용 여부 | 과거 `20261028013000_require_publication_date_for_auto_draft.sql` 및 `20261028090921_completed_korean_catalog.sql`은 claim에서 게시일을 요구하고, 자동 초안 삽입 trigger도 날짜를 요구했다. 최신 운영 claim은 날짜 없는 item을 선점하며 `date_absent_at_claim`를 기록한다. 운영 submit은 날짜 없음 + 그 claim-time flag가 true면 `ai_ready` 예외를 허용한다. | **개별 초안 작성은 허용, 주간호에는 미포함**이 사용자 지시다. 저장소 migration, trigger, 최신 운영 함수와 테스트가 같은 정책을 구현하도록 조정해야 한다. 날짜가 비어 있다는 이유만으로 일반 초안 작업을 막지 않는다. 날짜를 확인할 수 없으면 날짜 칸을 비워 둔다. |
| 날짜 미확인 초안의 주간호 후보 제외 | 주간 집계 계약 `docs/weekly-digest-cloud.md` 및 `docs/collector-daily-task.md`의 주간 항목은 발표일 확인 가능한 보고서만 기간 필터에 포함한다. | **유지.** 날짜가 없으면 월~일의 기간 귀속을 증명할 수 없다. 이는 일반 동향 초안 생성을 막는 요건이 아니라 주간호의 기간 정확성 필터다. |
| 사용자 컴퓨터와 무관한 월요일 8건 주간 초안 | PR #148은 병합됐고, 운영 `weekly-digest` Edge Function과 `weekly-digest-monday-0900` Cron이 활성이다. Cron은 `0 0 * * 1` UTC(월요일 09:00 KST)이며, 2026-11-15 일요일 조회 시 정기 실행 이력은 아직 없다. | **배포·예약 구성은 완료, 정기 실행의 성공은 미확인.** 실제 정기 occurrence에서 `collector_edge_events` 성공과 8건 초안 저장을 재조회해야 한다. 11월 16일 09:00 KST가 다음 정기 실행이다. 수동 사전 실행으로 같은 dispatch 경로가 동작한 사실은 정기 occurrence 성공의 증거와 구분한다. 승인·공개 발행은 별도 사람 결정이다. |

### 5. Retry·중복·사람 검수 보호

| 요건 | 근거·현재 동작 | 판정 및 개선 |
|---|---|---|
| 작업당 최대 3회 시도 | claim `attempts<3`; `fail_trend_draft`는 활성 lease 소유자만 실패 처리할 수 있다. | **사용자 지시와 충돌하는 자동 영구 제외 제거.** 개별 item 실패는 그 item에 기록 후 다른 item으로 계속 이동한다. backoff와 오류유형을 사용하되 재개 가능한 작업을 attempts 숫자만으로 큐에서 영구 삭제하지 않는다. 재시도 대기 상태를 만들고 계속 추적한다. |
| 기존 report가 있으면 자동 덮어쓰기 금지 | submit은 기존 report를 보존하고 새 제안만 `needs_human_review`에 둔다. | **필수 유지.** 작성자의 기존 자료와 사람 검수 내역을 보호한다. |
| revision/정책 ID·hash 불일치 제출 거부 | submit과 `validate_trend_writing_review`는 현재 revision, content hash, job instruction version, style/glossary hashes, draft hash를 비교한다. | **유지.** 다만 지침 업데이트 시 모든 작업을 막지 않도록 정책 sync/버전 갱신을 운영 절차에 넣고, 오류를 사용자에게 구체적으로 표시한다. 불일치가 해결되기 전에 내용을 승인·발행하지 않는다. |
| 초안은 `draft`, 미검수, 미공개로 저장 | submit은 report status `draft`, `human_reviewed=false`로 저장하고 `published_at`을 지정하지 않는다. | **필수 유지.** 자동 작성 성공은 사람 검수/공개 승인이 아니다. |

## 저장소와 운영 DB의 정책 불일치

| 항목 | 저장소 코드/문서 | 운영 DB 관찰 | 영향 |
|---|---|---|---|
| Claim의 `ai_ready` | 현 PR의 마이그레이션 순서에서 구판 claim은 `ai_ready=true`를 요구했다. 최신 main에는 2026-11-14 claim alias 수정 migration이 있다. | 운영 claim은 `ai_ready` 조건을 사용하지 않는다. | 운영은 작성할 수 있는 작업도 claim하지만, submit은 일부를 거부한다. 사전 eligibility와 제출 조건을 같은 predicate로 정렬해야 한다. |
| Claim의 게시일 | 기존 migration은 날짜 필수 claim 및 자동 report trigger를 추가했다. | 운영 claim은 날짜 없는 자료도 claim하고 `date_absent_at_claim`를 기록한다. | 날짜 정책이 저장소, 테스트, 운영 DB에 하나의 진실로 정리되지 않았다. 개인 초안 허용·주간 제외를 구별해 migration과 회귀 테스트를 추가해야 한다. |
| AI readiness 정책 ID | live `collector_writing_policy`/`collector_draft_policy` 조회와 기존 보고에 정책 해시가 저장소와 맞았다고 기록되어 있다. | 현재 운영 claim/submit의 실제 함수 정의는 저장소 코드와 일부 조건이 다르다. | 문서 해시가 맞는 것만으로 SQL 함수가 동기화됐다고 볼 수 없다. 운영 함수 정의·migration history를 매 배포 점검해야 한다. |
| 용량 임계값 | 저장소/운영 RPC 400,000,000바이트. | 조회 당시 약 94MiB. claim은 threshold 초과 시 빈 배열을 조용히 반환한다. | 용량에 닿으면 예약은 성공처럼 보이며 작업이 남을 수 있다. 결과 이벤트와 알림을 추가해야 한다. |

이 표는 운영 DB 함수 원문(`pg_get_functiondef`)과 그 시각의 집계에 근거한다. 라이브 DB는 이 문서 작성 뒤 바뀔 수 있으므로 migration 적용 전·후에 함수를 다시 읽고 migration history를 대조해야 한다.

### 후속 확인 — 주간 자동화 및 최신 큐 상태 (2026-11-15 17:36 KST)

- PR #148은 최신 `main`과의 충돌 2곳(`README.md`, `docs/collector-daily-task.md`)을 해결하고, CI 8개와 Vercel Preview 검사를 모두 통과한 뒤 `main`에 병합됐다. 병합 커밋은 `32d153af189a0669315da09351812a9bc6180d3b`이다.
- `weekly-digest` Edge Function을 운영 Supabase에 v1로 배포했고, `weekly_digest_edge_schedule` migration을 적용했다. Cron `weekly-digest-monday-0900`은 `0 0 * * 1` UTC, 활성 상태로 확인됐다(한국시간 월요일 09:00).
- DB의 `private.weekly_digest_dispatch()`를 한 차례 실행해 실제 Edge 호출·선정·저장을 검증했다. 실행 `ee9cc686-e95c-4169-889f-dd474b03e7f6`은 2026-11-02~08 후보 10건 중 8건을 `2026-11-W1` 검수 대기 `draft`로 저장했다. 주간 이벤트 로그와 주간호 연결자료 8건을 재조회했고 `published_at`은 비어 있었다. 이 실행은 정기 Cron의 다음 월요일 tick 자체는 아니며, Cron이 호출하는 동일한 dispatch 경로를 1회 검증한 것이다.
- 최신 큐 재조회(2026-11-15 17:36 KST)는 실행 사이에 변하고 있다. 17:34 기준 `pending=246`, `claimed=0`, `failed=23`, `submitted=96`, `needs_human_review=1`; 17:36 기준에는 `pending=244`, `claimed=1`, `failed=24`, `submitted=96`, `needs_human_review=1`이었다. 새 claim은 `work-drafts-catchup-20261115T150215KST` 작업자 소유이며 lease가 18:05 KST까지 유효하므로 다른 작업이 가져가거나 정리하지 않았다.
- 17:36 기준 현재 운영 claim SQL을 그대로 적용한 적격 후보는 253건이고, 그중 `ai_ready=false` 103건, 게시일이 있어 현재 submit 조건과 충돌하는 건 102건, 게시일이 없는 건 3건이었다. 이 수치는 queue가 움직이는 동안의 순간 집계다. 핵심 불일치는 여전히 재현된다. `claim_trend_draft_jobs`는 readiness 값을 보지 않지만 `submit_trend_draft`는 `ai_ready=false`이고 게시일이 있는 건을 거부한다.
- 이 문서는 근거·권고를 검토하기 위한 감사 결과다. `ai_ready`, 연결자료, 짧은 원문, 재시도 등 초안 gate 자체는 아직 운영 DB에서 변경하지 않았다. 위 주간 자동화 변경은 별도 PR #148을 통해 배포됐다.

## 코드 변경 권고 순서

1. `claim_trend_draft_jobs`와 `submit_trend_draft`의 eligibility를 같은 정책으로 맞춘다. 최소한 `ai_ready=false` 자료가 claim되어 submit에서 거부되는 경로를 없앤다. `ai_ready`는 추출기 표시/품질 신호로 기록하고, 최신 원문에 확인 가능한 사실이 있으면 작성 가능하도록 한다. 이미 수집된 102건을 바로 일괄 변경하지 말고, item별 실제 본문·중복·출처 상태를 재검토하는 재처리 작업으로 연결한다.
2. 연결 자료는 전부 `read`/`unavailable`/`not_material`로 구분해 기록하되, unavailable로 전체 작업을 실패시키지 않는다. 본문은 확보된 공식 원문에만 근거하고 누락된 보조 자료 주장을 빼며, 독자가 원문으로 추가 확인할 수 있도록 limitation에 URL/차단 사유를 남긴다.
3. writing review는 검토의 실질을 확인하되 12자·20자 채우기, `action`/`scope` 무조건 해당 없음 금지, 700자 예외 문구처럼 문구 길이 때문에 제출을 거부하는 조건을 완화한다. 짧은 원문도 실제 정보가 있으면 짧게 작성한다.
4. 날짜 없는 자료는 일반 초안에 허용하고 주간호 기간 선별에서 제외하는 하나의 정책을 migration·trigger·테스트·README·예약 지침 전부에 반영한다.
5. 3회 attempts 영구 정지 대신 오류 유형, 재시도 가능 여부, 다음 시각, 반복 간격을 기록해 해당 건만 재개한다. 다른 작업은 계속한다. 오래된 claim도 만료 여부로만 판단한다.
6. 400MB 같은 실제 인프라 안전 가드는 값 자체를 임의 조정하지 않는다. 초과 시 빈 배열 대신 `blocked_storage_cap`과 측정치를 반환·기록하도록 바꾼다.
7. 주간 자동화는 Supabase Edge 우선으로 PR #148을 검토·병합한 다음, Edge Function 배포와 migration/Cron 등록을 순서대로 확인하고, 실제 월요일 실행 또는 안전한 테스트 실행의 event와 draft 저장을 재조회한다. GitHub Actions 비교는 이 권고 범위가 아니다.

## 파일 및 검사 기준

주요 근거:

- `supabase/migrations/20261109112809_scrapling_candidate_filter_decisions.sql` — Scrapling 필터 결정·job 삽입 trigger
- `supabase/migrations/20261020090000_remove_daily_draft_limit.sql` — claim 배치 및 일일 제한 제거
- `supabase/migrations/20261026075855_exclude_reported_items_from_claims.sql` — 중복 보고서 제외
- `supabase/migrations/20261028013000_require_publication_date_for_auto_draft.sql` 및 `20261028090921_completed_korean_catalog.sql` — 과거 게시일 claim/auto-draft trigger
- `supabase/migrations/20261029140000_trend_writing_quality.sql` — writing policy와 writing_review validator
- `supabase/migrations/20261110120000_cloud_writer_server_seal_validation.sql` — 서버 seal 및 검토 validator 확장
- `supabase/migrations/20261114201959_fix_draft_claim_alias.sql` — claim UPDATE alias 오류 수정
- `docs/trend-draft-worker.md`, `docs/trend-scrapling-daily-codex-task.md`, `docs/collector-daily-task.md`, `docs/weekly-digest-cloud.md`, `docs/catalog-weekly-contract.md`
- `tests/sql/collector_draft_unlimited.test.sql`, `tests/sql/retained_draft_pipeline.test.sql`, `tests/sql/scrapling_candidate_filter_decisions.test.sql`, `tests/sql/trend_writing_quality.test.sql`

현재 테스트 중 `collector_draft_unlimited.test.sql`에는 날짜 없는 원문이 claim되지 않아야 한다는 과거 정책 기대가 있다. 사용자 결정(개별 draft에는 허용, 주간호에는 제외)과 달라지므로 회귀 테스트를 고쳐야 한다. 변경 이후에는 migration만 확인하지 말고 이 SQL 테스트로 `ai_ready=false`·날짜 없음·짧은 공지·보조 링크 접근 불가·기존 보고서·만료 lease·attempts 복구를 함께 검증한다.

## 이 감사와 주간 자동화의 변경 범위

차단 요건 감사 자체는 운영 DB 조회만으로 수행했고, 감사 목적으로 gate 함수·source approval을 바꾸지 않았다. 이후 사용자가 요청한 큐 재개는 기존 claim→seal→submit 계약으로 별도 진행했으며, 살아 있는 다른 worker의 lease를 빼앗거나 갱신하지 않았다. 주간 자동화의 코드·Edge Function·Cron은 PR #148 작업으로 병합·배포했으며, 위 후속 확인에 적은 대로 검수 대기 주간호 1건을 생성해 재조회했다. 자동 승인이나 공개 발행은 없었다.

## 최신 운영 재확인 및 후속 상태 (2026-11-15 19:37 KST)

- 운영 `draft_jobs` 재조회: pending 223, claimed 1, failed 23, submitted 118, needs_human_review 1. 보고서 테이블은 총 225건(draft 76, published 149)이다. 수치는 자동 처리 중인 시점 스냅샷이다.
- claim 후보 predicate를 현재 운영 함수에 적용한 후보는 229건이다. 그중 `ai_ready`가 true가 아닌 건은 102건이며, 101건은 게시일이 있다. 현재 `claim_trend_draft_jobs`는 이들을 readiness 확인 없이 선점할 수 있지만, `submit_trend_draft`는 게시일이 있는 `ai_ready=false` 원고를 `Source approval was revoked`로 거부한다. `collector_retain_for_draft`도 같은 유형을 `retention_source_not_ai_ready`로 거절한다. 세 경로의 eligibility를 한 정책으로 정렬해야 한다.
- 현재 유일한 claimed 작업은 `6590e9c7-c033-45d1-8226-262fa653e1f1`, 작업자 `work-drafts-catchup-20261115T150215KST`, 2026-11-15 11:02:57 UTC(20:02:57 KST)까지 유효한 임대다. 조회 시각에는 아직 유효했으므로 빼앗거나 변경하지 않았다. 오래됐다는 이유만으로 제외하지 않으며, 실제 lease 만료 후 기존 재선점 계약으로 처리한다.
- 운영 DB 크기는 99,101,843 bytes로 400MB 상한 미만이다. 대기 작업을 멈추게 한 현재 원인으로 이 상한은 확인되지 않았다.
- 주간 Cron `weekly-digest-monday-0900`은 `0 0 * * 1` UTC, 활성 상태다. 2026-11-15 10:37 UTC 기준 `cron.job_run_details`는 0건이었다. 11월 16일 월요일 오전 9시 KST가 첫 정기 실행 예정이므로, 일요일에 실행된 별도 HTTP 200 사전 호출 및 검수 대기 주간 초안 저장을 정기 실행 성공으로 표현하지 않는다.
- 주간 실행은 자동 저장까지 검증됐지만, Cron 누락 시 과거 주차를 따라잡는 내구성 대기열은 없다. 여러 주가 누락되면 다음 실행에서 직전 완료 주만 계산할 수 있으므로, missed-run 탐지와 누락 주차 catch-up은 별도 개선 과제다.
- 기존 ChatGPT Work 일일 작업 `매일 한국어 초안 작성`의 ID는 `6acd8e18a8d8819183ea41c78312e398`, 기존 표시 시각은 매일 08:17 KST다. 사용자는 수집(03:00) 뒤·주간 월요일 발행(09:00) 전에 실행되도록 매일 05:25 KST 변경을 요청했다. 현재 연결된 Codex 자동화 도구는 이 Work 예약을 편집하지 못했고 브라우저/데스크톱 UI 접근도 실패해 실제 설정은 아직 변경되지 않았다. 중복 로컬/DB 예약은 만들지 않았다. OpenAI의 안내 경로는 ChatGPT의 Scheduled 화면에서 해당 작업을 편집하는 것이다.
- PR #149는 이 감사를 위한 문서 전용 변경이다. 본문에서 권고한 `ai_ready`·연결자료·재시도·짧은 원고 등 운영 게이트는 이번 조회나 문서 갱신으로 변경되지 않았다. PR 병합만으로 운영 차단 조건이 바뀌지는 않는다. 자동 승인·공개 발행도 하지 않았다.


### 최신 후속 확인 — 2026-11-15 20:06 KST

- 운영 `draft_jobs` 상태는 `pending=216`, `failed=28`, `submitted=121`, `needs_human_review=1`이며 조회 시 `claimed=0`이었다. 따라서 이 시각에 회수할 활성/오래된 선점 작업은 없고, 대기열 216건은 남아 있다. 이는 한 시점의 집계다.
- 2026-11-15 20:05 KST에 브라질 ANPD 공식 행사 기사 원문을 근거로 작성한 보고서 1건을 기존 서버 `collector_seal_trend_draft` → `submit_trend_draft` 경로로 저장했다. job은 `submitted`, report는 `draft`, `human_reviewed=false`, `published_at=null`이다. `reports`와 `publication_working_copies`의 제목·요약·본문이 모두 일치하고 작업실 사본 revision은 1이다. 자동 승인이나 공개 발행은 없었다.
- 일일 초안 예약은 기존 Work Scheduled task `매일 한국어 초안 작성` (ID `6acd8e18a8d8819183ea41c78312e398`)가 08:17 KST로 표시된 것을 앞서 확인했다. 사용자가 요청한 목표는 05:25 KST이나, 현재 연결된 도구에는 해당 Work 예약 편집 기능이 없어 실제 시각은 변경되지 않았다. 중복 예약은 추가하지 않았다.


### 사용자 일정 변경 반영 — 2026-11-15

- 사용자가 Work Scheduled task의 일일 초안 실행 시각을 직접 매일 오전 05:15 KST로 변경했다고 확인했다. 앞서 기록한 05:25 요청보다 최신 설정이다. 이 변경은 사용자의 직접 조작에 따른 기록이며, 이 세션에서는 예약 설정 자체를 수정하거나 별도 예약을 만들지 않았다. 월요일 주간 실행 09:00 KST와 03:00 수집 시각 사이에 배치된다.


### 최신 후속 확인 — 2026-11-15 20:44 KST

- 운영 큐 스냅샷: `pending=205`, `claimed=1`, `failed=29`, `submitted=130`, `needs_human_review=1`. 이 수치는 자동 회수 작업 중 변하는 시점 값이며, 대기열 전체가 완료됐다는 뜻은 아니다.
- 만료 선점은 0건이었다. 유일한 현재 선점은 `b36e3f99-7586-498f-962e-058ad44a3d6a`, worker `work-drafts-catchup-20261115T150215KST`, lease 만료 2026-11-15 12:14:02 UTC(21:14:02 KST)다. 다른 cloud worker가 유효하게 처리 중이어서 건드리지 않았다.
- 이전에 응답 크기 초과로 결과를 확인하지 못한 targeted claim `ff9e9cd7-7cee-4a44-945e-0d31110d81c4`는 재선점 전에 DB를 다시 조회해 실제 lease가 발급된 것을 확인하고, 그 동일 claim으로 이어 처리했다. PDPC의 현재 원문 판본 `fc711231-36af-4c14-a12c-19a00a4e2c95`를 사용했다. 보존된 공식 안내문 본문과 연결된 공식 제안 PDF 전체(97행)를 확인했고, 상세 목록 페이지는 사람 확인 화면으로 자동 열람되지 않았다. 본문은 안내문에서 직접 확인되는 범위만 다뤄 추가 정보를 추정하지 않았다.
- 로컬 `node scripts/trend-report.mjs --seal` 및 `--check`가 통과했다. 기존 서버 `collector_seal_trend_draft` → `submit_trend_draft` 경로로 저장한 결과는 job `submitted`, report `draft`, `human_reviewed=false`, `published_at=null`이다. report와 `publication_working_copies` revision 1의 제목·요약·본문이 제출값과 일치하는 것을 재조회했다. 검수·발행은 하지 않았다.
- 주간 Supabase Cron `weekly-digest-monday-0900`은 활성(`0 0 * * 1` UTC, 월요일 09:00 KST)이다. 11월 15일 조회에서 정기 실행 기록은 아직 없어, 11월 16일 예정 실행의 성공은 확인 전이다. 이전 수동 사전 호출의 성공과 구분한다.
- 일일 Work 예약은 사용자가 직접 05:15 KST로 바꿨다고 확인했다. 이 세션은 예약을 추가 수정하지 않았다.
- 이 실행은 큐 항목 1건을 검수 대기 초안으로 저장했지만, pending 205건은 남아 있다. 살아 있는 Work catch-up lease가 계속 처리 중이다. 이 문서 PR은 권고 사항을 기록하며 운영 gate를 바꾸지 않는다.


### 실패 작업 원문 범위 재검토 — 2026-11-15

- Work catch-up 작업 `723de8e3-abe3-4e54-bb63-b1d76c0e5c43`은 `attempts=3`으로 `failed` 처리됐다. 실패 메모는 결정 4건과 확약 1건의 상세 페이지를 자동 열람하지 못했다는 이유다.
- 그런데 작업이 보존한 동일 공식 안내문 판본에는 네 기관의 과징금 결정, 패치 관리·정기 보안 점검·지원 종료 소프트웨어·DPO/내부 정책 등 확인된 문제 유형, 100만 명 초과 영향과 무단 접근·유출, 확약 1건의 랜섬웨어 원인 및 약속된 기술 조치가 이미 기록돼 있다. 기관별 사건을 추정하지 않더라도 이 공통 발표의 확인된 범위로 짧은 원고를 작성할 수 있다.
- 이 사례는 연결된 개별 결정문을 전부 열지 못했다는 이유로 전체 초안이 실패 처리된 경우다. “열람 가능한 공식 본문에 근거해 작성하고, 세부 결정문에서만 확인될 내용은 쓰지 않는다”는 사용자 지시와 맞지 않는다. 이대로 두면 attempt 상한 3 때문에 이 원문 판본은 현재 claim 경로에서 다시 잡히지 않는다.
- 운영 함수 목록에는 실패 작업을 정상 재시도 가능 상태로 돌리는 전용 RPC가 없다. 이 점은 임의 SQL로 attempts를 낮춰 우회하지 않고, 후속 개선에서 실패 원인별 재시도/복구 계약을 추가해야 할 차단 항목으로 기록한다. 실패는 검수 승인이나 공개 발행과 관계없다.


### 후속 확인 — 2026-11-15 21:12 KST

- PR #148은 병합된 상태다. 운영 Supabase Cron `weekly-digest-monday-0900`은 `0 0 * * 1` UTC, `active=true`이며 Edge Function `weekly-digest`도 `ACTIVE`, version 1로 조회됐다. 수동 사전 실행에서 8건을 검수 대기 draft로 저장한 실행 기록은 확인되지만, 11월 16일 09:00 KST 정기 실행은 아직 발생 전이다. 정기 실행 성공으로 간주하지 않는다.
- 운영 큐 스냅샷은 `pending=200`, `claimed=1`, `failed=28`, `submitted=136`, `needs_human_review=1`이다. Work worker `work-drafts-catchup-20261115T150215KST`가 원고 1건을 유효 임대(21:40 KST까지) 중이어서 회수하거나 변경하지 않았다.
- 이 세션은 현재 claim→로컬 `--seal`/ `--check`→서버 `collector_seal_trend_draft`/ `submit_trend_draft` 절차로 원고 2건을 추가했다: PDPC 결정·확약 공지 report `4f76820e-2862-4e0a-ab58-a02373de0fa2`, APPA 익명처리 안내서 발표 report `e9041923-fb00-4a09-bea2-931cb3d9ba95`. 각 작업실 사본의 제목·요약·상세 본문이 report와 일치하고 `status=draft`, `human_reviewed=false`, `published_at=null`임을 재조회했다. 검수·공개 발행은 하지 않았다.
- APPA 원고의 링크된 PDF는 23쪽 전체를 확인했으나 표지에 2025년 6월 발간으로 표시됐다. 2024년 11월 발표문 당시의 판본인지 확인되지 않아, PDF 세부 내용을 발표 당시의 사실처럼 원고에 넣지 않았다. 발표문에서 확인되는 행사·목적·대상 데이터 범위만 사용했다.
- 이 문서 PR은 차단 요건 감사와 권고를 기록한다. 저장소/운영 DB의 gate 함수는 변경하지 않았다. 최신 큐에도 200건의 pending과 28건의 failed가 남아 있어 대기열 처리가 완료된 것은 아니다.
