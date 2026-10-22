# 정기 클라우드 수집·한국어 초안 운영

2026-10-22 사용자의 상시 자동 수집·작성 마무리 승인에 따른 실행 계약입니다.
기존 `collector-cloud-task.md`의 2회 한정 시험은 종료됐으며, 이 문서는 정기 실행에
적용합니다. 문체·용어집·RPC 계약·사람 검수 절차는 기존 문서를 따릅니다.

## 시작과 실행 한도

- 예약에 고정된 Git SHA에서 AGENTS.md, collector-handoff-20261022.md,
  collector-runtime.md, collector-cloud-task.md, trend-draft-worker.md,
  trend-report-style.md, translation/glossary.md와 이 문서를 읽습니다.
- 매번 새 임시 checkout과 별도 venv를 준비합니다. 실제 date -u, git SHA,
  Python·Node 버전을 기록합니다. 이전 임시 파일의 존재를 전제로 하지 않습니다.
- 기존 Supabase 연결 도구와 클라우드 터미널을 사용합니다. 키를 추출하지 않습니다.
  터미널 부재·명령 실패·도구 권한 거부는 실제 오류와 재개 위치를 보고합니다.
- 기존 조직 jmrcuzqqloyzakzhboyg의 plan=free, 프로젝트 emlgwhkgaihhrirhdpnp의
  용량·출처 승인·정책을 조회합니다. 요금제가 바뀌었거나 비용 조건이 불명확하면
  추가 수집을 중단하고 보고합니다. 2026-10-22 plan=free는 실제 확인했지만,
  실시간 전송량·함수 잔량은 미확인입니다. 무료 잔량 확인으로 표현하지 않습니다.
  FREE_LIMITS_VERIFIED 등 기존 Python 환경 gate를 위조하지 않습니다.
- 이 연결 도구 경로는 기존 DB 승인·용량·실제 임대와 사용자의 운영 승인을
  적용합니다. 무료 한도 초과 응답은 중단 사유이며 과금 설정을 변경하지 않습니다.
- 실행 시간은 20분 이내입니다. OECD·FTC는 각 최대 5 step만 처리합니다.
  이는 실행 배치 한도이며 하루 초안 수 또는 수집 표본의 영구 상한이 아닙니다.

## 수집과 중복 없는 재개

1. 직전 cloud-automation-summary와 제출 job/report, source 상태·route cursor·
   큐·backlog를 먼저 읽습니다. 현재 유효 임대가 있으면 빼앗지 않습니다.
2. OECD·FTC는 collector_cloud_take → cloud_step → collector_cloud_commit을
   사용합니다. 각 claim과 bundle은 ignored work/에 두고 SQL에는 base64 인코딩된
   UTF-8 JSON으로 전달합니다. commit 응답의 event/item/revision/job을 기록합니다.
3. bundle.result에 실제 automation ID/run ID/예정 시각/trigger=scheduled와
   지침 git_sha를 추가합니다. 문맥에 없는 실행 ID는 만들지 않고 null로 남깁니다.
   queue message kind와 실행 trigger는 별개이므로 둘을 혼동하지 않습니다.
4. 동일 출처의 다음 claim은 앞 commit 성공 후에만 진행합니다. null claim은
   현재 가시 작업 없음으로 기록합니다. fingerprint 변경·중복도 그대로 기록합니다.
5. 나머지 7개 출처는 기존 Edge/Cron이 처리합니다. 승인 출처·호스트·route·
   원래 미완료 시작일·CNIL 재시도를 변경하지 않습니다. coverage_complete=false를
   유지하고 실패 HTTP·미열람 첨부·날짜 충돌을 없애지 않습니다.

## 한국어 작성과 제출

1. unlimited-v2와 daily_claim_limit=null을 확인합니다. pending/유효한 재시도
   작업을 읽기 전용으로 비교해 실제 개인정보 관련성이 있고 기존 보고서와 같은
   발표·언어판 중복이 없는 후보를 고릅니다. submitted와 existing_event_report:
   보류 작업은 다시 선점하지 않습니다. 작업 1건씩 targeted claim을 사용합니다.
2. 정확한 revision/input_hash/instruction_version과 30분 임대를 유지합니다.
   원문 전체를 읽고 이 Codex 실행에서 한국어 보고서 초안을 직접 작성합니다.
   별도 생성 API를 호출하지 않습니다. 인용·주체·날짜·수치·법적 단계를 대조합니다.
3. node scripts/trend-report.mjs --check work/draft-<job_id>.json을 실제 통과한
   원고만 submit_trend_draft로 제출합니다. 실패는 기존 fail RPC로 남깁니다.
   시간 내 다음 적격 작업을 이어가고 남은 작업은 DB에서 다음 예약이 처리합니다.
4. reports·publication_working_copies(entity_type=report)·get_trend_collector_review()
   에서 새 ID와 draft·미검수·미게시·공개요청 없음·revision을 확인합니다.
   관리자 조회와 팀 RLS·브라우저 직접 확인을 구분하고 권한을 확대하지 않습니다.

## 결과 보고와 기록

collector_edge_events에 source_id=null, trigger_kind=cloud-automation-summary로
실행별 요약을 기록합니다. execution_id는 확인된 예약 run ID를 우선 사용하고,
없으면 독립 UUID를 사용하되 예약 run ID는 미확인이라고 표시합니다. 시작·완료 시각,
automation/run ID·Git SHA·수집 이벤트·job/revision/input_hash/report·검증 출력과
미완료 범위를 JSON에 남깁니다. 원문·초안 전문·비밀값은 로그 요약에 넣지 않습니다.

사용자에게 한국어로 새 초안 제목·공식 출처·보고서 ID·검수 대기 상태와 수집 실패·
남은 범위를 보고합니다. 신규 초안이 없으면 실제 수집/대기함 상태를 설명합니다.
저장·보고 성공과 실제 예약 실행 성공을 구분합니다. 미래 실행을 미리 성공 처리하지
않습니다. 예약 실행 중 새 예약 생성·migration 재적용·route 재설정은 하지 않습니다.

금지: main 병합, 기존 보고서 덮어쓰기, 자동 승인·공개 발행, 유료 API·추가 결제,
새 외부 서비스·별도 Vercel 프로젝트, 사용자 PC에 의존하는 운영, 비밀값 출력.
