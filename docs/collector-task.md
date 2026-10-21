# 실행 계약

이 실행 지침은 예약 장치 자체가 아니다. Codex를 사용하는 데스크톱 앱의 예약 작업에서
선택한 **로컬 프로젝트**를 실행 대상으로 삼는다. PC와 앱이 실행 중이어야 하며,
웹 예약 작업이나 관리형 cloud 환경이 그 로컬 폴더를 유지한다고 가정하지 않는다.
예약 등록·활성화·요금제·승인값은 이 지침으로 바꾸지 않는다.

## 매 실행 입력

1. `AGENTS.md`, `docs/collector-runtime.md`, `docs/trend-report-style.md`,
   `docs/translation/glossary.md`, `docs/trend-draft-worker.md`를 실제로 읽는다.
2. 요청에 `사전검사`가 있으면 아래 preflight만 수행하고 종료한다.
3. 운영 실행은 사용자가 예약 활성화를 승인했고 프로세스의 `SCHEDULE_ENABLED`,
   `COLLECTION_ENABLED`, `FREE_LIMITS_VERIFIED`, `CLOUD_PIPELINE_VERIFIED`가 모두
   `true`일 때만 한다. 누락된 값을 알아서 true로 만들지 않는다.
4. 자격 증명은 기존 보안 환경 변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`로
   받는다. 값을 읽어 출력하거나 대화·프롬프트·저장소에 넣지 않는다. GitHub
   Secrets가 로컬 프로젝트에 자동 전달된다고 가정하지 않는다.
5. 기존 9개 출처 설정을 사용한다. 새 출처·유료 API·추가 결제·외부 서비스를
   추가하지 않는다. main 병합, 배포, 사람 승인과 공개 발행도 수행하지 않는다.

## 사전검사

프로젝트에 준비된 Python 환경에서 다음을 실행한다.

```text
python -m scripts.collector.preflight --output work/collector-preflight.json
```

이 명령은 DB 출처 승인·용량과 공식 목록·표본 본문을 읽는다. 원문 저장, 초안
선점·제출, 체크포인트 변경은 하지 않는다. 결과는 **이 실행 컴퓨터**에만 적용된다.
`collection_preflight_passed`와 출처별 `database`, `access`를 각각 읽는다.
한 출처가 실패해도 성공한 다른 출처의 증거를 지우지 않으며, 9곳 모두 통과했다고
보고하지 않는다. JSON의 `runtime`은 실제 프로세스에서 관측한 환경이다.
로컬 명령 성공만으로 앱 예약 등록·실행을 확인했다고 쓰지 않는다.

## 운영 수집과 작성

1. 사전검사 실패 시 그 출처·단계·이유를 남긴다. 사용자 승인 없이 전체 출처
   설정을 줄이거나 실패를 빈 목록으로 처리하지 않는다. 실패를 고치려고 반복
   전체 수집하지 않는다.
2. 운영 게이트와 `collector_get_progress`의 저장 범위를 확인한 후 기존 CLI를
   출처별로 실행한다. 미완료 범위도 마지막 성공일도 없으면 최초 범위가 정해지지
   않은 것이므로, CLI의 7일 기본값으로 승인된 월간 범위를 대신하지 말고 보류한다.
   `python -m scripts.collector.run --write --scheduled --source <기존 출처 ID> --output work/collector-<출처>.json`
   같은 출처를 동시에 실행하지 않는다. 다음 실행에서는 DB의 저장된 범위를
   이어받으며 `partial`을 완료라고 쓰지 않는다. 입력 범위를 임의의 1주로 바꾸지 않는다.
3. 기존 `SupabaseStore.rpc()`로 `collector_draft_policy()`를 읽어 무제한-v2
   정책을 확인한다. 배치 1건씩 `claim_trend_draft_jobs`를 호출하고 반환된 정확한
   `job_id`, `revision_id`, `input_hash`, `lease_until`, `content_text`, 공식 URL,
   날짜 관찰과 읽은 범위를 사용한다. 기존 보고서는 덮어쓰지 않는다.
4. 원문과 필요한 첨부를 읽고 이 Codex 실행에서 한국어 초안을 작성한다. 외부
   생성 API를 호출하지 않는다. 모든 장문 보고서를 무조건 전부 읽지 않으며,
   기사 주장에 필요한 부분만 확인하고 실제 읽은 범위를 남긴다.
5. 주요 후보는 개인정보 처리·권리·법적 의무·특별한 정보·침해·감독/구제에
   직접 연결되고, 새로운 사실·실질적 조치와 추적 가능한 공식 근거가 있어야
   한다. 일반 AI/보안·행사·제품·시장 전망은 구체적 연결이 없으면 인접/제외,
   근거가 약하면 검토 필요로 분류해 이유를 남긴다. 조사·혐의·제안·항소를
   확정 위반·시행·판결로 쓰지 않는다. URL을 추정하지 않는다.
6. `work/draft-<job_id>.json`에 초안을 쓰고
   `node scripts/trend-report.mjs --check <파일>`을 통과시킨다. 문체 검사와
   별개로 원문 인용·날짜·금액·절차·조건을 대조한다. 작성자 해석은 강제하지
   않으며 `policy_implications_ko`는 빈 값으로 둘 수 있다.
7. 정확한 작업·worker·판본으로 `submit_trend_draft`에 구조화된 JSON 인수를
   전달한다. 실패에는 기존 `fail_trend_draft`를 사용한다. 임대가 끝난 원고를
   새 작업에 붙이지 않는다. 다음 1건으로 이어가며 하루 10건 상한을 만들지 않는다.
8. 제출 상태가 `draft` 또는 `needs_human_review`인지 확인하고 보고서 ID를
   기록한다. 대기함 반영을 조회할 권한이 없으면 그 검증은 미확인으로 남긴다.
   자동 승인·공개 발행은 하지 않는다.

## 실행 결과

`work/`에 원문·초안 작업 파일을 두고 커밋하지 않는다. 결과 보고에는 실행 환경,
출처별 성공·실패·보류, 수집/한국어 작성/검수함 저장 단계, 미완료 범위, 제출 ID를
구분한다. 대기 작업이 없다는 것과 수집 실패를 구분한다. 시간·구독 사용량으로
중단되면 이미 완료한 제출과 남은 작업을 기록하고, 다음 예약 실행이 DB 상태에서
이어가도록 한다. 사용량 초기화가 이 대화를 저절로 재개시킨다고 주장하지 않는다.
