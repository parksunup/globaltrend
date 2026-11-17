# 법제 담당 첫 작업

1. `instruments.template.md`를 `instruments.md`로 복사합니다.
2. `instruments.template.csv`를 `instruments.csv`로 복사합니다.
3. `review-notes.template.md`를 `review-notes.md`로 복사합니다.
4. 7개 법제의 공식 원문, 판본·시행일, 기존 한국어 번역과 이용조건을 확인합니다.
5. 확인하지 못한 값은 만들지 말고 `검토 필요` 또는 `unreviewed`로 둡니다.
6. `pnpm validate:data`를 실행한 뒤 PR을 만듭니다.

앱, Supabase, 인증과 환경변수는 수정하지 않습니다.

## 2026-11-17 법령 변경 후속 점검

[7개 법률의 확인 결과·번역 및 비교표 수정 범위·남은 쟁점](./amendment-review-20261117.md)을 확인합니다. 공식 원문 재확보·구조 대조와 사람 의미·법률 검수는 구분합니다.

2026-11-17 2차 보완: 중국 NPC DB 공식 Word 첨부 본문 74조를 확보·대조했습니다. [조문별 대조 기록](./sources/pipl-attachment-check-20261117.json). 한국 현행 원문과 캘리포니아 주 의회 법전의 직접 대조 장애는 남아 있습니다.

2026-11-17 한국 재대조: GitHub 읽기 진단에서 현행·선정 본문을 확보했고, 본칙 127개·부칙 13묶음의 해시가 일치했습니다. 이전 추가·상이 규정 9개는 판본 대조 참고와 전체 보존본에 남겼습니다. 현재 적용 조문으로 확인하지 않았습니다. [판본 조정 근거](./sources/pipa-edition-reconciliation-20261117.json).
