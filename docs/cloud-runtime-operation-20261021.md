# Supabase 예약 수집 실서버 검증과 남은 작성 예약 연결

2026-10-21 작업 결과입니다. **수집 예약은 기존 Supabase에서 실제 실행했습니다.
구독 내 Codex 작성 예약은 연결하지 못했으므로 전체 무인 운영은 미완료입니다.**
아래 시각은 한국시간이며 [서버 조회 증거](cloud-runtime-evidence-20261021.json)의
원래 타임스탬프는 UTC입니다. 이 기록에는 원문 전문·한국어 초안 전문·비밀값을
포함하지 않았습니다.

## 기준 브랜치와 승인 범위

- 최신 main `1010742`는 PR #37의 무제한 정책을 포함합니다. PR #39는 열린 상태이고
  head는 `21df271`입니다. PR #40도 열린 상태이며 head `5662d4c`, base는
  `codex/collector-operational-validation`입니다. 새 작업은 main에서 시작해 #40을
  fast-forward로 포함한 `codex/collector-supabase-runtime`에서 수행했습니다.
  main 병합과 기존 PR 브랜치 변경은 하지 않았습니다.
- PR #32를 운영 기준으로 사용하지 않았습니다. 기존 승인 출처 9곳과 운영 DB의
  실제 승인 날짜를 확인했으며 출처·승인값·기존 보고서의 승인/발행 상태를 바꾸지
  않았습니다. OECD 어댑터에는 주제 페이지의 발간물과 관련 보도자료 링크를 포함합니다.
- 이번 사용자의 실제 클라우드 예약·워커 연결·무인 시험 요청 범위에서 기존
  Supabase에 수집 전용 함수와 스키마를 추가했습니다. 기존 Edge 함수의 코드는
  수정하지 않았습니다. Vercel 배포·새 프로젝트·새 외부 서비스·유료 생성 API·결제
  변경은 하지 않았습니다.

## 구현·배포한 실행 경로

`Supabase Cron → pgmq 영속 큐 → trend-collector Edge Function → 기존 ingest_source_item`
경로입니다. Python을 Deno에서 실행하지 않습니다. 목록 탐색·문서 한 건·다음 페이지
전환을 짧은 작업으로 나누며, 본문 확보가 끝난 자료만 기존 판본/초안 작업 계약으로
전달합니다. HTML은 고정 버전 linkedom, PDF는 pdfjs의 텍스트 전용 어댑터입니다.
실제 Supabase에서 CURIA PDF를 추출·저장했습니다. 렌더링·OCR은 수행하지 않습니다.

- `collector_edge_control`: 활성 상태와 코드 판본입니다. `enabled=false`로 바꾸면
  새 소비/예약을 중단하며 큐·원문·진행 위치는 유지합니다.
- `collector_edge_sources`: 출처별 원래 범위, Python 재개 위치, 현재 목록/offset을
  보존합니다. 어댑터가 바뀌면 같은 범위를 목록 처음부터 재확인하며 기존 ingest의
  URL/해시 중복 방지를 사용합니다. Python offset을 다른 파서에 그대로 적용하지
  않습니다. 미완료 시작일은 보존하고 종료일은 서버의 한국 날짜까지 확장합니다.
- `pgmq.q_trend_collect`: 120초 임대로 선점합니다. 완료 저장은 메시지 ID·read count·
  유효한 임대를 확인한 뒤 상태·실행 기록·다음 메시지를 한 트랜잭션에 반영합니다.
  응답 유실 후에는 같은 위치를 재시도합니다.
- `collector_edge_backlog`: 반복 실패한 상세 문서의 정확한 URL·범위·위치를 별도
  영속 메시지로 보존한 뒤 주 수집을 이어갑니다. 날짜 범위가 늘어나도 출처·URL별
  미해결 재시도는 하나만 두고 범위를 병합합니다. 기존 이력은 삭제하지 않습니다.
- `collector_edge_events`, `collector_edge_ticks`: 서버 실행 ID, 플랫폼 isolate ID,
  출처별 결과, pg_net 호출 ID와 Cron 실행을 대조할 수 있습니다.
