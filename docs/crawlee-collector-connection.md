# PR #114 Crawlee 탐색 결과를 일일 수집에 연결

## 현재 파이프라인과 빠진 연결

PR #114의 `scripts/catalog_probe.py`와 `Source catalog probe (read only)`는 2026-11-09에
36개 후보 중 28개에서 목록과 표본 본문을 읽었습니다. 이 실행은 Supabase에 쓰지 않고,
수집 커서도 갱신하지 않습니다. 따라서 그 28개는 수집 가능한 경로의 표본 확인 결과이지,
예약 수집기 28개가 운영 중이었다는 뜻은 아닙니다.

기존 Python/Crawlee `scripts/collector.run`은 수동 검증 워크플로에서만 호출됐습니다.
매일 동작하는 `trend-cloud-python`은 Supabase 큐의 claim을 처리하는 워커이고, 현재
운영 DB의 `trend-collector-daily`와 `trend-collector-consumer` Cron은 모두 비활성입니다.
따라서 PR #114 탐색 결과가 실제 일일 수집에 연결되지 않았습니다.

## 별도 일일 Crawlee 실행

`.github/workflows/crawlee-daily-collector.yml`은 매일 03:00 KST 예약 실행입니다.
GitHub가 시작을 늦추더라도 수집 구간은 기존 진행 위치를 사용해 다음 실행에서 겹쳐
보완합니다. 이 workflow는 매일 08:10에 예약 이력을 재검사하는 별도 모니터를 만들지
않습니다.

`config/crawlee-daily-source-set.json`은 PR #114 표본에서 성공한 28개 중 사용자가
제외한 EU Council을 뺀 27개를 지정합니다. EP와 RIPD는 성공 표본 목록에 없습니다.
2026-11-11 명시적인 활성화 지시에 따라 이전에 꺼져 있던 후보 설정 9개를 켰습니다.
따라서 이 목록 27개가 모두 예약 실행 대상입니다. 기존 품질·범위·날짜 검토 표시는
유지하고, PR #114의 실시간 표본 성공을 전체 기간 완전성으로 취급하지 않습니다.
OECD는 기존 HTML/Python 어댑터 대신 새 WebCMS RSS collector가 맡고, FTC·CalPrivacy·
CAC·PCPD·베트남은 별도 Scrapling collector가 맡으므로 Crawlee 집합에서는 제외합니다.

마이그레이션 `20261111041009_activate_pr114_crawlee_sources.sql`은 14개 누락 publisher/
source 행을 만들고, 27개 source 행을 활성화합니다. `terms_reviewed_at`은 내부 수집 게이트
값이며 저작권 라이선스나 사이트 약관의 허가를 뜻하지 않습니다. robots.txt와 각 collector의
요청 간격은 계속 준수합니다.

수집기는 기존 `config/trend-collector.json`의 source ID와 production route/parser를 사용합니다.
DB `collector_source_allowed`와 저장 용량 검사를 매 실행 때 확인합니다. 수동
`workflow_dispatch`는 읽기 전용 probe이며 DB를 쓰지 않습니다. 저장소 변수
`SCHEDULE_ENABLED`, `COLLECTION_ENABLED`, `FREE_LIMITS_VERIFIED`,
`CLOUD_PIPELINE_VERIFIED`는 모두 `true`여야 예약 수집이 실제로 기록됩니다.
예약 실행의 쓰기 여부는 저장소 변수 `SCHEDULE_ENABLED`, `COLLECTION_ENABLED`,
`FREE_LIMITS_VERIFIED`, `CLOUD_PIPELINE_VERIFIED`가 모두 `true`여야 합니다.

이번 변경은 기존 Edge/Crawlee Cron·Queue 파이프라인을 삭제하거나 활성화하지 않습니다.
새 Actions workflow는 기존 Crawlee HTTP transport와 `ingest_source_item` 저장 계약을
사용하는 별도 실행입니다. Scraping/OpenAI 작성 API 호출은 하지 않습니다.

## OECD 대체 수집 경로

OECD는 새 모듈 `scripts/collector_oecd_rss/`가 공식 WebCMS RSS API 두 경로만 사용합니다.
PR #42의 HTML topic route, 977자 Python 초록 경로, 기존 OECD Scrapling 어댑터를 가져오지
않습니다. RSS의 정확한 게시 요약과 날짜를 보존하고, 링크된 공식 상세 페이지 또는 PDF가
robots 허용 및 요청 간격 조건에서 열리면 별도 추출합니다. 상세/PDF 요청이 403 등으로
실패하면 RSS 요약만 저장하고 `ai_ready=false`, `requires_review=true`를 유지합니다.
별도 OECD cloud worker가 같은 03:00 KST Scrapling workflow에서 실행되고, 일반 Scrapling
목록에서는 OECD를 빼 중복 호출을 막습니다.

## OECD 승인 게이트 불일치 (과거 로그)

2026-11-11 예약 실행과 같은 날 수동 실행에서 Scrapling worker는 OECD를
`source_not_active_or_terms_not_reviewed`로 보류했습니다. 실행 코드는
`collector_source_allowed` RPC 결과가 정확히 `true`가 아니면 adapter에 진입하지
않습니다. 그래서 WebCMS/RSS 대체 경로 자체가 실행되지 않았습니다.

현재 live DB 조회에서는 OECD 출처가 `is_active=true`, `terms_reviewed_at`이
2026-10-19로 남아 있고, DB에서 같은 `collector_source_allowed(uuid)` 함수를 직접
호출한 결과도 `true`입니다. 반면 당시 worker의 PostgREST RPC 응답은 `false`였습니다.
출처 승인이 없는 상태가 아니라 **실행환경의 RPC 결과와 현재 DB 행/함수 결과가 서로
다른 상태**입니다. 기존 로그에는 요청 본문이 기록되지 않아, 그 차이가 실제 RPC 입력,
API 응답 경로, 또는 실행 시점 상태 중 무엇인지는 확정할 수 없습니다.

Worker는 이제 RPC가 `false`일 때만 `sources`에서 동일 ID의 세 필드
(`id`, `is_active`, `terms_reviewed_at`)를 service-role로 다시 읽습니다. 같은 행이
활성이고 검토일이 있으면 그 두 값으로 승인 조건을 재확인하고, 결과에 RPC/행 판정
불일치를 남긴 뒤 OECD 대체 adapter로 진행합니다. 행을 찾지 못하거나 두 조건이
충족되지 않으면 계속 보류합니다. 행 읽기 오류도 보류/실패로 남겨 묵시적으로
허용하지 않습니다. `ingest_source_item`은 저장 시점에도 출처가 활성인지 DB에서 확인하고,
수집 worker는 저장 용량 검사를 유지합니다.

## 병합 후 운영 확인

PR을 병합한 뒤 첫 예약 실행에서 확인할 항목:

1. GitHub Actions `Daily Crawlee source collectors` 실행이 생성됐는지 확인합니다.
2. 실행 요약에서 27개 목록, 출처별 승인 보류, 수집·저장 결과를 분리해 봅니다.
3. OECD Scrapling 실행 요약에서 `source_gate_fallback`과 RPC/행 판정이 일치하는지
   확인한 뒤, 실제 OECD WebCMS/RSS 후보와 저장 결과를 확인합니다.
4. `workflow_dispatch`로 시작한 읽기 전용 probe를 예약 수집 실적으로 집계하지 않습니다.
