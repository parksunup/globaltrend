# 정기 클라우드 수집·일일 초안 및 주간 보고 운영

2026-10-22 기준 운영 계약입니다. 일일 생산 예약은 증분 수집·한국어 초안 작성·검증·기존 /work 검수함 제출을 담당하고, 월요일 주간 예약은 직전 월~일 자료를 집계해 이 대화 실행 결과로 보고합니다. 두 역할은 기존 DB cursor, backlog, job/report 상태와 collector_edge_events 실행 요약을 공유해 중복을 막습니다. 주간 집계 예약은 수집·claim·제출 RPC를 호출하지 않습니다.

과거 `collector-cloud-task.md`의 2회 시험 한도는 종료된 한정 시험 계약입니다. 현재 정기 운영에 적용하지 않습니다. 기존 사람 검수 절차를 따르며 자동 승인·공개 발행은 하지 않습니다.

## 공통 실행 준비와 안전 조건

- 예약 prompt에 고정된 Git SHA에서 `AGENTS.md`, 인계 문서, 런타임·수집·초안 작성 지침, 용어집과 이 문서를 읽습니다.
- 매 생산 실행은 새 임시 checkout과 독립 venv를 준비합니다. 실제 `date -u`, Git SHA, Python·Node 버전을 기록합니다. 이전 임시 파일에 의존하지 않습니다.
- 기존 Supabase 연결 도구와 사용자 PC에 독립된 클라우드 터미널을 사용하고 키를 추출하지 않습니다. 도구 부재·명령 오류·권한 거부는 실제 오류와 재개 위치를 보고합니다.
- 조직 `jmrcuzqqloyzakzhboyg`의 요금제와 프로젝트 `emlgwhkgaihhrirhdpnp`의 저장용량·출처 승인·초안 정책·실제 임대·route·cursor·queue·backlog를 실행마다 확인합니다. live 무료 전송량/실행 잔량이 미확인이면 미확인으로 남기고 `FREE_LIMITS_VERIFIED`를 위조하지 않습니다.
- 비용·저장용량·승인·권한 gate가 실패하거나 무료 한도 초과가 반환되면 우회·과금 설정 변경 없이 중단하고 정확한 오류와 재개 위치를 기록합니다. 기존 작업 임대·요청 간격·backoff는 준수합니다.
- 운영자가 정하지 않은 실행 시간·출처별 step 수·일일 초안 수 상한을 두지 않습니다. 실제 플랫폼 실행 한도, RPC 임대·요청 제한, 비용/권한 gate는 유지합니다. 같은 실패나 무진행 cursor를 즉시 반복하는 무한 루프는 금지하고 재시도 시각과 사유를 보존합니다.
- 각 commit/submit 이후 영속 상태와 실행 요약을 확인합니다. 중단된 작업은 DB cursor·queue·backlog/job 상태를 대조해 다음 실행에서 재개합니다. 미완료 범위를 건너뛰거나 지우지 않습니다.
- 일일 수집은 **직전 이틀과 당일, 합계 3일**의 게시일만 확인합니다. 같은 날 목록을 다시 확인하면 2일 범위입니다. 예약 실행이 빠진 날은 그 날짜를 별도로 따라잡습니다. 과거 장기 목록의 미완료 위치는 `collector_historical_scans`에 보관하고 일일 경로에서 계속 실행하지 않습니다. 과거 수집은 별도 승인·실행으로 재개합니다. 전환 전 확인 범위와 완전성 미확인 경고는 `collector_scan_windows`에 남기고, 실패한 개별 URL은 기존 backlog에 그대로 둡니다. 목록을 끝까지 읽었다는 사실을 그 기간의 모든 기사를 확인했다는 뜻으로 보고하지 않습니다.

## 일일 증분 생산자

일일 예약은 새로 발견된 자료와 기존 미완료 범위를 처리하고, 실제 개인정보 관련성이 있는 비중복 자료를 한국어 보고서체 초안으로 제출합니다. 일일 실행은 전주 주간 호의 확정/집계 역할을 맡지 않습니다.