- 날짜 미상/불일치·빈 본문·HTTP 오류·미승인 외부 링크는 자료 없음이나 완전 성공이
  아닙니다. 검증되지 않은 목록 전체성에는 `coverage_complete=false`를 유지하고
  기존 완전 성공 체크포인트를 전진시키지 않습니다.
- 잘못된 원문 링크는 URL을 추정하지 않고 `unresolved_links`로 보존합니다. 그런
  자료는 AI 작성 준비 상태를 보류합니다. PDF 주석의 연결 문서는 미열람 링크로
  보존하며 판결 전문을 읽은 것으로 표시하지 않습니다.

운영 함수는 별도 호출 비밀을 요구합니다. 비밀은 서버에서 생성해 Vault와 Edge
보안 설정에만 전달했습니다. 비인증 POST는 실제 HTTP 401이었습니다. 자료 처리 키는
관리 API에 전송하지 않았습니다. 관리 토큰은 `api.supabase.com`에만 사용했습니다.

## 수동·예약·재개를 구분한 실제 결과

| 단계 | 실제 증거 | 판정 |
|---|---|---|
| 관리 연결 | 기존 프로젝트 GET HTTP 200, 자료 정책 RPC HTTP 200, 관리 SQL 실행 성공 | 확인 |
| 최초 수동 Edge 호출 | 22:02:31, 실행 `532e1e69-29bd-42c3-856d-98cdbd5a2cec` | EDPB의 오래된 page=6 위치에서 실패. 성공으로 처리하지 않았습니다 |
| 실제 예약 소비 | 22:05:00, Cron job 2 / run 1, 이후 매분 후속 실행 | 서버 예약 실행 확인 |
| 예약 등록→큐 생성 | 22:14:00, 일회성 Cron job 3 / run 11, event `97d97918-b676-4e84-b508-e0b0b676655e`, enqueued=1 | 사용자 PC의 명령 없이 예약 시점에 큐 생성 |
| 예약 큐 소비 | 22:15:01, 실행 `9674f153-c41e-419b-85a6-e1ef8bcc8077` | PPC 목록 4건 확인, 전체성은 미확인 |
| 다음 예약의 재개 | 22:16:01, 실행 `4b8faf8a-9659-4a55-a9a2-592d3493769a` | 같은 원문을 duplicate로 판정, 미완료 범위 유지 |

일회성 시험 job 3은 실행 중 스스로 해제했습니다. 현재 운영 예약은 다음 두 개입니다.

- job 1 `trend-collector-daily`: `17 22 * * *` UTC, 다음 날 07:17 한국시간입니다.
  **매일 예약의 첫 07:17 실행은 아직 관찰하지 않았습니다.**
- job 2 `trend-collector-consumer`: 매분 가시 상태 큐가 있을 때만 최대 9개 서버 호출을
  만듭니다. 예약 소비와 다음 실행의 재개는 이미 여러 번 관찰했습니다.

GitHub 기본 브랜치에는 아직 이전 schedule 정의가 남아 있습니다. 변수 조회/변경은
실제 HTTP 403이었으나 workflow 비활성화 권한은 작동했습니다. 중복 수집을 막기 위해
기존 `trend-collector.yml`만 `disabled_manually`로 전환했습니다. 해당 workflow의 수동
preflight도 현재 비활성입니다. 일반 `CI`와 새 Edge 검증 job은 유지했습니다. 최근
기존 schedule 실행 `39522368534`, `39351449713`, `39179701669`도 모두 skipped였습니다.
#40의 schedule 제거가 아직 main에 병합되지 않았다는 사실과 구분합니다.

## 출처별 Supabase 환경 관찰

