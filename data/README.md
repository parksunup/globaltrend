# 팀 조사 자료

이 폴더에는 법제 담당과 동향 담당의 조사 결과를 저장합니다.

- 법제 담당은 `data/legal/`의 빈 양식을 복사해 작성합니다.
- 동향 담당은 `data/trends/`의 빈 양식을 복사해 작성합니다.
- 모르는 내용은 추정하지 않고 `검토 필요`로 적습니다.
- 실제 원문 전문, 비밀값과 공개 허가가 확인되지 않은 번역문은 넣지 않습니다.
- 작업을 제출하기 전에 `pnpm validate:data`를 실행합니다.

리드의 양식 작업이 `main`에 반영된 뒤 법제 담당은 `feat/legal-corpus-foundation`, 동향 담당은 `feat/trend-source-contracts` 브랜치를 최신 `main`에서 만듭니다.
