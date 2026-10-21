# 9개 출처 정기 수집 준비와 실행 경계

**실행 기반 후속:** [자동 실행 기반](collector-runtime.md)은 사용자 PC와 독립된
클라우드 수집·편집 요구, 실제 서버 사전검사와 남은 연결을 정리합니다.
아래 GitHub cron 준비는 과거 구현 기록입니다. 최신 아키텍처 3.1절은 Supabase
Cron·Queues·Edge Functions에 수집을 맡기고 GitHub Actions는 검증에 사용합니다.

**2026-10-21 후속:** 사용자 승인과 운영 DB를 대조해 출처 9개의 설정·ID를 연결했고,
등록된 Actions 자격 증명으로 수동 쓰기 실행 및 새 한국어 초안의 운영 검수 화면
반영을 확인했습니다. 예약 스위치는 false입니다. 아래 2026-10-13의 비활성 설정과
출처 ID 미연결 표는 과거 상태입니다. 실제 결과와 GitHub 접근 실패 3곳은
[수동 운영 검증](collector-operational-validation-20261021.md)을 기준으로 확인합니다.

2026-10-13 기준입니다. 기존 수집기를 확장했으며 새 환경·유료 서비스·운영 승인·출처 자동 등록은 추가하지 않았습니다. 현재 브랜치에는 정기 실행 정의가 준비되어 있지만 main 병합과 실행 변수 변경은 하지 않았습니다. 실제 정기 수집 활성화나 9개 출처 운영 완료를 뜻하지 않습니다.

## 실행 경로

GitHub Actions cron은 `17 22 * * *` UTC, 다음 날 한국시간 07:17입니다. GitHub는 기본 브랜치에 있는 workflow만 예약 실행하며 실행 시간이 지연되거나 누락될 수 있습니다. PR 브랜치에 cron을 정의한 것만으로 예약이 작동하지 않습니다.

예약 이벤트는 job 시작 전에 `SCHEDULE_ENABLED`, `COLLECTION_ENABLED`, `FREE_LIMITS_VERIFIED`, `CLOUD_PIPELINE_VERIFIED`가 모두 문자열 `true`인지 확인합니다. 하나라도 누락되거나 다르면 runner 할당·checkout·의존성 설치·검사·DB RPC를 수행하지 않습니다. 실제 변수 값은 이번 인증으로 확인하지 못했으며, off 상태라고 조회한 것으로 표현하지 않습니다. 이 작업에서는 어떤 실행 변수도 설정하지 않았습니다.

예약 경로는 자동으로 `--write --scheduled`를 전달합니다. CLI도 `SCHEDULE_ENABLED=true`와 기존 운영·비용·연결 게이트를 다시 확인합니다. 수동 실행의 기본은 `dry-run`이며 `probe`, `write`를 명시적으로 선택할 수 있습니다. 수동 write도 기존 세 가지 운영 게이트와 출처별 승인이 필요합니다. 기존 프로젝트를 대상으로 하는 수동/예약 실행은 하나의 concurrency group을 사용하고 진행 중 작업을 취소하지 않습니다. 이 잠금은 이 workflow 안에서만 적용됩니다.

관리형 작업 환경의 연결 키와 GitHub Actions 런타임의 자격 증명은 서로 별개입니다. GitHub variables/secrets 목록을 읽는 API는 실제로 호출했지만 둘 다 `HTTP 403 Resource not accessible by integration`이어서 등록 여부·값·예약 활성 상태를 확인하지 못했습니다. 비밀 값은 읽거나 출력하지 않았습니다. 작업 환경에서 성공한 운영 시험은 Actions 인증 성공을 보장하지 않습니다.

## 출처별 사전 검사

| 출처 | config source_id | config 수집·저장·AI / enabled | 운영 DB 상태 |
| --- | --- | --- | --- |
| EDPB | 기존 UUID | 모두 false | is_active=true, terms_reviewed_at=null |
| OECD | 기존 UUID | 모두 false | is_active=true, terms_reviewed_at=null |
| CURIA | 기존 UUID | 모두 false | is_active=true, terms_reviewed_at=null |
| CNIL | null | 모두 false | source_id 연결 미완료 |
| ICO | null | 모두 false | source_id 연결 미완료 |
| DPC | null | 모두 false | source_id 연결 미완료 |
| PDPC | null | 모두 false | source_id 연결 미완료 |
| PPC | null | 모두 false | source_id 연결 미완료 |
| FTC | null | 모두 false | source_id 연결 미완료 |

수집기는 먼저 설정의 enabled와 collect/store/ai 승인을 각각 검사하고 write에는 유효한 source_id도 요구합니다. 모든 출처가 이 단계에서 보류되면 Supabase 클라이언트도 만들지 않습니다. 등록되지 않은 출처를 자동 생성하거나 설정/DB의 승인을 자동 변경하지 않습니다. 설정의 기존 `hold_reason`은 그대로 남기고 실제 검사 이유를 `eligibility_reasons`와 `reason`에 별도로 기록합니다.

정적 검사 통과 후에만 DB `collector_source_allowed` → `collector_capacity` → 범위/재개 조회 → 공식 목록/본문 순서로 진행합니다. DB 승인이 없으면 범위 조회와 본문 요청을 하지 않습니다. 본문 저장 직전에도 기존 용량·승인 검사를 다시 수행합니다. DB 오류나 저장 중단이 나오면 다음 출처와 실행 로그의 DB 쓰기를 중단하며 로컬 결과 파일에 이유를 남깁니다. 실행 로그 저장 직전에도 용량을 다시 검사합니다. 모든 출처가 보류된 실행은 DB에 로그를 쓰지 않습니다.