| 출처 | 실제 관찰과 남은 범위 |
|---|---|
| EDPB | 목록·본문 저장·중복 판정 확인. 잘못된 원문 href로 실패한 문서를 별도 backlog에 보존하고 다른 문서 수집을 이어갔습니다. 원문 링크를 추정해 만들지 않습니다 |
| OECD | Edge HTTP 403. 같은 프로젝트 pg_net의 robots 요청 90은 HTTP 200이지만 실제 주제 목록 요청 103은 HTTP 403 및 `Just a moment...` 응답이었습니다. 보도자료 어댑터의 Supabase 실자료 성공은 미확인입니다 |
| CURIA | 목록 150건 발견, 실제 PDF 본문 추출·판본 저장·중복 판정 확인. 보도자료만 읽었으며 판결 전문·전체 기간 누락 없음은 입증하지 않았습니다 |
| CNIL | Edge와 같은 프로젝트 pg_net 요청 92 모두 HTTP 503. 실제 응답 제목은 Maintenance였습니다. 재시도 상태를 유지합니다 |
| ICO | 실제 목록·본문·날짜 추출·원문 판본 저장 확인. 웨일스어 원문을 포함합니다. 아래 초안의 수집 실행은 `f7bfb82e-162c-4969-8494-51c18bada4ad`입니다 |
| 아일랜드 DPC | 실제 목록·본문 저장·중복 판정 확인. 기존 서수 날짜 형식 `01st October 2026` 지원을 복원했습니다. 날짜 미상 판본은 보류합니다 |
| 싱가포르 PDPC | 실제 JSON 목록과 RSC 본문 추출 확인. 외부 기관 호스트 링크는 따라가지 않고 별도 backlog로 보존합니다. 운영 출처/호스트를 추가하지 않았습니다 |
| 일본 PPC | 실제 목록·새 원문 저장·다음 예약에서 duplicate 확인. 게시일 의미를 확정할 수 없는 자료는 null 및 AI 준비 보류입니다 |
| 미국 FTC | Edge와 pg_net robots 요청 91 모두 HTTP 403. 실제 응답에 자동 요청 차단 안내가 있었습니다. 이를 자료 없음으로 처리하지 않았습니다 |

위 결과는 전체 기간 수집 완료나 9곳 모두 정상이라는 뜻이 아닙니다. OECD·FTC의
공식 사이트 접근 허용과 CNIL 유지보수 종료는 현재 코드 검사로 대신할 수 없습니다.
새 우회 서비스는 추가하지 않았고 다른 기관의 성공으로 대체하지도 않았습니다.

## 한국어 초안 제출과 검수함 조회

이 단계는 **관리형 Codex cloud 세션에서 수동으로 시작한 작성 검증**입니다. 별도
생성 API를 호출하지 않았지만, 예약 작성 워커가 무인 실행됐다는 증거는 아닙니다.

- worker: `codex-cloud-manual-validation-20261021-dc9ed828a60b`
- job: `bcd815a6-8003-4387-b4e5-fafd031ae9b2`
- 원문 판본: `d399eee3-3850-4071-836c-750923b82e2e`
- 입력 SHA-256: `3ad99062884f0bfffa6a1dd963250986221329233596bc96e36f8c99ebc919b2`
- 제출: 2026-10-21 **22:16:09 한국시간**
- report: `43fe9b9e-09c3-4b4e-8345-3cbf43a188d5`

고정 Git 판본의 AGENTS·collector-runtime·collector-task·보고서 문체·용어집·작성 지침을
읽고 파일 해시를 작업 입력과 함께 기록했습니다. 당시 collector-task의 Git blob은
`bce0d5f08beb06d3972b97a4dee5a7efa94fa103`입니다. 웨일스어 본문을 실제로 읽고
공격 발생일·게시일·후속 계약일, 인원·용량, ICO 판단과 견책을 구분해 작성했습니다.
인용 8개를 정확한 입력 본문과 대조하고 `node scripts/trend-report.mjs --check`를
실행한 뒤 구조화 RPC로 제출했습니다. 작성자 해석 필드는 빈 값으로 두었습니다.
형식 검사나 인용 존재 검사가 사람 검수라는 주장은 하지 않습니다.

`/work`의 보고서/작업본 조회와 같은 열을 **팀 계정의 authenticated 역할 및 RLS**로
조회해 해당 ID와 작업본 revision 1을 확인했습니다. 수집 검수함 RPC에서도 다음을
확인했습니다. 브라우저 화면을 직접 열어 확인했다는 뜻은 아닙니다.

```text
status=draft
human_reviewed=false
reviewed_at=null
published_at=null
requested_at=null
trashed_at=null
reports_for_source=1
```

기존 보고서를 덮어쓰거나 공개 요청·승인·발행하지 않았습니다. 정책 RPC는 계속
`trend-draft-unlimited-v2`, `daily_claim_limit=null`, `targeted_claim_supported=true`입니다.