1. 직전 daily producer 요약, **9개 출처 전체**의 수집 이벤트·제출 job/report, 출처 상태, cloud cursor·queue·backlog를 읽습니다. `docs/collector-daily-evidence.sql`의 한국시간 날짜를 해당 실행일로 바꿔 읽기 전용 집계하고, `daily-cron`(Edge 예약), `manual-validation`(수동), cloud-python의 result trigger 및 실제 automation run ID를 따로 대조합니다. CNIL의 `listing_date_excluded`는 카드 날짜만 확인한 건수이므로 상세 열람·저장 건수와 구분합니다. 유효 임대가 있으면 빼앗지 않습니다. 수집을 시작하기 전에 기존 대기 자료의 원문·적격성을 검토해 작성 가능한 작업부터 처리합니다. 수집의 무진행 반복 때문에 기존 적격 초안이 밀리지 않게 합니다.
2. OECD·FTC는 기존 `collector_cloud_take → python -m scripts.collector.cloud_step → collector_cloud_commit` 경로를 사용합니다. 이전 commit이 성공한 뒤 다음 claim을 진행합니다. Claim과 미저장 bundle은 ignored work/에 보관하고, commit 응답이 있어야 저장 성공으로 기록합니다.
3. Bundle에 실제 automation/run ID·예정 시각·`trigger='scheduled'`·Git SHA를 넣습니다. 실제 context에서 모르는 값은 지어내지 않고 미확인으로 남깁니다. queue message kind와 예약 trigger를 혼동하지 않습니다.
4. 나머지 7개 승인 출처는 기존 Edge/Cron 소비자가 처리합니다. **처리 책임이 다르다는 이유로 운영 확인·보고에서 제외하지 않습니다.** 출처별 예약/수동 실행, 실제 신규/변경/중복 저장, 기간 밖 자료, 실패, 미확정 날짜, 남은 목록·backlog, 초안 제출 상태를 모두 확인합니다. 최신 이벤트 한 건의 경고를 하루 전체 수집 성과로 대신하지 않습니다. `listing_exhaustiveness_unverified`는 기존 구현이 목록 끝에서 항상 남기는 경고이므로 목록 탐색 종료와 기간 전체 입증을 구분합니다. 출처 승인·호스트·route를 추가하거나 재설정하지 않습니다. CNIL 실패·재시도와 기존 미완료 범위를 보존합니다. coverage는 실제 전체 검증 전까지 미완료로 둡니다.
5. 각 성공 commit 체크포인트 뒤에는 저장된 원문 전체와 날짜·관련성·중복을 대조합니다. 보존하기로 결정한 자료마다 collector_retain_for_draft(item_id,revision_id,input_hash,reason)를 호출해 보존 확정과 한국어 작성 작업 등록을 원자적으로 연결합니다. 확정된 자료는 다시 표본 선정하거나 미작성 상태로 넘기지 않습니다. collector_claim_retained_draft(worker)를 반복 소비해 기존 형식 검사와 submit_trend_draft 및 작업실 재조회를 끝낸 후 다음 수집으로 진행합니다. 시작과 종료 시 collector_retained_draft_status()를 확인하고 unfinished가 남으면 성공 완료로 기록하지 않습니다. 적격 pending/retry draft 후보를 읽기 전용 비교합니다. 원문 전체, 실제 개인정보 관련성, 같은 발표·언어판 중복 여부, 기존 보고서·상태를 확인하고 작업 1건씩 targeted claim합니다. 제출 완료와 `existing_event_report:` 보류 건은 재선점하지 않습니다.
6. 정확한 revision_id·input_hash·instruction_version 및 30분 lease를 유지합니다. 원문과 용어집을 바탕으로 이 Codex 실행에서 초안을 직접 작성하고 주체·날짜·수치·인용·법적 단계를 대조합니다. 별도 생성 API를 사용하지 않습니다.
7. `node scripts/trend-report.mjs --check work/draft-<job_id>.json`을 실제 통과한 초안만 `submit_trend_draft`로 제출합니다. 실패 원고는 기존 fail 경로를 쓰고 제출 성공으로 간주하지 않습니다.
8. reports·publication_working_copies(`entity_type='report'`)·기존 `get_trend_collector_review()` JSON items에서 report ID, draft·미검수·미게시·공개 요청 없음·revision을 확인합니다. 관리자 확인과 팀 RLS 조회, 브라우저 직접 확인을 구분합니다. 권한을 확대하지 않습니다.

