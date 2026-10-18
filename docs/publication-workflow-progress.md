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
- 운영 DB에 lifecycle 및 private RPC boundary forward migration을 적용했습니다. 기존 21동향·7법제·119셀 유지, workingcopy29건, 익명working조회 및 직접수정 불가 확인.
- PGlite 실제자료 fullreplay로 저장시공개본보존, 발행원자성, stale/중복방지, 취소→휴지통→복원→재공개, 법제노드ID·내부감사보존 검증 통과.
- Node 테스트115개·타입·데이터 전수 검사 통과. 최종빌드·Preview 버튼검증 및 GitHub공식DB CI·PR 생성이 남았습니다.
