# 동향 담당 첫 작업

1. `source-configs/source.template.md`와 `source.template.json`을 출처별 이름으로 복사합니다.
2. 첫 파일명은 `edpb`, `oecd`, `curia`를 사용합니다.
3. `review-notes.template.md`를 `review-notes.md`로 복사합니다.
4. 공식 페이지에서 자료 유형, 수집 방법, 제목·게시일·본문 위치와 제외 대상을 확인합니다.
5. 확인하지 못한 값은 `검토 필요` 또는 `unreviewed`로 둡니다.
6. `pnpm validate:data`를 실행한 뒤 PR을 만듭니다.

앱, Supabase, 인증과 환경변수는 수정하지 않습니다.
