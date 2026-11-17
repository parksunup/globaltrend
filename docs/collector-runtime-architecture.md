# 공식 동향 출처 수집 실행 구조

## 실행 위치

국제요정의 기존 수집 계약을 유지합니다. Supabase에는 출처 승인 상태, 다음 수집 시각, 작업 대기열과 커서가 남습니다. Supabase Cron은 기존 `trend-cloud-python.yml`을 GitHub Actions에 요청하고, Actions 작업자가 Python과 Crawlee를 실행해 공식 페이지/API/RSS를 읽습니다. 작업자는 수집 결과를 기존 `collector_cloud_take` / `collector_cloud_commit` 계약으로 저장합니다. 이 결과가 기존 `source_items` 및 `draft_jobs` 흐름에 연결됩니다.

Supabase Edge Function만으로 실행하지 않는 이유는 이번 요청 중 IMDA 경로가 Crawlee 기반 Python 수집을 요구하기 때문입니다. Edge Function은 Deno 런타임이라 이 저장소의 Python/Crawlee 실행기를 그대로 돌릴 수 없습니다. RSS와 JSON API만 Edge에서 별도로 구현하면 같은 출처·날짜·본문 판정과 저장 로직을 두 군데 관리하게 됩니다. 따라서 기존 Supabase 스케줄과 상태 관리는 유지하고, 실제 HTTP 수집·파싱은 GitHub Actions의 기존 Crawlee 작업자 한 곳으로 모읍니다.

이 구성은 사용자 PC와 Codex 크레딧을 수집 실행에 사용하지 않습니다. 기존 Supabase Cron과 GitHub Actions 실행 환경을 사용하며, 신규 유료 API나 별도 수집 서비스를 추가하지 않습니다.

## 출처별 흐름

- **싱가포르 IMDA**: PDPC와 별도로 공식 IMDA 보도자료 목록을 매일 확인합니다. PDPC 수집 장애가 발생할 때까지 기다리는 단일 장애 연동 대신 독립 수집을 계속해 대체 경로에서 놓치는 자료를 줄입니다. Crawlee는 허용된 목록·상세 경로만 요청합니다. 목록 요약만 확인되거나 게시일이 없으면 자동 초안 대상에 넣지 않습니다.
- **유럽연합 집행위원회 Press Corner**: 공식 RSS에서 항목을 찾은 뒤, 해당 항목의 Press Corner 문서 API에서 본문과 날짜를 확인합니다.
- **유럽연합 집행위원회 News**: 공식 RSS에서 항목을 찾은 뒤, 집행위원회 뉴스 상세 페이지에서 본문과 게시일을 확인합니다. RSS 게시일과 상세 페이지 날짜가 다르면 자동 작성 대상에서 보류합니다.
- **유럽의회**: Open Data API v2의 문서 Atom 피드를 읽고, 각 항목의 같은 API 문서 상세를 확인합니다. API에 전문이 없을 때만 그 레코드가 직접 연결한 공식 PDF를 읽습니다. 피드의 `updated` 시각은 게시일로 쓰지 않습니다.

## 자동 초안 안전 조건

기존 `source_items` 저장 경로를 유지합니다. 공식 출처에서 실질적인 본문과 확인 가능한 정확한 게시일을 얻은 경우에만 `ai_ready`를 참으로 설정해 기존 `draft_jobs` 대기열로 연결합니다. 요약만 있거나, 날짜가 없거나, 날짜 근거가 충돌하거나, 전문을 추출할 수 없는 레코드는 날짜를 만들어 채우지 않습니다. 유럽의회 API의 메타데이터 전용 레코드는 이 조건에 들지 않으면 자동 초안 요청으로 넘어가지 않습니다.

각 RSS/API는 최근 항목만 제공하는 회전형 피드입니다. 이 경로는 매일 변경분을 따라가는 수집이지, 과거 전체 자료를 빠짐없이 확보했다는 뜻은 아닙니다.
