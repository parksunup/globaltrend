# 신규 출처 클라우드 시험 — 2026-11-06

GitHub-hosted Ubuntu에서 실제 실행: https://github.com/parksunup/globaltrend/actions/runs/42135539213

시험 코드: `3a7a20c`. 시작 약 09:15 KST. 수동 `expansion-probe` 실행이며 예약 수집 증거가 아닙니다. DB 쓰기와 인증정보 전달 없이 공식 목록 및 첫 번째 상세 문서만 요청했습니다. 보류된 EDPS·EUR-Lex는 제외했습니다.

| 출처 | 결과 | 본문 문자 수/사유 |
|---|---|---|
| California Privacy | 표본 파싱 | 2,494 |
| OAIC | 표본 파싱 | 2,587 |
| Canada OPC | 표본 파싱 | 1,203 |
| CAC | 표본 파싱 | 884 |
| TC260 | 표본 파싱 | 274 |
| AEPD | 표본 파싱 | 3,743 |
| EC | 목록 실패 | ec_listing_document_type_unverified |
| EU Parliament | 요청 실패 | robots_fetch_failed:http_403 |

표본 파싱은 전문 완전성·관련성·최근 3일 전체 수집·한국어 초안 제출을 입증하지 않습니다. 특히 TC260의 짧은 본문과 연결자료는 별도 대조가 필요합니다. AEPD는 로컬과 클라우드 표본 길이가 달라 원문 및 목록 변동을 확인해야 합니다.

기존 Python 회귀검사 165개가 로컬과 클라우드에서 통과했습니다. Windows 실행에 필요한 tzdata 의존성과 UTF-8 설정을 보완했습니다.

수동 워크플로 `trend-collector.yml`을 활성화했습니다. schedule 트리거는 추가하지 않았습니다. 기존 GitHub secret 이름 `COLLECTOR_SUPABASE_URL`, `COLLECTOR_SUPABASE_SECRET_KEY`의 존재만 확인했고 값과 현재 유효성은 확인하지 않았습니다.

## 후속 구현

1. EC 응답의 미지원 refCode를 실제 확인하고, 출처별 문서 유형 계약을 수정·검증합니다.
2. 유럽의회 접근 실패를 기록하고 허용된 대체 공식 경로를 검증합니다.
3. Crawlee 요청 계층과 Trafilatura 본문 비교를 이 진단 경로에 연결합니다. 현재 진단은 기존 HttpClient와 파서 기준입니다.
4. 기존 take/commit 임대 계약을 호출하는 Python worker를 구현하고 중단/중복/응답유실을 시험합니다.
5. 출처별 담당 전환과 실제 03시 예약, 05시 작성·작업실 제출을 검증합니다. 현재 새 엔진 배포 완료 상태는 아닙니다.
