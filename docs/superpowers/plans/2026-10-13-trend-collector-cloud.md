# 동향 클라우드 수집 구현 계획

> **For agentic workers:** Use superpowers:executing-plans to implement inline. 사용자는 계획으로 끝내지 않고 가능한 구현·검증을 진행하도록 요청했습니다.

**Goal:** 추가 과금 없이, 안전하게 멈출 수 있는 수집·판본 작업·기존 검수 연결을 구축합니다.

**Architecture:** Python 수집은 기존 Supabase ingest RPC를 사용합니다. DB 임대 함수와 검수용 조회를 연결하며, 원문·비용·클라우드 접근 확인 전 정기 실행은 막습니다.

**Tech Stack:** Python 3.12, BeautifulSoup, pypdf, PostgreSQL, Next.js, GitHub Actions.

**Spec:** ../specs/2026-10-13-trend-collector-cloud-design.md

## Global Constraints

- 브랜치 codex/trend-collector-cloud, main 대상 PR, 병합 금지.
- PR16 기준 547a83611cad948439598e2974e7ce8afd10781d; 필요한 data/trends만 가져옵니다.
- 유료 API/서비스/runner 금지. 실행 전 검증 조건이 없으면 중단.
- 초안 자동 공개 금지, 기존 보고서 자동 덮어쓰기 금지.
- 기본 하루 초안 최대 10건, 수집 07:17/초안 08:17 KST.

## Review Focus

- 페이지 상한/네트워크 오류에 도달하면 checkpoint를 전진시키지 않습니다.
- 서버 날짜/URL 연도를 게시일로 쓰지 않습니다.
- 미확인 동적 본문은 빈 성공으로 처리하지 않습니다.
- 임대 만료/이전 판본/기존 사람 작성 보고서는 submit을 막습니다.
- 검수 데이터 읽기 실패는 빈 목록과 구분합니다.

### Task 1: 수집기와 중단 조건

Files: scripts/collector/{core,parsers,run}.py, scripts/collector/requirements.txt, tests/test_collector.py, .github/workflows/trend-collector.yml.

Interfaces: canonical_url(url, hosts), extract(source, html, url), discover(source, html, url), HttpClient.get(url), collect(config, client, store, since, until).

- [ ] 먼저 날짜 없음/본문 제거/정규화/다음 페이지/429/크기 제한/실패 후 checkpoint 미전진 검사를 작성하고 실행하여 실패를 확인합니다.
- [ ] PR16 선택자 기반 HTML/RSS 파서·안전한 네트워크·DB 저장 클라이언트를 구현합니다.
- [ ] Python unittest, pnpm validate:data, 기존 테스트를 통과시킵니다.

### Task 2: 임대·초안 제출·DB 상태

