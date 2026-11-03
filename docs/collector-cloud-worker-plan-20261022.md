# 클라우드 연결 워커 구현·검증 계획

기준/승인: `collector-handoff-20261022.md` 전체와 2026-10-22 사용자 실행 지시.
기존 #39·#40·#41 위의 새 브랜치에서 수행하며 main 병합·발행은 금지합니다.

## 설계

Supabase가 기존 큐·출처별 배정·임대·재시도·진행 위치를 소유합니다.
OECD·FTC만 연결 도구를 쓰는 cloud-python 실행부에 배정하고 다른 7개는 Edge를 유지합니다.
기존 Edge 상태와 Python 상태는 별도로 보존합니다. 전환 시 유효한 기존 임대가 있으면 거절합니다.
Python은 기존 robots-aware fetch와 파서를 사용해 한 문서 분량의 제출 묶음을 준비합니다.
연결 도구는 제한된 commit RPC를 호출하며 원문 저장·커서·이벤트·다음 큐를 원자적으로 반영합니다.
최종 RPC 실패 시 묶음은 미저장이고 커서도 전진하지 않습니다. 미확인 범위는 완료로 처리하지 않습니다.
CNIL 상태·재시도·backlog는 변경하지 않습니다.

## 실행 순서

- [x] 고정 판본·지침·현재 DB 권한/정책/용량 조회. Python 기존 88개 검사 통과.
- [x] 실제 선점·한국어 작성·인용/문체 검사·제출. report `0fa4fd77-7091-4430-9fdf-cc2cf3e6d3f0`.
- [x] 새 준비 묶음 테스트 RED→GREEN. 기존 core collect와 파서 재사용, 결과 추정 수치는 제거.
- [x] additive migration: 출처 배정, 원자적 cloud take/commit, 배정된 출처를 Edge take에서 제외.
- [x] DB rollback 검사: 동시 선점·만료/구임대·잘못된 cursor·중복 commit·실패 후 커서·범위 보존.
- [x] OECD/FTC 수동 실수집 commit, 출처별 결과/HTTP 오류 보존. 두 건 모두 duplicate, offset 1.
- [ ] 실제 미래 예약 2회 등록. 같은 지침으로 DB 재개, 이미 제출한 작업 제외.
- [ ] 예약 이력의 실제 시각/ID와 DB 수집·초안 ID 대조. 미래 실행은 관찰 전 미완료로 보고.

## 검토할 실패 조건

- 임대 만료 후의 저장·커서 전진 거절.
- 재배달/재호출에도 기존 ingest 멱등성과 작업 판본 유지.
- 날짜 미상·목록 전체성 미확인·HTTP 실패는 범위 완료로 변경하지 않음.
- Python과 Edge의 서로 다른 커서를 혼용하지 않음.
- 연결 도구 권한과 터미널 자격 증명 유무를 구분. 비밀 출력 금지.

## 진행 기록

전체 턴 시작 시각은 사전에 별도로 기록하지 않았습니다. 최초 DB snapshot 시각은 2026-10-22 05:02:42 KST입니다.
초안 제출: 05:05:31 KST. 인용 10개 전체 일치, node 검사 exit 0.
CNIL의 EDPB 번역 후보는 기존 보고서와 같은 사건으로 fail RPC에 사유 기록 후 미제출.
실제 무료 전송/실행 잔량의 최신 계량은 아직 확보하지 않았습니다. 모든 환경 gate를 일괄 true로 설정하지 않습니다.

## 독립 리뷰와 수정

독립 리뷰의 Important 4건(기존 backlog 소비 누락·실패 문서에 의한 정체·cursor 타입 무검증·transaction-stable now 만료 검사)을 수정했습니다.
Python RED→GREEN 2개 추가, 전체 93개 통과. DB malformed cursor가 기존 구현에서 수락되는 실패를 재현한 후 수정했습니다.
clock_timestamp 기반 만료 확인, null 임대 거절, 기존 backlog 직접 재시도, 상세 실패 원자적 backlog 보존 및 다음 offset 전진을 SQL rollback으로 검증했습니다.
앱 137개·typecheck·validate:data 통과. 최초 npm ci는 package-lock 부재로 실패했고 저장소 pnpm-lock으로 설치 후 앱 검사가 통과했습니다.
배포 migration 실제 버전: 20261021201141, 20261021202112. Edge 코드 재배포·기존 control git_sha 변경은 하지 않았습니다.
터미널 git push는 `fatal: could not read Username for 'https://github.com': No such device or address`로 실패했습니다.
기존 GitHub 연결 도구로 별도 작업 브랜치를 생성했으며 파일을 같은 내용으로 반영합니다. 기존 PR 브랜치는 변경하지 않습니다.
