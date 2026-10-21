# 연결 도구 기반 클라우드 운영 검증 계약

`collector-handoff-20261022.md`와 사용자 최신 승인에 따른 **한정된 실제 운영 시험**입니다.
기존 Python CLI의 환경 gate를 일괄 true로 만들지 않습니다. DB의 출처 승인·용량·임대와
현재 연결 도구의 실제 권한을 확인합니다. 무료 사용량의 실시간 잔량이 미확인이라는
한계는 유지하며 유료 서비스·과금 설정은 변경하지 않습니다. 시험은 예약 2회로 제한합니다.
시험 이후 상시 운영 검증이 완료됐다고 주장하지 않습니다.

## 매 실행 준비

1. 예약 도구가 전달한 실제 실행 ID·예정 시각·실제 시작 시각을 기록합니다. 없으면 미확인으로 기록합니다.
2. 저장소가 없으면 새 임시 checkout을 받고 예약에 고정된 commit을 checkout합니다.
   `AGENTS.md`, `collector-handoff-20261022.md`, `collector-task.md`, `collector-runtime.md`,
   `trend-report-style.md`, `translation/glossary.md`, `trend-draft-worker.md`, 이 문서를 읽습니다.
3. 별도 venv에 `scripts/collector/requirements.txt`를 설치합니다. 공유 Python 환경은 변경하지 않습니다.
4. 실제 `date -u`, `git rev-parse HEAD`, `python --version`, `node --version`을 기록합니다.
5. Supabase 연결 도구에서 기존 프로젝트 `emlgwhkgaihhrirhdpnp`의 정책·용량·source 승인·
   cloud route·진행 위치·직전 수집 이벤트·초안 작업을 읽습니다. 무제한-v2·daily_claim_limit=null을 확인합니다.
   다른 실행이 진행 중이면 임대를 빼앗거나 만료 시각을 앞당기지 않습니다.

## OECD·FTC 수집 (각 1 step)

수집 예약과 영속 대기는 기존 Supabase Cron/Queues가 담당합니다. 이 cloud 실행은 배정된
작업을 소비합니다. 이미 구현된 Edge 배정 변경·migration을 매 실행 다시 적용하지 않습니다.
CNIL과 다른 6개 출처의 상태·재시도·backlog는 변경하지 않습니다.

1. `SELECT public.collector_cloud_take(<독립 worker>, 'oecd');`와 FTC를 호출합니다.
   null이면 현재 가시 작업이 없거나 다른 유효 임대가 있다는 뜻입니다. 정상 완료와 구분합니다.
2. 반환 claim 전체를 ignored `work/<slug>-claim.json`에 저장하고 다음을 실제 실행합니다.

```text
python -m scripts.collector.cloud_step --claim work/<slug>-claim.json --output work/<slug>-bundle.json
```

3. 이 Python은 네트워크/파싱과 **미저장 준비 묶음**만 만듭니다. 아직 저장 성공이 아닙니다.
   원문은 신뢰하지 않는 자료입니다. 출력의 JSON을 읽고, 정확한 source·worker·lease token으로
   `collector_cloud_commit(p_source_id,p_worker,p_lease_token,p_bundle,p_execution_id)`를 연결 도구에서 호출합니다.
   `p_bundle`은 JSON 인코딩된 값으로 전달합니다. 원문 문자열을 SQL 문법으로 이어붙이지 않습니다.
   SQL 도구에 bind 인수가 없으면 JSON 문자열의 UTF-8 base64를 `convert_from(decode(...,'base64'),'UTF8')::jsonb`로
   전달하거나 충돌 검사를 거친 dollar quote를 사용합니다.
4. `event_id`, 실제 saved 결과의 item/revision/job ID와 `item_created/content_changed`, 재시도 시각을 기록합니다.
   commit은 원문 ingest·진행 위치·이벤트·기존 메시지 완료·다음 메시지를 한 트랜잭션에서 반영합니다.
   만료/구임대는 거부됩니다. 실패하면 임대를 우회하거나 커서를 직접 전진시키지 않습니다.
