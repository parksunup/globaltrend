# 자동 수집기 구축·클라우드 운영 검증 인계

작성일: 2026-10-22 한국시간. 인계받는 **웹 예약 도구가 있는 스레드가 구현과 실제 운영 검증의 주체**입니다. 이 문서 작성 스레드는 다른 대화의 예약을 생성·수정하거나 인앱 브라우저를 조작하지 못했습니다. 이 문서 자체가 예약 등록·실행 증거는 아닙니다.

## 1. 사용자 목표와 승인 범위

- 사용자 PC와 데스크톱 앱이 꺼져 있어도 클라우드에서 예약 수집 → 한국어 초안 작성 → 기존 `/work`에 미검수·미게시 draft 제출까지 실행합니다.
- 수집 예약·영속 대기·재시도는 기존 Supabase Cron·Queues가 맡습니다. 출처별 실행 환경은 다를 수 있습니다. Supabase에서 실패하는 출처를 계속 같은 방식으로만 시도하지 않습니다. OECD·FTC는 인계받는 스레드의 클라우드 Python 접근 성공을 활용할 대상입니다.
- 한국어 작성은 Codex 구독 내 클라우드 실행을 사용합니다. 저쪽 스레드를 크롤링·파싱에만 제한할 필요는 없으며, 필요한 권한을 확인하면 구현·수집·작성·검수함 제출·예약 검증까지 이어갑니다.
- 실제 클라우드 예약·작성 워커 연결과 무인 시험은 사용자가 승인했습니다. 일상적인 선택마다 재승인을 요구하지 않습니다. 실제 접근 실패, 필요한 권한 부족, 실행 방식의 중대한 변경은 근거와 함께 먼저 보고합니다.
- 금지: main 병합, 자동 검수 승인·공개 발행, 유료 생성 API·추가 결제, 새 외부 서비스, 별도 Vercel 프로젝트, 사용자 PC cron·데스크톱 예약·PC self-hosted runner를 통한 운영 대체.
- 승인된 출처는 EDPB, OECD, CURIA, CNIL, ICO, 아일랜드 DPC, 싱가포르 PDPC, 일본 PPC, 미국 FTC의 9곳입니다. OECD의 관련 보도자료도 포함합니다. 출처·허용 호스트를 임의로 늘리거나 줄이지 않습니다.
- 모든 사용자 답변은 한국어 존댓말로 작성합니다. 진행 상황을 보고하고, 계획이나 문서 작성만으로 끝내지 않습니다.

## 2. Git·PR 기준 — 2026-10-22 재조회

