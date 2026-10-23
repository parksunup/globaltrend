# 2026-10-23 수집·작성 운영 문제와 해결 상태

사용자 목표는 9개 승인 출처의 일일 증분 수집, 적격 원문의 한국어 작성과 기존 /work 제출, 월요일 주간 집계다. 플랫폼 실행의 completed는 업무 전체 완료와 다르다. main 병합·자동 승인·발행은 수행하지 않는다.

## 확인한 원인과 조치

| 문제 | 확인 근거 | 해결 및 완료 조건 | 현재 변경 |
|---|---|---|---|
| FTC가 같은 자료를 반복 | core.collect는 목록 전체(제목 포함)의 hash가 달라지면 offset=0에서 재개. 운영에서 offset/fingerprint 조합 순환과 무변경 중복 커밋 관찰 | 한 목록 탐색이 끝날 때까지 처리한 URL hash를 cursor에 유지. 목록 제목·순서 변경 후에도 새 URL만 처리하고, 실패 URL은 backlog 원자 보존 후 기억. | 코드 수정·회귀검사. 기존 DB cursor validator가 새 필드를 허용하는 읽기 전용 검사 통과. 실제 새 예약 검증은 별도. |
| OECD가 본문 누락으로 반복 실패 | 실패 URL의 실제 HTML에는 Introduction이 있고 Abstract가 없음. 기존 추출기는 Abstract만 지원 | 확인한 Introduction 컨테이너만 official_overview 범위로 추출. requires_review=true를 유지하고 전문 열람으로 표시하지 않음 | 실제 HTML에서 575자 소개·2025-04-09 날짜 추출. 해당 자료는 2026 수집 기간 밖이며 개인정보 관련성도 별도 판정 필요. |
| 다섯 Edge 출처의 경고가 실제 누락처럼 보고됨 | runtime.advance는 목록 끝에서 무조건 listing_exhaustiveness_unverified를 기록함 | 목록 탐색 종료와 기간 전체 입증을 별도 기록. 기간 전체 완료는 출처별 목록/날짜/관련문서 입증 후에만 인정 | listing_scan_complete, unresolved_date_count, coverage_blockers 추가. coverage_complete=false 유지. Edge 운영 배포 여부는 별도. |
| ICO 13페이지 빈 응답 | 공식 API가 totalResults=421, totalPages=17, showingPageNumber=13, hasMore=true를 반환하면서 results=[] | 잘못된 성공/종료로 바꾸지 않음. 실제 응답을 실패 근거로 보존하고 기존 backoff 적용. 같은 승인 호스트의 목록/API 구조를 추가 확인해 수집 경로 수정 후 누락 페이지 재처리 | 원인 응답 확인. 서버 불일치/목록 응답 문제는 미해결. page14로 건너뛰지 않음. |
| CNIL이 2024년 자료까지 내려감 | 범위 since=2026-09-21인데 목록 15페이지의 2024년 상세를 계속 읽음 | 목록 날짜를 추출하고 출처의 정렬·고정글 정책을 확인한 뒤 기간 종료 조건 구현. 오래된 기사 하나만 보고 종료하지 않으며 미완료 기록 보존 | 미해결. 과거 자료 접근을 최근 주간 성과로 세지 않음. |
| PDPC 반복 실패와 날짜 미확정 | 미해결 backlog 13개(재시도 가능 4개), state.unknown_dates=159. PPC=13, DPC=23도 날짜 미확정 누적 | URL별 실패 본문·첨부 형식·날짜 의미를 대조해 parser/첨부 추출 보완. 날짜를 임의 확정하거나 ai_ready를 강제로 true로 하지 않음 | 미해결. 총 건수는 고유 기사 수가 아니라 누적 상태 카운터일 수 있어 별도 대조 필요. |
| 기존 적격 초안이 수집 반복 뒤로 밀림 | producer 지침이 OECD/FTC 수집을 먼저 반복하고 그 뒤 초안 처리. 오늘 제출 0건 | 시작 시 대기 자료부터 적격성 검토, 이후 수집 성공 체크포인트와 작성 교대. 실제 job/revision/hash/임대와 제출 검증 필요 | daily-task 순서 수정. CURIA 신규 2건 원문은 에너지 과세·변호인 조력권 사건으로 개인정보 동향 대상에서 제외. 보류 gate를 해제하지 않음. |
| 전체 9개 성과 대신 두 출처·마지막 경고만 보고 | Edge 예약 5개 출처의 실제 detail/new/duplicate 기록이 보고에서 빠짐. CNIL 수동 검증과 예약을 혼동할 여지 | 매 실행 9개 출처별 기간/예약·수동/신규·변경·중복·기간 밖·실패/초안·남은 범위를 집계. latest 이벤트 한 건으로 일일 성과를 대체하지 않음 | daily-task 및 예약 prompt를 동일 검증 커밋에 맞춰 갱신할 대상. |

