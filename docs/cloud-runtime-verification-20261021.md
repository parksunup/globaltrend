# 클라우드 예약·편집 워커 실제 연결 점검

**최신 결과:** [Supabase 실서버 예약 실행 및 미검수 초안 제출 기록](cloud-runtime-operation-20261021.md)을 확인해 주세요. 기존 Supabase 관리 연결과 예약 수집을 이번 세션에서 구현·실행했습니다. 구독 내 작성 예약 연결은 미완료입니다. 아래 11:35 UTC 기록은 관리 토큰이 제공되기 전의 관찰이며 현재 권한으로 해석하지 않습니다.

점검: 2026-10-21 11:35 UTC. 대상은 기존 `parksunup/globaltrend`와 기존
Supabase 프로젝트다. 완료 목표는 PC·앱 종료와 무관한 예약 수집 → 클라우드 Codex
작성 → 미검수 draft의 검수함 반영이며, 현재 상태는 **차단 / 미완료**다.
플랫폼 Goal 또는 예약이 등록됐다고 주장하지 않는다.

## 실제로 수행한 확인

| 확인 | 관찰 | 해석 |
|---|---|---|
| 관리형 환경 상태 | connected / running, 자격증명 관찰 state는 unknown | 연결됨만으로 관리 권한을 인정하지 않음 |
| 기존 DB API 호출 | `collector_draft_policy()` 호출 성공, `trend-draft-unlimited-v2`, `daily_claim_limit=null` | 자료 처리 API 연결과 하루 제한 제거 확인 |
| DB 수집 실행 기록 | 최신 3개는 2026-10-21 08:14:53, 07:58:52, 07:51:19 UTC 시작, outcome은 partial, runtime 없음 | 이 3개 기록으로 클라우드 예약 주체·무인 실행을 입증할 수 없음 |
| 공개 API 명세 확인 | 노출된 경로에 Cron·Queues·실행부 관리 RPC 없음 | 이 자료 API로 운영 예약을 관리할 수 있다는 근거 없음. 서버의 실제 Cron 설치 유무를 판정한 것은 아님 |
| 관리용 연결 | 현재 제공 도구에 Supabase SQL·Edge·Cron 관리 도구 없음. `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `DATABASE_URL` 미설정 | 자료 처리 키와 관리용 자격은 별개. 자료 키를 관리 API에 전송하지 않음 |
| Codex CLI 인증 상태 | `codex login status`: ChatGPT 로그인 표시 | Cloud API 권한 성공의 증거가 아님 |
| Codex Cloud 실제 조회 | `codex cloud list --limit 1 --json`: HTTP 401 Unauthorized, authentication token 파싱 실패 | 현재 실행부의 CLI 인증으로 Cloud 작업 조회 불가. CLI로 새 로그인하거나 기존 인증을 덮어쓰지 않음 |
| 클라우드 예약 도구 | 현재 제공 도구에 예약 생성·조회 기능 없음 | 예약 ID·첫 실행·반복 실행을 확인할 수 없음 |
| 별도 CLI MCP 연결 | `codex mcp list --json`: 서버 0개 | CLI를 통한 Supabase 관리 연결도 현재 없음 |

비밀값·인증 파일은 읽거나 출력하지 않았다. 외부 자료를 새로 수집하거나 작업을
선점·제출하지 않았으며 DB·예약·배포 상태를 변경하지 않았다. CLI 실패 시 생성된
로컬 오류 파일은 저장소에 포함하지 않는다.

## 코드에서 바로잡은 실행 경계

- GitHub Actions 수집 workflow의 cron과 예약 쓰기 분기를 제거한다. 수동 진단은
  유지하며, 수동 쓰기는 기존 운영·비용·연결 게이트를 계속 요구한다.
- `architecture.md` 그림·3.2절의 GitHub 예약 및 PC 의존 설명을 최신 요구와
  3.1절에 맞춘다. 이것은 운영 실행부의 배포나 활성화가 아니다.
- Supabase Cron·Queues·Edge 수집 실행부와 기존 Python 어댑터는 아직 연결되지
  않았다. Python CLI 성공을 Deno Edge 호환성 검증으로 취급하지 않는다.
- 구독 내 클라우드 Codex 예약은 실제 도구·저장소·DB 권한을 갖춘 실행으로
  확인해야 한다. 현재 세션을 계속 켜 두거나 로컬 cron을 실행하는 방식으로
  클라우드 예약을 대신하지 않는다.

이 PR 브랜치의 workflow 변경으로 기존 main의 workflow가 바뀌었다고 주장하지
않는다. main 병합이나 저장소 변수 변경을 수행하지 않는다.

로컬 검증은 수집기 회귀검사 88개, 예약 비활성 시 HTTP·DB 접근 없이 중단하는
검사와 `git diff --check`를 통과했다. 이는 클라우드 예약·작성의 종단 간 검증이
아니다.

## 재개에 필요한 연결과 완료 증거

필수 연결은 기존 Supabase의 SQL·Edge·Cron을 관리할 수 있는 연결과, 구독 내
클라우드 Codex 예약을 생성·조회할 수 있는 도구다. 비밀값은 채팅에 요청하지 않고
해당 연결의 보안 입력란으로만 제공한다. DB 자료 API 키를 다시 넣는 것으로
두 관리 연결이 생기지는 않는다.

연결 후 실제 Supabase 예약·큐·실행부를 조회해 중복 예약을 방지하고, 기존 출처와
판본·재개·임대 계약을 사용해 클라우드 실행부를 연결해야 한다. 첫 예약 시각의
서버 실행 ID·출처별 결과·재개 위치, 정확한 작업/판본을 선점한 클라우드 작성
실행 ID, draft 제출 결과와 검수자 조회, 다음 예약에서의 재개를 대조한다.
이 증거가 없으면 전체 완료로 판정하지 않는다.

## 공식 근거

- [OpenAI 예약 작업](https://learn.chatgpt.com/docs/automations?surface=app): 웹
  예약은 연결 도구를 사용할 수 있지만 로컬 폴더를 유지하지 않는다. CLI에는
  Scheduled 관리 화면이 없으며 웹 또는 앱에서 관리한다. 이 일반 문서가 현재
  계정의 저장소·DB 도구 가용성을 보장하는 것은 아니다.
- [Supabase Cron](https://supabase.com/docs/guides/cron),
  [Queues](https://supabase.com/docs/guides/queues),
  [Edge 제한](https://supabase.com/docs/guides/functions/limits): Free Edge는
  wall clock 150초, CPU 2초, 메모리 256MB 제한 안에서 실행부를 구성해야 한다.