| 대상 | 실제 상태·판본 |
|---|---|
| main | `1010742905453afdb828e4dcf995c4bc69885322`, PR #37 무제한 정책 반영 |
| [PR #39](https://github.com/parksunup/globaltrend/pull/39) | OPEN, base `main`, head `codex/collector-operational-validation`, `21df271529efe1cfc8552475d6ab3abe180cbd0f` |
| [PR #40](https://github.com/parksunup/globaltrend/pull/40) | OPEN, base **#39 브랜치**, head `codex/collector-runtime-foundation`, `5662d4cb2e7ac437889760348fe9195e0c3702de` |
| [PR #41](https://github.com/parksunup/globaltrend/pull/41) | OPEN·draft, base **#40 브랜치**, head `codex/collector-supabase-runtime` |
| 인계 직전 #41 HEAD | `fb657388f8825298cb5d1b0d23ac2ad063be0492`. 이 인계 문서를 포함한 후속 문서 커밋이 추가되므로 원격 최신 HEAD도 확인합니다 |
| 실제 Edge 배포 코드 | `93686aaa7480fca67d9d496f978f6a5231bc3faa`, 문서 HEAD와 다릅니다 |

#41에는 #39·#40 작업이 포함돼 있습니다. 기존 PR 브랜치를 덮어쓰거나 main 기준으로 같은 기능을 중복 구현하지 않습니다. PR #32의 과거 설정을 현재 운영 기준으로 삼지 않습니다. PR #33에는 당시 #32 내용이 포함됐습니다.

저장소가 없는 임시 작업 폴더는 명령 실행 불가능의 근거가 아닙니다. 기존 checkout이 없을 때만 다음처럼 고정 판본을 준비합니다. 기존 사용자 파일·dirty checkout은 보존합니다.

```bash
task_checkout=$(mktemp -d /tmp/globaltrend-worker-XXXXXX)
git -C "$task_checkout" init -q
git -C "$task_checkout" remote add origin https://github.com/parksunup/globaltrend.git
git -C "$task_checkout" fetch --depth=1 origin codex/collector-supabase-runtime
git -C "$task_checkout" checkout --detach FETCH_HEAD
cd "$task_checkout"
git rev-parse HEAD
git hash-object docs/collector-task.md
date -u
python3 --version
node --version
```

판본을 기록하고 해당 checkout의 파일을 사용합니다. 기본 브랜치의 `docs/collector-task.md` 조회는 실제 404였습니다. 인계 직전 해당 파일의 Git blob SHA는 `bce0d5f08beb06d3972b97a4dee5a7efa94fa103`이며 SHA-256과 혼동하지 않습니다. 새 작업은 명명된 작업 브랜치에서 커밋하고 강제 push하지 않습니다.

## 3. 읽어야 할 지침과 증거

먼저 `AGENTS.md`, `architecture.md`, [클라우드 설계](trend-collector-cloud.md), [실행 환경](collector-runtime.md), [실행 계약](collector-task.md), [초기 연결 검증](cloud-runtime-verification-20261021.md)을 읽습니다.

한국어 작성 전에는 [보고서 문체](trend-report-style.md), [용어집](translation/glossary.md), [작성 워커](trend-draft-worker.md)를 반드시 읽습니다. 형식 검사로 원문·내용 검토를 대체하지 않습니다.

[실서버 운영 기록](cloud-runtime-operation-20261021.md)과 [당시 서버 증거](cloud-runtime-evidence-20261021.json)는 구현·배포·수동 draft·실제 Supabase 예약 기록입니다. [이전 Python 운영 검증](collector-operational-validation-20261021.md)도 참고합니다.

과거 문서의 “작성 예약 도구 없음”은 **그 문서를 작성한 스레드의 당시 상태**입니다. 이후 사용자 전달로 확인된 웹 예약·터미널 실행 결과를 무시하거나, 인계받는 스레드에도 도구가 없다고 가정하지 않습니다. 반대로 새 스레드에 비밀값·권한·임시 파일이 상속된다고 가정하지 않습니다.

## 4. 이미 구현·배포된 부품

### 수집기와 자료 처리

- Python: `scripts/collector/{core,parsers,store,run,preflight,environment}.py`, 설정 `config/trend-collector.json`.
- Deno Edge: `supabase/functions/trend-collector/{index,http,adapter,runtime}.ts`, `registry.json`, `deno.json`, `deno.lock`.
- Python을 Edge에서 실행하지 않습니다. Deno HTML 파서는 linkedom, PDF는 pdfjs 텍스트 추출이며 렌더링·OCR은 하지 않습니다.
- 실제 배포 함수: `trend-collector`, ID `b82cc275-c8b7-4c4a-9339-7240a7fde85f`, 마지막 확인 version 9. 새 배포가 있었는지는 재조회합니다.
- 기존 `ingest_source_item`이 URL·내용 해시·원문 판본·draft job을 연결합니다. 기존 보고서는 자동 교체하지 않습니다.
- HTML 텍스트 정규화, 서수·일본어 전각 날짜, RSS, PDF 연결 문서 보존을 보완했습니다. 파서가 바뀌면 해시가 달라질 수 있으므로 불필요한 정규화 변경을 피합니다.

### Supabase 영속 상태

기존 프로젝트는 **`emlgwhkgaihhrirhdpnp` 하나**입니다. 적용된 migration:

```text
20261021130000_collector_edge_runtime.sql
20261021131500_collector_edge_backlog.sql
20261021133000_collector_backlog_dedup.sql
```

| 부품 | 역할·주의 |
|---|---|
| `collector_edge_control` | `enabled`, 배포 Git SHA. 현재 활성 |
| `collector_edge_sources` | 출처별 Edge 상태·queued·원래 범위·legacy cursor |
| `pgmq.q_trend_collect` | 영속 수집 큐, 현재 Edge 소비 임대 120초 |
| `collector_edge_backlog` | 상세 실패 URL·범위·상태, **`resolved boolean`**. `resolved_at` 열은 없음 |
| `collector_edge_events` | 문서 처리 실행·출처별 결과·execution ID |
| `collector_edge_ticks` | Cron tick·pg_net 요청 ID |
| `collector_get_progress(source_id)` | 기존 Python 진행 위치. Edge 상태와 별개이므로 함께 확인 |
| `source_items`, `source_item_revisions`, `draft_jobs` | 정확한 원문 판본·내용 해시·초안 대기 작업 |

`collector_edge_take` / `collector_edge_finish`는 메시지 ID·read count·현재 임대를 확인합니다. 실패 상세는 독립 backlog에 보존한 후 주 수집을 진행합니다. 동일 출처·URL의 미해결 backlog는 하나로 유지하고 범위를 합칩니다.

미완료 시작일은 보존하고 종료일을 확장합니다. Edge와 Python의 page/offset/fingerprint는 서로 그대로 대입할 수 없습니다. 새 실행 경로로 옮길 때 기존 상태를 보존하고 같은 범위를 재탐색하거나 검증된 변환을 사용합니다. 기간을 최근 1주로 줄이거나 실패를 자료 없음으로 바꾸지 않습니다.

### 운영·배포 도구

`scripts/collector/cloud_admin.py`는 기존 프로젝트 관리 API를 사용합니다.

```bash
python -m scripts.collector.cloud_admin check-sql
python -m scripts.collector.cloud_admin apply
python -m scripts.collector.cloud_admin deploy
python -m scripts.collector.cloud_admin configure
python -m scripts.collector.cloud_admin activate
python -m scripts.collector.cloud_admin pause
```

**인계받자마자 위 명령을 모두 실행하지 않습니다.** migration과 함수는 이미 배포됐습니다. `apply`는 미적용 migration만 적용하고 `deploy`는 누락 migration·커밋되지 않은 함수 변경을 거부합니다. `configure`는 Edge 호출 비밀과 Git SHA를 설정하므로 문서 커밋을 코드 배포 판본처럼 기록하기 위해 실행하지 않습니다. `activate`는 예약 설정을 변경하고 `pause`는 전체 수집을 멈춥니다. 사이트별 경로 변경에 전체 중단을 임의로 사용하지 않습니다.

`check-sql`은 운영 큐·상태를 일시 변경하는 테스트를 **전체 rollback하는 트랜잭션**입니다. 일반 읽기 전용 조회와 구분하며 실행 중 소비자와의 잠금 영향도 고려합니다.

호출 비밀은 Vault `trend_collector_invocation_key`와 Edge `TREND_COLLECTOR_INVOCATION_KEY`에 있습니다. 조회·출력·채팅 전송하지 않습니다. 비인증 Edge POST는 실제 401이었습니다.

## 5. 현재 서버 재조회 — 2026-10-22 00:05:38 한국시간

이 인계 작성 중 기존 관리 연결로 **읽기 전용 SQL 트랜잭션**을 실행해 확인했습니다. 누적 개수·offset은 계속 변하므로 다음 작업 시작 시 다시 조회합니다. 원문 본문·초안 전문·비밀값은 인계에 넣지 않습니다.

- control: `enabled=true`, Git SHA `93686aaa7480fca67d9d496f978f6a5231bc3faa`.
- 위 runtime migration 3개 적용 확인.
- 큐 15건, 미해결 backlog 7건, draft job `pending=128`, `submitted=47`.
- 정책: `trend-draft-unlimited-v2`, `daily_claim_limit=null`, `targeted_claim_supported=true`.
- Cron job 1 `trend-collector-daily`: `17 22 * * *` UTC = 매일 **07:17 한국시간**, active.
- Cron job 2 `trend-collector-consumer`: 매분, active. run 122는 2026-10-22 00:05:00 한국시간 `succeeded`.
- 이 Cron 성공은 SQL/HTTP 요청 제출 성공입니다. 상세 수집 결과는 events와 pg_net 응답을 대조해야 합니다.
- 다음 매일 예약은 2026-10-22 07:17 한국시간이며, 인계 시점에는 이 07:17 실행을 아직 관찰하지 않았습니다.

| 출처 | Edge의 보존 범위 | offset / failures | 상태 |
|---|---|---|---|
| OECD | 2026-10-16~10-21 | 0 / 6 | queued, 마지막 실패 403 |
| FTC | 2026-10-16~10-21 | 0 / 6 | queued, 마지막 실패 403 |
| CNIL | 2026-09-21~10-21 | 0 / 6 | queued, 마지막 실패 503 |
| EDPB | 2026-09-21~10-22 | 8 / 0 | queued, partial |
| CURIA | 2026-09-21~10-22 | 104 / 0 | queued, partial |
| ICO | 2026-09-21~10-22 | 16 / 0 | queued, partial |
| DPC | 2026-09-21~10-22 | 1 / 0 | queued, partial |
| PDPC | 2026-10-16~10-22 | 1 / 0 | queued, partial |
| PPC | 2026-09-21~10-21 | 0 / 0 | queued=false, 전체 기간의 완전성 미확인 |

위 표의 PPC 상태는 `queued=false`, `listing_exhaustiveness_unverified`입니다. 큐가 비어 있어도 전체 기간의 수집 완료로 취급하지 않습니다.

같은 시점에 별도로 조회한 **Python 진행 위치**는 다음과 같습니다. 앞 표의 Edge 위치와 다릅니다.

| 출처 | Python 범위 | cursor와 미확정 상태 |
|---|---|---|
| OECD | 2026-10-16~10-21 | 주제 목록 offset 5, unknown_dates 4, had_pagination=false |
| FTC | 2026-10-16~10-21 | RSS offset 6, unknown_dates 0, had_pagination=false |
| CNIL | 2026-09-21~10-21 | `actualites?page=12` offset 1, unknown_dates 0, had_pagination=true |

다음 읽기 전용 조회로 재개 위치와 실제 실행 기록을 다시 확인할 수 있습니다. 연결 도구의 권한 범위에서 실행하고 비밀 저장소는 조회하지 않습니다.

```sql
select now(), public.collector_draft_policy();
select enabled, git_sha, updated_at from public.collector_edge_control;
select jobid, jobname, schedule, active from cron.job
where jobname in ('trend-collector-daily', 'trend-collector-consumer');
select slug, queued, state, updated_at from public.collector_edge_sources;
select slug, public.collector_get_progress(source_id)
from public.collector_edge_sources where slug in ('oecd','ftc','cnil');
select count(*) from pgmq.q_trend_collect;
select count(*) from public.collector_edge_backlog where not resolved;
select status, count(*) from public.draft_jobs group by status;
select jobid, runid, status, start_time, end_time from cron.job_run_details
order by start_time desc limit 10;
select id, source_id, execution_id, trigger_kind, started_at, finished_at,
       result->>'status' as status, result->>'reason' as reason
from public.collector_edge_events order by started_at desc limit 20;
```

기존 GitHub workflow `trend-collector.yml`(ID `388445123`)은 `disabled_manually`로 재확인했습니다. PR #40에는 schedule 트리거 삭제가 있지만 미병합 상태라 main의 파일 정의에는 옛 schedule이 남습니다. 중복 운영을 막기 위해 임의로 다시 활성화하지 않습니다. 일반 CI는 활성 상태입니다.

## 6. 出처별로 알려진 실제 접근 결과

Supabase Edge 환경에서 EDPB·CURIA·ICO·DPC·PDPC·PPC는 목록/본문의 부분 수집이 확인됐습니다. OECD·FTC는 403, CNIL은 503이며 당시 CNIL 응답 제목은 `Maintenance`였습니다. 유지보수 가능성은 있으나 최신 상태는 재확인하고 복구 전까지 미완료 범위를 유지합니다.

다음은 **사용자가 인계받는 웹 스레드에서 전달한 수동 실행 결과**입니다. 이 작성 스레드가 그 실행 로그를 직접 조회한 것은 아닙니다.

- 터미널 시각: 2026-10-21 23:46:25 한국시간 (`14:46:25 UTC`). 고정 Git SHA와 Python 3.12.14, 지침 파일 7개 확인.
- OECD: 진단 `2938d62a-0e26-4eb9-9484-5ce2372b0fea`, 목록 6건·첫 문서 공식 초록 파싱. 표시일/속성일이 하루 달라 게시일 미확정. 관련 보도자료 경로의 실제 수집은 미실행.
- FTC: 진단 `c39b345e-8ec0-4eab-b904-1f4abc862841`, 목록 30건·첫 보도자료 파싱. 연결 자료 9건 미열람. **현재 저쪽에서 접근 성공했다는 근거**이며 Edge 성공은 아님.
- CNIL: 진단 `5355a1ba-8037-4ba8-bde0-4b8d8dfe39a4`, 목록/표본 모두 503. 원응답 본문 미저장.
- 관리 DB 읽기는 성공했지만 당시 명령 환경의 Supabase 변수와 운영 gate 4개가 없어 실제 수집 저장·작업 선점·초안 제출은 하지 않았다고 보고.

FTC는 다른 수동 실행에서 503도 관찰됐습니다. 출처 접근은 시간·실행 환경별 관찰로 남기고 항상 성공한다고 보장하지 않습니다. OECD/FTC의 성공한 클라우드 경로를 활용하는 것이 사용자 최신 방향입니다. CNIL을 승인 출처에서 삭제하지 않습니다.

과거 실제 수집 자료도 존재합니다. 과거 조회에서 OECD source item 6건/본문 판본 5건/보고서 3건, FTC 21/19/2, CNIL 21/19/15였습니다. 이는 당시 누적 관찰로서 현재 개수·전체 기간 완료·모든 본문 품질을 뜻하지 않습니다. 수동 Codex·GitHub 시험 등 서로 다른 실행 경로의 기록이 섞여 있고 모든 자료의 실행 환경이 기록돼 있지는 않습니다.

## 7. 웹 예약 증거와 보고 방식

### 기존 예약 1

- ID `6ad8ae449bb08191bbefcf554f0f4ae1`, 예정 2026-10-21 21:26:24 한국시간.
- 사용자 전달: GitHub 파일/정책 SQL 조회 성공. 하지만 확인 시각 21:22:28~21:22:40은 예정 시각보다 빨라, 그 결과만으로 예약에 따른 실행을 입증하지 못합니다.

### 기존 예약 2

- ID `6ad8c8e9357c8191aa96067dd0cdc2ad`, 예정 2026-10-21 23:20:05 한국시간.
- 사용자 전달 실제 실행 23:24:19~23:24:40. 사용 도구 `mcp__codex_apps__github_fetch_file`, `exec_command`, `mcp__codex_apps__supabase_execute_sql`.
- AGENTS blob `af7d5fa4ede2d07c8b96622d89c3ff47218ea99b`·정책 조회 성공. collector-task는 main 요청으로 404. scratch가 Git 저장소가 아니라는 이유로 date/python 명령까지 미실행.
- 이후 별도 수동 실행에서는 checkout과 터미널 명령이 실제 성공했습니다. 따라서 단순 연결 시험을 반복하지 말고 실제 작업 안에서 checkout과 명령 실행을 수행합니다.
- 인계받는 스레드에 예약 이력 도구가 있으면 실제 예약 run ID·시각·지침·도구 출력을 확인합니다. 사용자 전달 결과와 직접 조회한 기록을 구분합니다. 이 인계에서는 예약 2의 run ID를 직접 확보하지 못했습니다.

**주의: `scripts/collector/environment.py`의 `scheduler_connected`는 현재 GitHub Actions 관련 환경변수로만 판정합니다.** 웹 예약으로 실행된 Python도 `standalone-process`, `scheduler_connected=false`, `trigger=manual`로 기록될 수 있습니다. 이 값만으로 웹 예약이 아니라고 결론 내리거나, GitHub 환경변수를 위조해서 true로 만들지 않습니다. 실제 웹 예약 ID·run ID·예정/실행 시각을 별도로 보존하도록 보완해야 합니다.

## 8. 자격 증명·운영 gate 해결

이 인계 작성 환경에는 Supabase 변수 3개가 존재하고 관리/자료 접근도 작동했습니다. 수신 스레드의 명령 환경에는 없었다는 보고가 있으므로 자동 전달을 가정하지 않습니다. 사용자가 이미 작동을 확인한 Supabase 연결을 무조건 다시 요구하지 않습니다.

1. 수신 스레드의 연결된 Supabase 도구가 **기존 claim/ingest/submit RPC를 호출할 권한과 쓰기 기능**을 제공하는지 확인합니다. 조회 성공만으로 쓰기 가능을 단정하지 않습니다. 권한은 읽기 전용 조회로 먼저 확인하고, 쓰기 시험은 처리할 실제 작업으로 진행해 불필요한 claim 시도를 낭비하지 않습니다.
2. 그 도구로 안전하게 기존 RPC를 호출할 수 있으면 Python 명령에 키가 없다는 이유만으로 중단하지 않습니다. 필요하면 수집기와 연결 도구 사이의 어댑터를 구현합니다. 터미널은 fetch/parse/파일 검사, 연결 도구는 영속 데이터/RPC를 맡을 수 있습니다. 실제 임대·커서 저장·재시도 경계를 지킵니다.
3. 연결 도구의 쓰기가 실제 거부되거나 Python RPC 직접 접근이 필요한 경우에만 해당 클라우드 실행의 보안 설정에 필요한 자격 증명을 연결합니다. 채팅·로그·저장소·브라우저 입력문·명령 인수에 비밀값을 넣지 않습니다.
4. 관리 토큰 `SUPABASE_ACCESS_TOKEN`은 **`api.supabase.com`만** 대상으로 사용합니다. `SUPABASE_SECRET_KEY`는 기존 프로젝트 자료 처리 API용입니다. 두 키를 바꿔 보내지 않습니다. 인증 실패는 실제 HTTP/권한 응답으로 진단합니다.
5. `SCHEDULE_ENABLED`, `COLLECTION_ENABLED`, `FREE_LIMITS_VERIFIED`, `CLOUD_PIPELINE_VERIFIED`의 누락은 운영 검증 과제입니다. 이미 승인된 범위를 다시 묻는 대신, 실제 용량·이용조건·추가 과금 없음·해당 연결의 사용 가능 여부를 확인해 검증된 값만 실행 설정에 반영합니다. 미확인 비용/파이프라인 조건을 일괄 true로 만들거나 gate 검사를 삭제하지 않습니다. `SCHEDULE_ENABLED=true`만으로 실제 예약을 입증하지 않습니다.
6. 기존 문서의 초기 “배포 보류/운영 비활성”을 무조건 재승인 사유로 삼지 않습니다. 이후 사용자는 기존 서비스 내 실제 수집·작성 워커 연결·예약 시험을 승인했습니다. 충돌이 남는 중대한 변경만 구체적인 변경·검증 결과와 함께 보고합니다.

관리 SQL의 `read_only=true`는 제한된 `supabase_read_only_user`로 실행되어 service-role 전용 정책/RPC가 권한 오류를 낼 수 있었습니다. 이 경우 토큰 전체가 잘못됐다고 판단하지 않습니다. 실제 역할과 해당 함수 실행 권한을 구분하고, 기존 자료 RPC나 허용된 관리 조회를 사용합니다. 이 인계의 관리 스냅샷은 관리 SQL 내부 `begin read only; ... commit;`으로 조회했습니다. 운영 권한을 임의로 grant하거나 인증을 우회하지 않습니다.

### 설정 관련 별도 발견

편집용 환경 설정 초안은 PR #32 당시 checkout `2aa5a5d78b2a20e7231906b85ba9da570d97d12f`와 시작 지침을 참조합니다. 현재 실행 checkout/활성 배포와 같은 것으로 취급하지 않습니다. 이 인계 작성에서는 환경 설정을 변경하지 않았습니다. 수신 스레드에서 실제 사용할 환경의 설정을 조회하고 필요한 저장소 판본·설치/시작 지침을 갱신해야 합니다. 다른 환경의 초안을 추측해서 교체하지 않습니다.

공식 [클라우드 환경 안내](https://developers.openai.com/codex/environments/cloud-environments)의 Current limitations에는 **Computer and browser use 미지원**이 명시돼 있습니다. 이 작성 스레드의 인앱 브라우저 미연결을 install script·재로그인·권한 재부여로 해결할 수 있다고 안내하면 안 됩니다. 수신 웹 스레드는 이미 자체 예약·연결 도구가 있으므로 이 작성 스레드의 브라우저 제어를 선행 조건으로 삼지 않습니다.

수신 환경의 `typing_extensions==4.15.0`/Pydantic `>=4.16.0` 충돌 경고는 프로젝트 Python 의존성을 별도 venv에 설치해 호스트 도구와 분리하는 방식부터 확인합니다. 공유 환경의 패키지를 무작정 downgrade하거나 요구사항을 임의로 완화하지 않습니다.

## 9. 남은 구현 — 권장 실행 순서

1. **수신 스레드의 권한 확인:** 기존 Git 읽기/작업 브랜치 push, Supabase 필요한 RPC 쓰기, 실제 예약 생성·이력 조회를 확인합니다. 준비된 작업을 같은 문서 판본으로 수행합니다. main 병합은 하지 않습니다.
2. **실제 한국어 초안 1건 완주:** 유효한 대기 작업을 한 번에 1건 선점 → 원문 판본 읽기 → 작성·사실 대조 → node 검사 → submit → `/work` 조회. 이것이 이미 수동으로 되는지 확인한 뒤 예약에 같은 경로를 씁니다. 기존 과거 검증 원고를 새 작업에 재제출하지 않습니다.
3. **사이트별 수집 실행부 연결:** OECD·FTC에 수신 스레드의 검증된 클라우드 Python 경로를 연결하고 CNIL 실패는 보존합니다. Supabase가 작업·진행 위치·재시도를 소유하게 합니다. 현재 DB에는 Edge/Codex 실행부 배정 기능이 완성돼 있지 않으므로 필요한 migration·함수·소비자 변경을 구현합니다.
4. **동시 소비 방지:** Edge가 계속 9곳을 대상으로 소비 중입니다. 새 Python 워커를 붙이기만 하면 같은 출처를 두 실행부가 동시에 탐색할 수 있습니다. 출처별 배정·유효 임대·작업 완료/재시도를 원자적으로 처리하고, 기존 큐/범위/backlog를 보존한 채 전환합니다. 전체 Edge 운영을 임의로 중단하지 않습니다.
5. **실제 미래 예약:** 코드 판본과 지침·DB 도구를 갖춘 구독 내 클라우드 워커를 예약합니다. 기존 일회성 시험과 중복된 운영 예약을 만들지 않도록 조회합니다. 한 번에 1건씩 처리하는 것은 배치 방식이며 하루 10건 상한을 만들지 않습니다.
6. **다음 예약에서 재개:** 선점한 원문 판본·입력 해시·lease를 확인하고 이미 제출한 작업은 재제출하지 않습니다. 새 원문 판본은 기존 보고서 보호 경로를 따릅니다. 시간·구독 한도 중단은 영속 상태에서 재개합니다.
7. **실서버 결과를 기록:** Supabase 예약/수집과 Codex 예약/작성의 실행 ID를 연결하고, 성공한 범위·미완료 범위·검수함 결과·다음 실행을 증거로 보고합니다.

## 10. 초안 RPC와 검수함 계약

정책은 `trend-draft-unlimited-v2`, `daily_claim_limit=null`이어야 합니다. 하루 10건 상한은 제거됐고 RPC 배치 1~10건 제한은 하루 제한이 아닙니다.

```text
claim_trend_draft_jobs(p_worker text, p_limit integer)
claim_trend_draft_jobs(p_worker text, p_limit integer, p_target_job_id uuid)
submit_trend_draft(p_job_id uuid, p_worker text, p_draft jsonb)
fail_trend_draft(p_job_id uuid, p_worker text, p_error text)
```

worker는 실행별 독립 이름을 쓰며 최대 160자입니다. claim 반환의 `job_id`, `revision_id`, `input_hash`, `instruction_version`, `lease_until`, `content_text`, `metadata`, 제목·출처·공식 URL·날짜를 사용합니다. 30분 임대·작업별 최대 3시도·현재 판본 일치·출처 승인·저장 용량 보호를 유지합니다. 필요하면 eligible 작업을 읽기 전용으로 먼저 확인해 실제 쓸 수 있는 후보만 선점합니다.

제출 JSON은 기존 문서 계약을 사용하며 새 필드를 임의로 만들지 않습니다. `policy_implications_ko`는 빈 값이어도 됩니다. 개인정보 보호상 의미나 작성자 해석을 필수 본문으로 추가하지 않습니다. 원문에 없는 사실·URL·날짜·법적 결론을 만들지 않습니다. 조사·혐의·합의 제안·최종 명령·판결을 구분합니다.

인용은 해당 `content_text`의 실제 문자열이며 각 quote는 12자 이상입니다. `evidence_index`는 0부터 시작합니다. 문체 검사뿐 아니라 인용이 실제 주장을 뒷받침하는지도 검토합니다.

```bash
node scripts/trend-report.mjs --check work/draft-<job_id>.json
```

기존 보고서가 있으면 submit은 덮어쓰지 않고 `needs_human_review`로 proposed draft를 보존합니다. 새 report ID가 생기지 않는 정상 보호 결과와 실패를 구분합니다. 중복 보호는 source item/판본 기반이므로 다른 언어판·URL의 같은 사건을 자동으로 완벽히 통합한다고 주장하지 않습니다. 실제 원문 관계와 기존 보고서를 확인합니다.

검수함 확인은 단순 submit 응답 외에 기존 `reports`·작업본·`get_trend_collector_review()`의 해당 보고서 포함 여부를 확인합니다. 팀 권한/RLS 조회와 관리자 조회를 구분하고, 관리자 SQL 성공을 브라우저 UI 확인으로 표현하지 않습니다. `status=draft`, `human_reviewed=false`, `reviewed_at=null`, `published_at=null` 및 공개 요청/휴지통 상태를 실제 schema에 맞게 확인합니다. 조회 권한을 무작정 확대하지 않습니다.

### 기존 수동 성공 원고 — 재제출 금지

- 제출 시각: 2026-10-21 22:16:09 한국시간. **예약 작성이 아닌 이 작성 스레드의 수동 cloud 검증**입니다.
- worker `codex-cloud-manual-validation-20261021-dc9ed828a60b`
- job `bcd815a6-8003-4387-b4e5-fafd031ae9b2`
- revision `d399eee3-3850-4071-836c-750923b82e2e`
- input hash `3ad99062884f0bfffa6a1dd963250986221329233596bc96e36f8c99ebc919b2`
- report `43fe9b9e-09c3-4b4e-8345-3cbf43a188d5`
- 웨일스어 ICO 원문에서 작성, 인용 8개 대조·실제 node 검사·서버 submit 성공. 당시 팀 authenticated/RLS와 기존 검수함 RPC에서 조회했습니다.
- 이번 2026-10-22 00:05:38 재조회에서도 draft·human_reviewed=false·reviewed_at/published_at=null입니다. 이 재조회는 관리 SQL이며 새로운 팀/UI 검증을 수행했다는 뜻은 아닙니다.
- 원문/초안/claim 파일은 `work/cloud-validation/`의 ignored 파일입니다. 다른 스레드에 전달되거나 Git에 포함된다고 가정하지 않습니다. 인계에 원문 전문·초안 전문·키를 싣지 않습니다.

## 11. 기존 검증과 변경 후 검사

인계 직전 코드 `fb65738`의 [CI 39610395650](https://github.com/parksunup/globaltrend/actions/runs/39610395650)은 collector·collector-edge·verify·database 모두 성공입니다. 당시 수동 검사: Python 88개, 앱 137개, Deno 16개·Deno check, typecheck, validate:data, build, SQL rollback 검사. 새 변경의 통과 증거로 재사용하지 않습니다.

필요한 변경 범위에 맞춰 기존 검사를 실행합니다. 예:

```bash
python -m unittest discover -s tests -p 'test_collector*.py'
npm test
npm run typecheck
npm run validate:data
```

Deno 검사와 CI의 정확한 명령은 `.github/workflows/ci.yml`을 따릅니다. PDF 렌더링 경고를 OCR/렌더링 성공으로 표현하지 않습니다. DB migration은 프로젝트의 롤백/CI 검증 경로를 사용하며 운영 DB reset은 금지합니다. 저장소 편집 표본을 변경하면 `node scripts/trend-report.mjs --render`와 자료 검사를 실행합니다.

기존 Vercel 프로젝트는 `pipc-fairy/globaltrend`입니다. PR push에 따른 기존 Git 연동 Preview가 자동 생성될 수 있습니다. 수동 운영 배포·새 프로젝트 생성과 구분합니다.

인계 작성 로컬 checkout에 미추적 `error.log`가 이미 있습니다. 이 문서 작업에서 만든 파일이 아니므로 읽어서 무분별하게 공개하거나 지우거나 커밋하지 않습니다. 수신 스레드의 사용자 변경도 보존합니다.

## 12. 완료 판정·중단 보고

다음을 각각 구분해서 보고합니다: 코드 검사 통과 / 수동 수집 성공 / 수동 작성·제출 성공 / 예약 등록 성공 / 실제 예약 수집 성공 / 실제 예약 작성·제출 성공 / 다음 예약 재개 성공.

완료에는 실제 예약 시각의 수집 실행·서버 ID·출처별 결과·재개 위치, Codex 예약의 실제 job/revision/input hash/임대 선점, 검증 명령 출력, 미검수·미게시 draft의 `/work` 조회, 다음 예약의 중복 없는 재개가 필요합니다. 07:17 daily 실행과 매분 큐 소비도 따로 확인합니다.

도구·권한·구독 한도로 중단되면 완료한 변경/커밋·배포, 실제 실행 ID와 한국시각, 미완료 범위·job 상태·다음 재시도 위치, 정확한 오류와 필요한 조치를 비밀값 없이 남깁니다. 사용량 초기화가 자동으로 대화를 재개한다고 주장하지 않습니다.
