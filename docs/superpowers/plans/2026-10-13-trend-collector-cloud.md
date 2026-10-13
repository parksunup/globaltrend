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