## 코드 검사와 배포 재현

실제로 통과한 검사입니다.

- 기존 Python 수집기 88개, 앱 137개 검사
- 새 Deno 어댑터/재개/PDF 검사 16개와 Deno check
- `npm run typecheck`, `npm run validate:data`, 웹 production build, `git diff --check`
- 실제 Supabase DB의 **롤백 트랜잭션**에서 비활성 gate·9출처 enqueue·중복 enqueue
  방지·오래된 임대 거부·실패 재등록·범위 확장·실패 URL별 backlog 재사용 검사
- 제출할 한국어 JSON의 보고서 형식 검사 및 실제 서버 submit 인용/임대 검사

이는 CI의 원격 실행 결과나 예약 한국어 작성 성공과 같은 판정이 아닙니다. PDF 검사는
텍스트 전용이며 선택적 canvas/Path2D 렌더링 경고가 있습니다. 렌더링 성공을 주장하지
않습니다. 앱 빌드의 기존 CSS/모듈 경고도 오류로 처리되지는 않았습니다.

기존 프로젝트의 보안 환경 설정을 사용하는 운영 명령은 다음과 같습니다. 비밀값은
명령 인수·출력·파일에 넣지 않습니다. `check-sql`은 큐 테스트 변경도 모두 rollback합니다.

```sh
python -m scripts.collector.cloud_admin check-sql
python -m scripts.collector.cloud_admin apply
python -m scripts.collector.cloud_admin deploy
python -m scripts.collector.cloud_admin configure
python -m scripts.collector.cloud_admin activate
# 중단 시 원문·큐·작업은 보존됩니다.
python -m scripts.collector.cloud_admin pause
```

`apply`는 미적용 runtime migration을 순서대로 적용합니다. `deploy`는 누락된 migration과
커밋되지 않은 함수 변경을 거부합니다. 실제 수집의 완전 성공 여부와 별개로, 운영 DB의
용량 보호도 유지합니다. 증거 snapshot 당시 DB는 약 27 MB, 중단 기준은 400 MB였습니다.

## 정확한 차단 원인과 재개 지점

1. 현재 스레드 도구 목록에는 Goal/클라우드 Codex 예약 생성·조회·이력 도구가 없습니다.
   `codex cloud list --limit 1 --json`도 실제 HTTP 401과 인증 토큰 파싱 실패를
   반환했습니다. 작동하는 Supabase 연결을 다시 요구하거나 CLI 인증을 덮어쓰지
   않았습니다. 예약 ID `6ad8ae449bb08191bbefcf554f0f4ae1`의 실제 이력에도 접근하지
   못했습니다. 사용자 전달 웹 시험은 예정 시각보다 이른 확인 시각이라는 한계가
   있으므로 예약 실행 입증에 사용하지 않았습니다.
2. 필요한 다음 연결은 **구독 내 예약 생성/이력 조회 도구와 매 실행의 저장소·DB·명령
   실행 권한**입니다. 제공되면 고정 판본의 `docs/collector-task.md`를 읽는 실제
   클라우드 작업을 등록하고, 향후 예약 시각의 worker ID·원문 판본·검사 명령 결과·
   새 draft ID·검수함 조회 및 다음 예약의 중복 방지/재개를 검증해야 합니다.
   예약 프롬프트 파일이 존재한다는 이유로 등록됐다고 표시하지 않습니다.
3. 원문 수집은 현재 운영 Cron/큐에서 계속 진행합니다. `collector_edge_sources`의
   미완료 범위와 `collector_edge_backlog`의 실패 위치가 재개 지점입니다. OECD·FTC
   접근 차단, CNIL 유지보수, 외부 호스트/날짜 미상/전체성 미검증 범위는 남겨 둡니다.
4. `collector_draft_policy()` 확인 뒤 한 건씩 선점하는 기존 RPC와 검증/submit 경로는
   이 cloud 세션에서 실제로 작동했습니다. 이를 예약 워커에서도 그대로 사용할 수
   있는지 확인하는 것이 남은 연결 작업입니다. PC cron·데스크톱 예약·self-hosted
   runner·유료 API로 대체하지 않습니다.