2026-10-13 운영 읽기 전용 재조회는 DB `13,347,987`바이트, `can_write=true`였습니다. 사용자 제공 Usage 화면은 Free Plan, Database `0.29/0.5 GB`, Egress `0.003/5 GB`였습니다. 화면의 조직 사용량과 RPC 프로젝트 DB 값은 측정 범위가 다르므로 서로 대체하지 않습니다. 이 값은 당시 증거이며 반복 운영의 실시간 잔량 확인이 아닙니다. 용량 중단 기준은 기존 `400,000,000`바이트이며 유료 전환·추가 모델 API는 없습니다.

## 범위, 재시도와 한계

예약 실행은 저장된 미완료 범위와 cursor가 있으면 그 since/until을 우선 재개합니다. 날짜가 바뀌어도 끝내지 못한 범위를 바꾸지 않으며, 완료 뒤 다음 실행에서 새 범위를 시작합니다. 수동 실행은 명시한 범위가 우선이고 같은 범위로 재개할 수 있습니다. 예약 모드에서는 since/until override를 허용하지 않습니다.

마지막 완전 성공 날짜에서 3일 겹침, 성공 기록이 없으면 최근 7일을 사용합니다. 요청 until 이전으로 시작일을 제한하여 미래 체크포인트가 잘못된 범위를 만들지 않습니다. 상세 읽기 실패는 해당 항목 위치를 그대로 저장하고 출처를 중단합니다. 다음 동일 범위 실행은 실패한 항목을 다시 읽으며 실패 항목을 건너뛰지 않습니다. HTTP 일시 오류는 기존 최대 3회, Retry-After 최대 60초를 유지합니다. 영구 실패를 자동 승인하거나 무제한으로 재시도하지 않습니다.

기존 기본 한도는 출처당 목록 최대 10페이지·문서 최대 30건, 수집 HTTP 공유 예산 최대 100회·10분, 응답 최대 2 MB입니다. workflow 전체 제한은 20분입니다. DB RPC도 자체 HttpClient 한도를 사용하며 수집 HTTP 예산과 별개입니다. 본문은 80,000자까지이며 일부 전문을 잘라 전체로 저장하지 않습니다. 원본 HTML/PDF 응답을 영구 파일이나 유료 artifact로 보관하지 않습니다. CURIA 보도자료·OECD 초록·첨부 미열람 범위는 기존 metadata로 구분합니다.

체크포인트는 페이지 순회가 끝났고 이전/현재 실패와 날짜 미상 항목이 없는 경우에만 전진합니다. 날짜 미상 항목은 검토 필요로 저장하되 성공 범위로 계산하지 않습니다. 현재 `had_pagination`은 실제 다음 페이지를 보았다는 증거이며 기관 전체 기간·목록 완전성을 증명하지 않습니다. 단일 목록/RSS는 계속 partial이고, 여러 페이지를 끝내도 목록 바깥 자료나 날짜 경계의 완전성을 추가 검증한 것은 아닙니다. 출처별 전체 건수·날짜 경계 증명은 이번에 확대하지 않았습니다.

## 결과와 확인 방법

| outcome | 종료 코드 | 의미 |
| --- | --- | --- |
| success | 0 | 선택 출처가 현재 구현의 범위 완료 조건을 통과 |
| diagnostic_success | 0 | probe의 목록/표본 해석 성공; DB 수집·초안 성공 아님 |
| failed | 1 | 수집·DB·실행 로그 오류 |
| blocked | 2 | 모든 출처 보류 또는 실행 게이트 미충족 |
| partial | 3 | 범위 미완료 또는 성공/보류 출처가 섞인 실행 |

`operation_success`는 write의 success에서만 true입니다. dry-run에서 기존 정책에 막힌 경우도 blocked로 남겨 GitHub의 성공 표시와 수집 성공을 혼동하지 않습니다. 수집이 끝나도 한국어 초안·사람 검수·발행 완료를 뜻하지 않습니다. 초안 단계는 [초안 편집 실행 지침](./trend-draft-worker.md)과 별도입니다.

DB RPC 실패와 실행 로그 기록 실패에도 `work/collector-result.json`을 남깁니다. workflow는 성공/실패 여부와 관계없이 최대 12,000자의 JSON 요약을 남깁니다. 요약에는 원문 응답이나 비밀 값을 포함하지 않습니다. job 자체가 게이트에서 skip된 경우에는 실행 결과 파일을 만들지 않으며 GitHub에서 skipped로 보입니다.

현재 설정에서 다음 명령은 DB 없이 blocked 결과와 종료 코드 2를 반환합니다.

```bash
python -m scripts.collector.run --output work/collector-result.json
```

전체 검사는 `python -m unittest discover -s tests -p 'test_collector*.py'`입니다. 이번 회귀검사는 외부 DB/HTTP 경계만 대체하여 정적 보류 무DB, approval 전 범위 조회 금지, 용량 중단 뒤 로그 무쓰기, RPC 실패 결과 보존, partial 종료 코드, 날짜 미상 checkpoint 차단, 실패 항목 재시도와 날짜 변경 뒤 범위 재개를 검증합니다. 실제 출처 승인·정기 이벤트·Actions 인증·9개 출처 전체 기간 수집은 이 검사로 확인되지 않습니다.
