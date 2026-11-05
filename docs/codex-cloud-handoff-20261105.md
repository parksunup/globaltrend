# Codex 클라우드 작업 이관 인수인계서

작성일: 2026-11-05  
저장소: `parksunup/globaltrend`  
기준 브랜치/커밋: `main` / `6153bdea86288bc223c39aea375bedd90868b725`

## 목적과 현재 상태

정기 수집·한국어 초안 생산 작업을 ChatGPT 대화 실행에 기대지 않고 Codex 앱의 명시적으로 연결된 클라우드 작업환경에서 이어간다. 현재는 이관 설계와 코드 보존 목록을 정리한 단계다. 클라우드 환경 연결, 기존 예약의 실행환경 지정, 운영 실행 검증은 아직 완료되지 않았다.

현재 이 대화의 파일시스템은 저장소가 아니다. `/workspace/scratch/dbbd57d8f594`에는 `.codex/config.toml`만 있고 Git 저장소나 작업 파일이 없다. 따라서 이 대화에서 만들었으나 커밋하지 않은 코드는 발견되지 않았다. 보존을 확인할 수 있는 코드는 GitHub `main`에 있는 커밋된 코드뿐이다. 비밀값이나 로컬 환경 파일을 복사하지 않는다.

## 이어서 사용할 기존 코드

### 수집기

- `scripts/collector/core.py`, `parsers.py`, `run.py`: 기존 요청·파싱·수집 경로
- `scripts/collector/cloud_step.py`: claim 하나를 받아 저장 전 bundle을 만드는 단계. 파일 설명대로 DB 쓰기는 하지 않으며, 저장 성공은 기존 `collector_cloud_commit` 응답으로만 판정
- `scripts/collector/store.py`, `web.py`, `expansion.py`, `preflight.py`, `environment.py`: 기존 저장·웹 출처·확장·사전점검 경로
- `config/trend-collector.json`, `config/collector-web.json`, `config/collector-sources/`: 출처·실행 방식·허용 주소 설정
- ICO 복구는 PR #106의 기존 ICO `GET 목록 → /api/search POST` 경로를 우선 확인한다. ICO가 막히면 실제 실패 URL과 응답을 남기며 차단을 우회하지 않는다.
- EC·DPC 등 이미 작동했던 어댑터는 교체 전에 과거 성공 이벤트와 현재 코드의 요청 방식부터 비교한다.

### 한국어 작성과 검수함 저장

- `scripts/trend-report.mjs`, `scripts/trend-writing-packet.mjs`: packet 생성, 원고 결속(seal), 원문 claim과 대조한 검사
- `config/trend-writing-policy.json`, `docs/trend-report-style.md`, `docs/trend-reference-reading-notes.md`, `docs/translation/glossary.md`, `docs/trend-draft-worker.md`: 작성 기준
- 보존 대상으로 판정된 자료는 기존 `collector_retain_for_draft → collector_claim_retained_draft → packet 작성·원문 대조 → seal/check → submit_trend_draft → reports/publication_working_copies 재조회` 경로를 끝까지 사용한다.
- `cloud_step`의 bundle 생성, DB commit, 한국어 초안 제출은 서로 다른 성공 단계다. 앞 단계 성공을 뒤 단계 성공으로 세지 않는다.

### DB 계약

관련 migration은 코드 저장소에 존재한다. 예: cloud collector, Edge backlog, rolling three-day window, retained-draft handoff, 작성 품질 검사 migration. 이 파일들은 계약 확인용으로 사용한다. Codex 클라우드로 옮기는 과정에서 운영 DB에 migration을 다시 적용하거나 RPC·route·cursor를 재설정하지 않는다. 실행 전 현재 DB의 적용 상태와 실제 RPC 반환값을 확인한다.

## Codex 앱으로 옮기는 순서

1. Codex 앱에서 GitHub 저장소 `parksunup/globaltrend`을 연다. 기준은 이 문서의 기준 커밋 또는 그 이후의 `main`이다.
2. 작업환경 화면에서 실제로 연결된 클라우드 환경을 선택하고, 저장소 작업 디렉터리·Python·Node 버전이 화면과 터미널에서 일치하는지 확인한다. 환경이 붙지 않았으면 수집 claim을 받지 않는다.
3. 터미널에서 다음을 기록한다: `pwd`, `git rev-parse --show-toplevel`, `git status --short --branch`, `git rev-parse HEAD`, `python --version`, `node --version`. 기존 프로젝트 의존성·venv가 그 환경에 실제로 있을 때만 재사용한다. 존재하지 않는 로컬 경로를 있는 것처럼 쓰지 않는다.
4. 새 예약을 만들지 않는다. 기존 일일 자동화의 환경 연결을 Codex 클라우드로 지정할 수 있는지 확인하고, 저장소 경로·권한·시크릿 바인딩이 실제 준비된 뒤에만 기존 예약을 전환한다. 자동화 ID와 다음 실행시각은 전환 전후에 확인한다.
5. 예약 실행에서 작업 ID와 실제 시작·종료 시각이 확인되는지 검증한다. 로그는 예약 ID → run ID → 실행 ID → source event → item/revision → draft job → report ID 순으로 연결한다.
6. 원문 저장만으로 실행을 성공 처리하지 않는다. 모든 보존 자료에 대해 초안 제출과 작업실 재조회까지 끝났는지 확인한다. 남은 자료가 있으면 partial과 정확한 재개 위치를 기록한다.

## 완료 전 금지할 판단

- 클라우드 작업환경이 선택됐다는 사실만으로 예약이 그 환경에서 실행된다고 말하지 않는다.
- 최신 결과 대신 이전 실행의 결과를 현재 실행 결과로 표시하지 않는다.
- 페이지 탐색 완료를 최근 3일의 전체 수집 완료로 바꾸어 말하지 않는다.
- 빈 본문·날짜 불명·부분 열람 문서를 완성 기사나 제출 가능한 초안으로 세지 않는다.
- 재시도 횟수를 고유 실패 기사 수로 세지 않는다.
- 운영 DB 권한·비밀값을 출력하거나 새 결제·서비스·생성 API를 추가하지 않는다.
- 이관 PR은 검토 가능한 초안으로 두며, 자동 병합·자동 승인·공개 발행하지 않는다.

## 이번 작업의 범위

이 문서는 이관 절차와 기존 코드 위치를 정리한다. 예약 실행 설정, 운영 DB, 수집 route/cursor, 초안 자료는 변경하지 않았다. Codex 클라우드 환경 자체는 이 대화에서 연결·검증되지 않았다.