## 실제 예약 확인

- 일일 예약 `6ad98d4661fc81919685912eaf0faf92`는 활성. 실행 `30002b05-9b40-8321-b1fa-190e0e15a802`는 2026-10-23 05:25:22~05:43:41 KST에 플랫폼 completed로 기록됨. 한국어 초안 제출 0건은 별도 성과다.
- 월요일 집계 `6ad91f62e1748191a4b123c85c0a7ddf`는 2026-10-26 08:00 KST부터 주간 예약. 새 주기의 실제 월요일 실행은 아직 미래이며 검증 완료라고 하지 않는다.
- 조사 시작 시 PR #42 head는 1ba4ac33f1267ca9d3fe0cf4c6c237cca2831786였으나 원격 재확인에서 #42의 main 병합(e63de6aa843cff01f237b262c746be999bb43e88)을 확인했다. 이 세션은 main을 병합하지 않았고, 수정은 현재 main 위의 별도 후속 브랜치에서 보존한다.

## 검증과 적용 범위

수정 전 FTC 제목 변경 시 첫 URL 재처리와 Edge 탐색종료 필드 누락을 재현했다. 수정 후 Python collector 95개, Deno adapter/runtime 17개 검사를 통과했다. Deno 테스트는 PDF 텍스트 추출만 검증하며 canvas/Path2D 경고를 렌더링 성공으로 해석하지 않는다. 자료 검사는 21건 통과했다. 저장소 코드 검사, 수동 실행, 실제 예약 실행, 다음 예약 재개를 구분해 기록한다.

Edge 계층의 전체 기간 완료 입증·ICO 응답 불일치·CNIL 기간 종료·미확정 날짜/첨부 보완과 새 판본의 미래 예약 검증이 남아 있다. 이 문서는 전체 자동 운영 완료를 선언하지 않는다.

## 이번 수동 검증 결과

- Python 95개·Deno 17개·앱 137개, typecheck, validate:data, 예약 비활성 차단 검사, diff 검사 통과. 초기 앱 검사 실패는 임시 검증 환경의 React/TypeScript 타입 의존성 누락을 설치한 뒤 해소됐으며 저장소 의존성을 변경하지 않았다.
- OECD 주 수집 1건을 기존 RPC로 실행하고 중복·날짜 미확정 상태를 보존했다. event `8bf7017c-a36c-438f-8b35-c9607d7c639b`.
- OECD backlog `047d3601-e194-4d61-bb7e-9a6bfe16148c`를 실제 선점/HTTP 읽기/수정 parser/commit으로 처리했다. 확인한 날짜 2025-04-09는 backlog 기간 2026-10-16~22 밖이었다. event `df0d3916-7fd6-45d3-ac0b-35450113921d`, `backlog_out_of_range`, retry_after_seconds=-1, DB 재조회 resolved=true. 실패를 삭제하거나 완료 gate를 임의 변경하지 않았다.
- FTC msg 2242를 수정 코드로 실행하고 event `80543ee3-f384-4669-8e5a-95855be4166f`에 commit했다. 기간 밖 1건이며 새 cursor에 처리 URL hash를 보존했다. 목록 전체 완주/다음 예약 재개는 이 한 단계로 검증됐다고 하지 않는다.
- 세 실행의 trigger는 manual-remediation이며 예약 run ID를 붙이지 않았다. 실행 당시 로컬 코드 판본 73e33b3b84440133b0f4415ddf8e1af6868a71ed는 후속 원격 코드와 같은 수정 파일을 가진다. 추가 보고 문서는 원격 후속 PR에 포함한다.