Files: supabase/migrations/*_trend_collector_cloud.sql, supabase/tests/trend_collector_cloud.test.sql.

Interfaces: claim_trend_draft_jobs(worker,limit), submit_trend_draft(job,worker,draft), fail_trend_draft(job,worker,error), collector_capacity(), get_trend_collector_review().

- [ ] 실제 로컬 Postgres에 함수 없음/권한 없음·임대·중복·판본·보호 검사를 먼저 실행합니다.
- [ ] 제한된 service_role 함수와 팀원 조회만 추가합니다. 파괴적 reset 없이 로컬 migration을 적용하고 pgTAP을 실행합니다.
- [ ] 운영 DB 반영은 검사 통과 후 필요한 migration만 적용합니다. 외부 원문 실사가 막히면 운영 원문/초안 시험은 보류합니다.

### Task 3: 기존 검수 화면과 운영 기록

Files: app/components/collector-review.tsx, app/work/page.tsx, docs/trend-collector-cloud.md, README.md, architecture.md, docs/team-onboarding.md.

- [ ] 검수 권한/오류/판본별 feedback ID 테스트를 먼저 작성합니다.
- [ ] /work에서 DB 원문/작업/초안을 직접 읽으며 상세·근거·피드백을 표시합니다. 공개 메뉴는 바꾸지 않습니다.
- [ ] 전체 테스트·데이터 검사·typecheck·build·실제 DB 권한 검사와 리뷰를 수행합니다.
- [ ] 브랜치를 push하고 PR을 제출합니다. 실제 배포 결과와 예약 목록을 조회하고 구현/시험/보류 범위를 보고합니다.


## 실행 기록과 실제 제한

- Task 1: 구현 및 Python 검사 15개 통과. 실제 기관 실사는 현재 프록시 정책으로 실패하여 운영은 보류.
- Task 2: 기존 수집 구조 재사용, 신규 DB 검사 22개 및 기존 모든 pgTAP 통과. 운영 Supabase에 기존 발행 보호 및 신규 작업/검수 조회 migration 적용·용량/권한 조회 성공.
- Task 3: 로컬 합성 DB→검수자 로그인→정확한 판본/초안 표시→DB 변경 후 같은 빌드 갱신 성공. 실제 원문과 배포 Preview는 별도 미확인.
- Final review: 독립 리뷰에서 지적한 용량 중단 뒤 쓰기, 임대 중 승인 철회, 잘못된 핵심 내용으로 화면 오류, 검수 원문 판본/제안 근거 누락을 보완. 저장 한도·승인 철회·key point 검사 RED→GREEN, 실제 브라우저 null key point·본문·갱신 확인.
- Ruling: 사용자가 전체 구현·검증 진행을 이미 명시해 설계/계획을 다시 승인받으며 멈추지 않음. 정기 활성화/병합은 별도 요청 조건대로 하지 않음.
- Ruling: Supabase CLI가 읽기 전용 홈 캐시 경로 생성에서 실패하여 기존 로컬 PostgreSQL 컨테이너에 SQL을 적용하고 pgTAP으로 검사함. 운영 변경은 지원되는 apply_migration 도구 사용. reset/운영 데이터 삭제 없음.
- Ruling: 9곳 공식 접근·이용조건·현재 실행 잔량이 미확인이라 출처/비용/클라우드 검증 게이트는 false 유지. 실제 전 과정·자동 한국어 편집·정기 운영 완료라고 주장하지 않음.

## 새 작업의 이어가기 기록 — 2026-10-13

- 기존 PR #32 head `69d0e4d54d3965123bad849931ccee7b05f8a1e8`에서 이어갔습니다. 이전 작업의 정책 거부는 이번 작업에서 재현되지 않았습니다. 공식 목록 URL 9/9 HTTP 200, robots-aware 목록/표본 18/18 수신을 확인했습니다.
- 현재 목록→첫 발견 문서의 파서 진단을 추가하고 PPC 연도 탭 제외·EDPB 카드 제목을 보완했습니다. CURIA 영어 보도자료/PDF를 판결 전문과 구분하여 연결했습니다.
- ICO와 PDPC 공개 사이트에서 실제 사용 중인 내부 JSON 요청·페이지 정보를 실사한 뒤 어댑터를 연결했습니다. PDPC 본문은 기사에 연결된 JSON/UTF-8 길이 구분 RSC content만 읽으며 JavaScript를 실행하지 않습니다. 각 기관의 1→2페이지에서 다른 결과·다음 정보를 확인했습니다.
- 독립 코드 리뷰의 Important 2건: 반복된 PDPC 페이지로 체크포인트가 전진하는 문제와 리디렉션이 robots/요청 예산을 건너뛰는 문제를 재현했습니다. 각 실패 검사를 먼저 실행한 후 수정했으며 Python 46/46, 앱 28/28, 데이터 검사/typecheck/build를 통과했습니다.
- Ruling: 기존 승인 설계·계획의 구현을 이어가므로 설계 승인을 다시 요청하며 멈추지 않았습니다. 신규 하위 시스템·운영 승인을 추가하지 않았습니다.
- Ruling: 내부 JSON 페이지 정보는 HTML next 링크 대신 실사한 명시적 페이지/전체 건수로 순회합니다. 형식 변경·중복·실패는 중단하며 표본 성공으로 전체 기간 수집을 보장하지 않습니다.
- Ruling: 9개 출처와 수집/저장/AI·운영/비용 승인 게이트는 계속 false입니다. 실제 공식 원문→운영 DB→한국어 초안→배포 검수는 별도 전 과정 시험과 이용조건/비용 확인이 필요합니다. 이번에 DB·공개 화면·main·정기 실행·요금제를 변경하지 않았습니다.

## 운영 1건 연결 시험 후속 기록 — 2026-10-13 20:24 KST

- 원격 최신 head `8530027`에서 기존 변경을 보존해 진행했습니다. 사용자 `ㄱㄱ해`는 설명된 월 전송량 미확인 상태에서도 해당 기사 1건의 운영 시험을 진행하라는 권한으로 해석했습니다. 이후 사용자 제공 Usage 화면으로 Free Plan·현재 주기 한도 미초과·Egress 0.003/5 GB를 확인했습니다.
- Ruling: 기존 계획의 무료 사용량 미확인 중단 조건은 이번 1건에 한해 사용자 후속 지시를 우선했습니다. 미확인을 확인된 잔량으로 표시하지 않고 원문 metadata와 시험 문서에 진행 시점을 기록했습니다. 정기 운영·다른 출처로 확대하지 않았습니다.
- Ruling: EDPB 자체 뉴스의 재사용 조건을 실제 확인했고 사용자에게 내부 확인 기록 의미를 설명한 뒤 진행 권한을 받았으므로 해당 출처의 terms_reviewed_at만 시험 동안 적용했습니다. 제출 후 조건부 갱신으로 원래 null을 복원했으며 다른 설정·기존 사용자 작업은 보존했습니다.
- 실제 운영 ingest·동일 입력 반복·claim 1회·정확한 판본/해시/지침/인용 4개 대조·submit 통과. 보고서는 draft/human_reviewed=false/published_at=null이며 최종 DB 13,347,987바이트입니다.
- 배포 reviewer 로그인·원문/초안/근거/한계·새로고침·익명 조회 차단(401)·reviewer submit 차단(403)·공개 목록 미표시/상세 404·로그아웃을 확인했습니다. 브라우저 오류 0개, 임시 계정 삭제와 출처 복원을 재조회했습니다.
- 이번에는 제품 코드·migration·수집 설정을 변경하지 않았습니다. 기존 수집기 검사 46개는 이 세션에서 통과했고 문서 diff를 별도로 검증합니다. 새 환경·유료 API/서비스·정기 실행·공개 발행·main 병합 없음.

## 품질 지침과 정기 수집 구축 후속 기록 — 2026-10-13

- 사용자는 PR #16의 검수 산출물·피드백 기반 지침 개선과 9개 출처 정기 수집 구축 시작을 멀티 에이전트로 요청했습니다. 별도 응답으로 실제 정기 실행은 보류하고 구축·검증까지만 진행하도록 범위를 확정했습니다. 지침/근거 문서 에이전트와 collector/workflow/test 에이전트는 소유 파일을 나누어 병렬 진행했고 독립 에이전트가 통합 변경을 검토했습니다.
- Ruling: 기존 수집·검수 구조와 제출 계약을 유지하는 확장으로 진행했습니다. 기존 PR 설계·사용자 변경 요청에 따라 문서와 가역적 구현을 수행하며 새 환경·유료 서비스·main 병합·원격 실행 설정 변경을 추가하지 않았습니다.
- 지침: PR16 최신 c42db8b와 실제 피드백 4건(id2/3/4/5)을 대조했습니다. 자료는 unreviewed이며 표시 작성자를 검증된 신원/검수 승인으로 단정하지 않았습니다. 짧은 요약·번호/빈 줄 상세·유형별 깊이·법적 단계·날짜/수치·근거 대응을 개선하고 실제 EDPB 검수 전 작성 예시를 추가했습니다. DB 계약 trend-ko-v1은 유지하고 편집 개정일을 별도 표시했습니다. 기존 운영 초안은 변경하지 않았습니다.
- 수집: 정적 source gate 뒤에만 DB client/preflight/range를 사용합니다. held/partial/failed를 blocked2/partial3/failed1로 구분하며 DB오류/용량 중단 뒤 추가 DB쓰기를 차단합니다. 실패 문서 cursor를 전진하지 않고 중단/재시도하며 예약 미완료 범위를 다음날 먼저 재개합니다. unknown date에는 완전 수집/checkpoint를 허용하지 않습니다.
- Ruling: 07:17 KST cron은 비활성 실행 정의로 준비하되 job gate와 CLI gate에 SCHEDULE_ENABLED 및 기존 활성 조건을 요구합니다. 기본 브랜치 병합과 원격 변수를 설정하지 않아 실제 정기 실행은 활성화하지 않았습니다. 기본 manual mode는 dry-run입니다. 반복 AI 편집 예약은 별도 연결이며 생성하지 않았습니다.
- Ruling: 현재 페이지 전체성에 대한 had_pagination 한계는 이번 수정을 통해 전체 기간 완전 수집으로 재해석하지 않습니다. 실제 source별 범위 증거 확장과 6개 운영 출처 등록/조건 승인은 후속 운영 범위로 남겼습니다. 저장소 9개 출처 승인false·6 source_id null·운영 초기3 terms_reviewed_at null은 유지했습니다.
- 검증: 신규 회귀 검사의 실패를 확인한 뒤 수정했고 최종 Python collector 62/62 통과(기존46+신규16), 앱28/28, validate:data, typecheck 통과. 기존 의존성 경로를 재사용했고 새 환경은 만들지 않았습니다. YAML cron/default/all-four gates·문서 JSON 계약/상한/근거 인덱스/번호문단·git diff --check 통과. 현재 CLI 9-source write preflight 및 scheduled-disabled 둘 다 exit2/blocked/requests0/run-log skipped를 실증했습니다.
- 운영 read-only 확인: DB13,347,987바이트 can_write=true; 출처 초기3 모두 승인null. Actions variables/secrets 조회는 HTTP403 Resource not accessible by integration여서 Actions credential readiness는 미확인으로 기록했습니다. 기존 관리 환경 secret을 Actions에 자동 전달된 것으로 취급하지 않았습니다.
- 독립 통합 검토: Critical/Important/Minor 지적 없음. 검토 에이전트가 Python62개와 diff검사를 별도 재실행했고 gate순서·재개·실패offset·정기비활성·지침계약을 확인했습니다. 실제9출처운영/전기간완전성은 남은 제한으로 기록합니다.
