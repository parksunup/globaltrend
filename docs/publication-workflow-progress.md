# 발행 절차 간소화 진행 기록

2026-10-19 05:07 KST 자동 재개됨. active goal을 유지합니다.

- 작업 폴더: globaltrend-public-recovery
- 브랜치: codex/simple-publication-workspace. PR35 head 5e4fa9f에서 분기. PR35는 open이며 보존합니다.
- 계획: docs/publication-workflow-redesign.md 기준. 동향/법제 목록 통합, 공개본 유지하는 수정본 저장, 일괄 공개, 공개 취소, 휴지통/복구, 권한·동시성·감사 보호.
- root: workspace server data/actions, 법제 편집기, 작업 공간 경로 정리, 통합 검증·PR.
- integration_review: publication_workspace_lifecycle forward SQL 및 DB 테스트.
- publication_workflow_plan: workspace.tsx/module.css, workspace-model.ts, UI 회귀테스트.
- 기존 DB의 21동향/7법제/119셀을 변경하지 않습니다. 별도 collector-operational-readiness 미완성 변경도 보존합니다.
- 완료 판정은 실제 RPC 권한/동시성/보존/취소/복구 테스트와 Preview화면 검증, 리뷰가능 PR 생성 후에 합니다.

## 구현 및 현재 검증

- 통합 목록, 검색·상태·종류 필터, 20건 페이지·검색결과 전체 선택, 100건 자동분할 구현.
- 작업본 저장/수정 전후 비교/일괄공개/공개취소/휴지통/복구 및 법제 조문·17개 요약 편집 구현.
- 선택 revision 고정, 충돌선택해제, 중복법률판본 전체청크 사전검사, 실패항목재시도, 입력보존 구현.
- 새 작성/법제 등록/수집상태를 별도 경로로 정리. 기존 /work/legal은 법제필터로 이동.
- 운영 DB에 lifecycle, private RPC boundary, 빈 본문 방지 forward migration을 적용했습니다. 기존 21동향·7법제·119셀 유지, workingcopy29건, 익명working조회 및 직접수정 불가 확인.
- PGlite 실제자료 fullreplay로 저장시공개본보존, 발행원자성, stale/중복방지, 취소→휴지통→복원→재공개, 법제노드ID·내부감사보존 검증 통과.
- 초기 Node 테스트115개·타입·데이터 전수 검사·빌드 및 GitHub CI(verify/database/collector) 통과. PR36 생성·연결 완료.
- 완료 감사에서 새 제출 자료의 등록+공개 단일 동작과 전체21건후보, 법제편집 입력보존, 밝은/어두운 테마를 보강했습니다. 최종 검증 결과는 PR36 설명에 기록합니다.
- 운영 PostgreSQL에서 동향과 법제 각각 전체 lifecycle을 트랜잭션 안에서 실행하고 ROLLBACK하여 기존 공개 내용·건수와 법제 조문ID를 보존하는지 확인했습니다.
- Preview 실제 버튼으로 종류필터, 검색, 휴지통 빈 상태, 페이지 이동, 상세·수정 탭, 미리보기 저장차단을 확인했습니다. 모바일390px에서 가로넘침 없음 확인.

## 완료 판정 근거

- PR36: https://github.com/parksunup/globaltrend/pull/36 (PR35 후속, 부모 변경 보존).
- 화면: 통합 목록, 새 제출물 등록+공개, 수정 전후 비교, 공개 취소·휴지통·복원, 밝은/어두운 테마.
- 선택/오류: 저장 전후 판본 보존, 100건 청크, 전 범위 동일 법률 중복 검사, 실패만 재시도, 동시 수정 거절, 새작성·법제 편집 입력 보존.
- 자료 보존: 운영 SQL 트랜잭션 rollback 검증 후 21/7/119 및 working revision 모두1 유지. 검수자·검수일은 공개하지 않음.
- 테스트: Node137개 및 새pgTAP46개 포함. 실제 PostgreSQL 전체 migration/review자료 재생 및 lifecycle 확인.
- 배포 검증: PR Preview 실제 필터·검색·페이지·상세·저장차단 버튼, 모바일 가로넘침 확인. 최신 CI·배포 결과와 최종 Preview는 PR36 본문을 기준으로 확인합니다.
- 주간호 구성·발행 편집기는 기획안3차 과제로 남습니다. 이번 goal은 자료의 개별/일괄 공개 절차와 작업 공간 개선입니다. 수집기 환경·스케줄은 변경하지 않았습니다.
