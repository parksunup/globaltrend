# PR 제출물 검수와 피드백

## 검수자가 보는 화면

GitHub PR의 Vercel 봇 댓글에서 **Preview**를 엽니다. 왼쪽 **PR 제출물**을 누르면 브랜치에 커밋된 결과가 나타납니다. 법제 브랜치는 17개 기준×7개 법제 비교표, 동향 브랜치는 목차와 기사 본문을 갖춘 주간 예시 호가 먼저 보입니다. 기존의 출처·번역 상태와 제출 파일 링크는 **제출 자료 목록**에서 볼 수 있습니다. 화면은 `.md`를 그대로 보여주는 대신 CSV·JSON 초안을 읽어 사람이 검수하기 쉬운 형태로 바꿉니다. 원문 파일과 공식 근거도 함께 대조해야 합니다.

비교표의 한 셀 또는 예시 호의 한 기사를 선택해 **이 항목에 의견 남기기**에 수정 의견·질문을 자연어로 적습니다. 의견에는 브랜치, 항목 ID, 작성 당시 커밋 SHA, 작성자와 시각이 기록됩니다. 브랜치가 업데이트돼도 지난 의견은 유지됩니다. 의견은 검수 승인·발행이 아니며, 누구나 열 수 있는 Preview 화면에서 익명으로 보이지 않습니다.

## 프로젝트 리드가 한 번 준비할 것

1. `supabase/migrations/*_submission_feedback.sql` 마이그레이션을 해당 Supabase 프로젝트에 적용하고, 팀원 권한·익명 쓰기 거부를 확인합니다. 새 테이블은 팀원에게 `SELECT`와 `INSERT`만 허용하며 수정·삭제는 허용하지 않습니다.
2. 담당자별로 **Supabase Auth 계정**을 준비하고 `public.team_memberships`에 본인 `auth.users.id`를 `reviewer`, `editor` 또는 `admin`으로 활성 등록합니다. GitHub Collaborator나 Vercel Collaborator 등록만으로는 피드백 권한이 생기지 않습니다. Preview 페이지의 이메일 로그인은 등록된 계정에만 링크를 보내며 자동 가입을 허용하지 않습니다.
3. Supabase **Authentication → URL Configuration → Redirect URLs**에 해당 Preview의 `https://<Preview 호스트>/auth/callback**`를 허용합니다. 여러 Preview를 운영하면 [Supabase 공식 안내](https://supabase.com/docs/guides/auth/redirect-urls)의 Vercel wildcard 규칙에 맞춰 범위를 제한해 등록합니다. 이메일 템플릿이 `redirectTo`를 사용하도록 설정돼 있는지도 확인합니다.
4. 각 담당자 브랜치에 이 검수 화면의 최신 `main`을 반영해야 그 브랜치 Preview에서 새 화면이 나타납니다. Preview가 운영 DB를 사용 중이라면 피드백도 그 DB에 기록됩니다. 비밀키를 웹 브라우저에 넣지 않습니다.

현재 팀 계정이 없는 담당자는 읽기만 할 수 있습니다. 팀원 계정을 추가하기 전까지 피드백 입력이 작동한다고 안내하지 마세요.

## Codex가 피드백을 모아 반영하는 방법

프로젝트 리드 또는 담당자의 Codex에서 연결된 **Supabase 플러그인**으로 아래 읽기 전용 SQL을 실행합니다. 이 결과는 팀 내부 피드백이므로 공개 PR 본문에 전문을 복사하지 않습니다.

```sql
select f.id, f.branch_name, f.item_id, f.commit_sha, f.body,
       f.created_at, f.author_id, p.display_name as author
from public.submission_feedback f
join public.profiles p on p.id = f.author_id
where f.branch_name = 'feat/legal-corpus-foundation'
order by f.created_at, f.id;
```

동향 담당은 조건을 `feat/trend-source-contracts`로 바꿉니다. `item_id`가 `criteria-`로 시작하면 비교표 한 셀, `weekly-`로 시작하면 예시 호의 한 기사입니다. 현재 버전은 피드백의 해결 여부를 DB에서 자동 추적하지 않으므로, 담당자는 수정 커밋과 처리 결과를 PR에 짧게 정리합니다.

Codex에 전달할 프롬프트 예시:

```text
내 작업 브랜치에 남겨진 submission_feedback을 Supabase에서 읽기 전용으로 조회하세요.
항목 ID와 작성 당시 커밋 SHA를 현재 제출 파일과 대조하고, 의견을
수정 필요 / 근거 추가 확인 / 답변만 필요로 분류해 주세요.
확인된 수정은 내 담당 data 폴더에만 반영하고, 원문 근거와 검증 결과를 적어 주세요.
피드백만으로 검수 완료·승인·공개 상태를 바꾸지 마세요.
처리하지 못한 의견과 이유도 PR에 남겨 주세요.
```

로그인에 실패하면 Auth 계정·팀 멤버십·Redirect URLs와 이메일 템플릿을 순서대로 확인합니다. 화면에 의견이 보이지 않으면 먼저 올바른 브랜치 Preview와 항목을 선택했는지 확인합니다.