하루 여러 자료를 처리할 수 있지만, 이는 정책상 수량 목표나 보장이 아닙니다. 적격 자료가 없으면 작성하지 않습니다. 실행 요약의 `role='daily-producer'`에 9개 출처 전체의 대상 기간, 신규/변경/중복/기간 밖/실패 처리량, 예약/수동 구분, event/job/revision/input_hash/report ID, 초안 제외·보류의 실제 사유, 검사 결과, 소요시간, 남은 범위와 중복 방지 근거를 남깁니다. 처리하지 않은 출처도 직전 확인 기록의 시각과 미실행 여부를 명시합니다. 실행 이력의 completed는 플랫폼 작업 종료이며 9개 출처의 완전 수집이나 초안 제출 성공과 동일하지 않습니다. 정상 건수마다 별도 주간 보고를 만들지 않습니다. 사용자에게 별도 알림은 실패·권한/비용 오류·재개 불가 등 조치가 필요한 경우에만 합니다.

## 월요일 주간 집계·보고자

월요일 아침 주간 예약은 직전 월요일 00:00 이상부터 이번 월요일 00:00 미만(한국시간)에 발표된 자료를 집계해 이 작업 결과로 보고합니다. 발표일 기준으로 포함 여부를 정하고, 날짜 미확정·충돌 및 과거 backlog는 따로 표시합니다.

- 일일 생산자의 요약과 DB의 event/job/report/revision·route cursor·queue·backlog 상태를 서로 대조합니다. 등록된 예약은 실제 실행 증거로 취급하지 않습니다.
- 기존 검수 대기 보고서의 원문·초안·출처 URL·발표일·상태를 읽고 사건 및 언어판 중복을 제거해 핵심 동향·주간 목차·검수 대기 목록을 작성합니다.
- 보고에는 대상 기간, 출처별 성공·중복·실패·보류·미완료, 매일의 실제 실행/미실행 여부와 측정된 처리시간을 포함합니다. 첫 완전한 주간 처리가 끝나기 전에는 전체 소요시간 실측이라고 부르지 않습니다.
- 주간 집계는 수집 take/commit, 초안 claim/submit을 호출하지 않고 기존 보고서를 고치거나 새 DB report를 만들지 않습니다. 자동 승인·발행을 하지 않습니다.
- coverage 미완료·실패 HTTP·미열람 첨부·날짜 불일치·CNIL 재시도를 숨기지 않습니다. 적격 주간 자료가 없으면 억지로 채우지 않습니다.
- 읽기 전용 집계가 끝난 뒤 `collector_edge_events`에 `source_id=null`, `trigger_kind='cloud-automation-summary'`, 고유 execution_id와 실제 시각, 확인한 run/report/event 및 미완료 범위를 `role='weekly-digest'` 요약으로 남깁니다. 원문·초안 전문·비밀값은 기록하지 않습니다.

## 유지되는 금지 사항

main 병합, 기존 보고서 덮어쓰기, 자동 승인·공개 발행, 미확인 gate 조작, 유료 API·추가 결제·새 외부 서비스·별도 Vercel 프로젝트, 사용자 PC 의존, 비밀값 출력은 금지합니다. 예약 실행 중 새 예약·migration 재적용·route 재설정을 하지 않습니다.