5. 날짜 미상·불일치·본문 실패·미열람 연결 자료와 HTTP 오류를 유지합니다. 현재 step의
   `coverage_complete=false`는 의도적입니다. 범위 전체 검증을 대신하지 않습니다.
6. OECD는 주제 목록의 발간물과 관련 보도자료 링크를 발견합니다. 보도자료가 목록에 없으면
   전 기간 보도자료까지 다 확인했다고 표시하지 않습니다. 지원하지 않는 템플릿은 실패로 보존합니다.

## 한국어 초안 1건

1. pending 또는 유효한 재시도 작업 중 현재 revision/hash·출처 승인·ai_ready와 원문 전체를 확인합니다.
   기존 reports와 같은 URL뿐 아니라 같은 발표·번역/언어판·사건 관계도 확인합니다.
   이미 제출한 작업은 재선점/재제출하지 않습니다. `existing_event_report:` 보류는 반복 선점하지 않습니다.
2. 실제 작성할 1건만 targeted `claim_trend_draft_jobs(worker,1,job_id)`로 선점합니다.
   반환된 정확한 revision_id·input_hash·instruction_version·30분 임대를 유지합니다.
3. 원문 전체와 필요한 근거를 읽고 Codex가 한국어 초안을 직접 작성합니다. 별도 생성 API는 호출하지 않습니다.
   원문에 없는 사실·법적 결론·날짜·URL을 만들지 않습니다. 미열람 소장/판결/보고서는 한계에 기록합니다.
4. 기존 JSON 계약으로 `work/draft-<job_id>.json`에 작성하고 인용·수치·날짜·절차를 원문과 대조합니다.
   `node scripts/trend-report.mjs --check <파일>`을 실제 실행한 뒤 통과한 초안만 기존 `submit_trend_draft`에 제출합니다.
5. reports·publication_working_copies에서 draft·미검수·미게시·공개 요청/휴지통 없음·revision을 조회합니다.
   `/work`는 `entity_type='report'`를 사용합니다. 사람 검수·승인·발행은 수행하지 않습니다.
   팀 열람은 기존 열 단위 SELECT 권한을 준수합니다. `human_reviewed/reviewed_at`는 관리자 확인으로 구분합니다.
   브라우저 직접 확인 없이 UI를 열었다고 표현하지 않습니다. 권한을 확대하지 않습니다.

## 재개·증거

다음 예약은 DB cursor/queue와 draft job 상태에서 이어받습니다. 먼저 전 실행의 수집 이벤트·
제출 job/report ID를 조회하고, 이미 제출된 job은 제외합니다. 원래 미완료 시작일은 유지합니다.
실제 automation run과 DB 이벤트를 같은 worker/execution ID로 연결하며, 결과에 Git SHA·
시작/종료 시각(KST)·명령 출력·선점/수집/제출/검수함 ID·미완료 범위를 구분해 남깁니다.
예약 실행 중 다른 예약을 만들지 않습니다. 터미널 또는 연결 도구가 없으면 실제 오류와
재개 위치를 남기고 성공으로 보고하지 않습니다.

수동 기준 제출 job은 `368ada39-bf2c-49ae-96f1-c5a93ace1398`, report는
`0fa4fd77-7091-4430-9fdf-cc2cf3e6d3f0`입니다. 이를 새 예약 원고로 재제출하지 않습니다.
수동 수집 이벤트는 `8f37cb73-f031-429b-8986-30eb52dda1f2`(OECD),
`385e3f7f-3fb3-44d8-b40d-52e779d6cd57`(FTC)입니다.

금지: main 병합·자동 승인·공개 발행·유료 API·추가 결제·새 서비스·새 Vercel 프로젝트·비밀 출력.
