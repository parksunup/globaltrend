# 클라우드 Python 연결·실제 초안 제출·미래 예약 등록

2026-10-22 한국시간 기준입니다. **수동 실수집/초안 제출은 확인했고 실제 예약 수집·작성 및 다음 예약 재개는 아직 관찰 전입니다.**
인계 문서 전체와 필수 지침을 읽고 `22d4a44d7d8ac5f4c923e2a34fdb3c10d9153819`에서 이어갔습니다.
collector-task Git blob은 `bce0d5f08beb06d3972b97a4dee5a7efa94fa103`으로 일치합니다.

## 코드와 적용

- 새 작업 브랜치: `codex/collector-cloud-worker-20261022`. [draft PR #42](https://github.com/parksunup/globaltrend/pull/42)는 #41 브랜치를 base로 합니다.
- 예약에 고정한 코드: `d010a547a070e9f4e9a45d34c4b29cc5309ce956`. 로컬 6433225와 전체 Git tree가 동일함을 `git diff --exit-code HEAD FETCH_HEAD` exit 0으로 확인했습니다.
- 기존 프로젝트 `emlgwhkgaihhrirhdpnp`에 migration `20261021201141_collector_cloud_connector`, `20261021202112_collector_cloud_retry_validation`을 적용했습니다.
- OECD·FTC만 cloud-python으로 배정했습니다. 기존 Edge 함수 배포와 control git_sha는 변경하지 않았습니다.
- source/queue 임대가 일치하는 경우에만 원문 ingest·진행 위치·이벤트·재큐를 한 트랜잭션에서 반영합니다.
- 기존 Edge cursor와 Python/cloud cursor는 별도로 보존합니다. 새 실행부는 원래 미완료 범위 안에서 목록을 다시 탐색해 offset 1까지 확인했습니다.
- 실패 상세는 기존 backlog에 저장한 뒤 일반 목록을 진행합니다. 기존 backlog도 cloud take에서 선점해 저장된 정확 URL만 재시도합니다.
- CNIL의 2026-09-21~2026-10-22 범위, Edge offset 0/failures 8, legacy page 12/offset 1과 큐를 유지했습니다.

## 연결 도구의 실제 권한

`mcp__codex_apps__supabase_execute_sql`의 current_user/session_user는 postgres, transaction_read_only=off입니다.
기존 claim/ingest/submit의 EXECUTE 권한을 조회한 뒤 실제 작업으로 쓰기 성공을 확인했습니다.
터미널 키 부재를 중단 사유로 사용하지 않았고 비밀을 추출하거나 출력하지 않았습니다.

정책은 `trend-draft-unlimited-v2`, `daily_claim_limit=null`, targeted claim 지원입니다.
05:24:02 조회의 DB는 30,706,835바이트, stop_bytes 400,000,000, can_write=true입니다.
실시간 무료 전송/실행 잔량은 조회 도구로 확보하지 못했습니다. 이 값을 검증됐다고 표시하거나 환경 gate 4개를 일괄 true로 설정하지 않았습니다.

사용한 도구: `exec_command`, `apply_patch`, GitHub fetch_file/create_branch/create_file/update_file/create_pull_request,
Supabase execute_sql/apply_migration/get_project/get_advisors/search_docs, automations peek/create/update.
단말 명령은 클라우드 작업 환경에서 실행했으며 사용자 PC/앱에 의존하지 않았습니다.

## 수동 한국어 초안

| 항목 | 실제 값 |
|---|---|
| 선점 | 2026-10-22 05:04:10.996109 KST |
| 제출 | 2026-10-22 05:05:31.676609 KST |
| worker | `codex-cloud-manual-20261022-22d4a44-reps` |
| job | `368ada39-bf2c-49ae-96f1-c5a93ace1398` |
| revision | `1cefd0ab-d602-4242-a0ea-84db37789bb5` |
| input hash | `67b3b30ae1fb356c3d359e1e6019ab5f4964049169a42b4d081f5d2b4b333f65` |
| report | `0fa4fd77-7091-4430-9fdf-cc2cf3e6d3f0` |
| 제목 | 미국 FTC, 타인 식별정보를 이용한 티켓 구매 제한 우회 혐의로 REPS 제소 |

정확한 보도자료 판본 전체를 읽고 소장 주장·허가 계약·법원 판단 단계를 구분했습니다.
인용 10개가 해당 입력 본문에 그대로 존재하고 근거 인덱스가 유효함을 확인했습니다.
`node scripts/trend-report.mjs --check work/draft-368ada39-bf2c-49ae-96f1-c5a93ace1398.json`은 exit 0입니다.
소장 PDF 전문을 읽은 것으로 표시하지 않았고 내용·날짜·단계의 확인 범위를 limitations에 보존했습니다.

관리 조회에서 draft, human_reviewed=false, reviewed_at=null, published_at=null, evidence_count=10입니다.
기존 활성 팀원에 대한 SQL 역할/RLS 시험에서 `/work`가 사용하는 허용 열·작업본 revision 1·공개요청/휴지통 없음 및
`get_trend_collector_review()` 포함을 확인했습니다. 이는 관리자 연결을 통한 역할/RLS 시험이며 브라우저 로그인/UI 직접 확인은 아닙니다.
처음 human_reviewed/reviewed_at를 authenticated로 직접 읽으려 한 요청은 42501 permission denied였습니다.
해당 비공개 열을 제외한 앱의 기존 열 단위 권한으로 조회가 성공했으며 GRANT나 RLS는 변경하지 않았습니다.

CNIL의 EDPB 번역 후보 `fa5b7148-98de-476e-99e5-57c408db6d49`는 선점 후 같은 발표의 기존 보고서
`7a33702f-e7c7-4567-b334-e1abd23d49e4`와 중복임을 확인해 fail RPC에 `existing_event_report:` 사유를 남기고 제출하지 않았습니다.
이 작업은 후속 자동 선점에서 제외하도록 예약 지침에 명시했습니다.

## 수동 수집: 현재 cloud Python → 실제 DB commit

| 출처 | 실제 시작~종료 KST | event / execution |
|---|---|---|
| OECD | 05:12:56.470521~05:13:37.815416 | `8f37cb73-f031-429b-8986-30eb52dda1f2` / `manual-20261022-oecd-collection-1` |
| FTC | 05:12:56.470521~05:13:44.195551 | `385e3f7f-3fb3-44d8-b40d-52e779d6cd57` / `manual-20261022-ftc-collection-1` |

OECD는 목록 6건에서 첫 문서의 공식 초록 977자를 읽었습니다. 표시일 2026-10-15와 속성일 2026-10-14 불일치로 날짜/AI 준비를 보류했습니다.
ingest는 duplicate이며 revision `f2a15ec9-7c12-4e46-931c-2223d08f8a7f`, job `e8c06c32-b35d-4ce3-978c-362a2c6d897e`를 유지했습니다.
FTC는 RSS 목록 30건에서 첫 문서 3,958자를 읽었습니다. 게시일은 2026-10-19이고 연결 자료 9개는 미열람입니다.
ingest는 duplicate이며 revision `6f50f169-cc3a-4599-a41e-8a3263b63cb7`, job `661c6702-20dd-424f-8b75-3580df43020f`를 유지했습니다.

각 step은 requests=3, 다운로드 OECD 3,014,114바이트/FTC 1,155,535바이트입니다.
두 source 모두 범위 2026-10-16~2026-10-22, offset 1을 DB에 반영하고 재큐했습니다. coverage_complete=false입니다.
OECD 관련 보도자료 링크도 Python 발견 규칙에 추가했지만 현재 주제 목록에서는 해당 링크를 발견하지 못했습니다.
따라서 관련 보도자료 전체/전 기간 수집 완료를 주장하지 않습니다.

## 실제 미래 예약

- ID: `6ad91f62e1748191a4b123c85c0a7ddf`
- 도구 응답: success=true, enabled=true.
- 첫 예정: 2026-10-22 **05:29:02 KST**.
- 다음 예정: 2026-10-22 **06:29:02 KST**.
- 규칙: HOURLY, COUNT=2. 상시 반복 운영을 무기한 활성화한 것이 아닙니다.
- 코드 판본과 지침, 실제 명령 실행·수집 commit·한국어 작성/검사/제출·DB 조회·중복 없는 재개를 prompt에 지정했습니다.
- 기존 일회성 연결 시험들은 모두 disabled 상태이며 중복 운영 예약은 없었습니다.
- 05:25 조회 시 last_run/latest_result=null, next_run_time=null입니다. VEVENT 등록 성공과 실제 실행 성공은 구분합니다.

서버 handoff event `6a9303d8-9073-40e1-90ad-71ced9905236`에 수동 ID와 예약 예정 시각을 기록했습니다.
이 이벤트의 started_at는 최초 DB snapshot인 05:02:42.874882, finished_at는 05:24:40.49514 KST입니다.
전체 대화 턴 시작 시각은 사전에 별도로 기록하지 않았습니다.
실제 예약은 매 회 `cloud-automation-summary` 이벤트에 실제 실행 ID/시각·수집/초안 ID와 출력을 기록하도록 했습니다.
두 번째 예약이 첫 제출과 DB cursor에서 이어받는 증거를 관찰하기 전에는 전체 무인 운영 완료가 아닙니다.

## 검증과 관찰한 오류

- Python 93개, 앱 137개, typecheck, validate:data, production build, diff check 통과.
- 빌드의 기존 CSS/webpack cache 경고와 Node MODULE_TYPELESS_PACKAGE_JSON 경고는 남아 있으나 exit 0입니다.
- 독립 리뷰 Important 4건을 수정했습니다: backlog 소비 누락, 실패 문서 정체, cursor 무검증, transaction-stable now 임대 검사.
- malformed cursor 수락을 실제 RED로 재현했고, 기존 backlog/실패 후 전진/중복·구임대·만료/transaction clock을 DB rollback으로 검증했습니다.
- 최초 npm ci는 package-lock 부재로 EUSAGE였습니다. 저장소의 pnpm-lock으로 설치 후 앱/타입/빌드가 통과했습니다.
- 터미널 git push는 `fatal: could not read Username for 'https://github.com': No such device or address`였습니다.
  기존 GitHub 연결 도구로 같은 파일을 별도 브랜치에 반영했고, 다시 fetch한 remote와 로컬의 전체 tree가 동일합니다.
- 원격 CI `39670202628`의 collector·collector-edge·database·verify 네 job이 모두 success임을 05:28 이전 재조회로 확인했습니다.
- 보안 advisor는 기존 authenticated security-definer 관련 경고와 leaked password protection 경고를 반환했습니다.
  새 cloud route table은 RLS/worker 전용이며 anon/authenticated에 함수 실행 권한을 열지 않았습니다.

main 병합·기존 보고서 덮어쓰기·자동 승인·공개 발행·유료 API/결제 변경·새 서비스·새 Vercel 프로젝트를 수행하지 않았습니다.
