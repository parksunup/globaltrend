# 담당자 작업실 사용 안내

2026-10-23 개편 기준입니다. 아래 내용은 과거 PR 제출·항목별 피드백 안내보다 우선합니다.

## 담당자가 하는 일

1. 동향은 `/team?role=trends`, 법제는 `/team?role=legal`을 엽니다. 동향 DB 초안은 기존 사이트 팀 계정으로 로그인해 읽습니다.
2. 자료를 읽고 고칠 점을 메모합니다. 항목마다 의견을 따로 등록할 필요는 없습니다.
3. 화면의 **Codex에 수정 요청하는 방법 · 예시 프롬프트**를 펼치고 **Codex 연결 프롬프트 복사**를 누릅니다.
4. 본인의 Codex에 붙여 넣고 마지막에 원하는 수정 내용을 적습니다.
5. Codex가 저장을 마치면 같은 화면에서 다시 확인합니다. 화면은 2분마다 확인하며 **지금 새로 확인** 버튼도 있습니다.

DB 동향 원고는 작업실 안에 수정본으로 저장합니다. 법제·GitHub 조사 자료는 기존 담당 브랜치에 commit/push합니다. 동향은 `feat/trend-source-contracts`, 법제는 `feat/legal-corpus-foundation`을 유지합니다. 대화만 하거나 로컬 파일만 고치면 화면에는 반영되지 않습니다. 자료 수정마다 PR 병합·재배포할 필요는 없습니다.

## 화면 구성

- 동향: DB 한국어 원고 전체와 새 GitHub 조사 자료를 공식 URL로 중복 제거합니다. 검색으로 제목·국가·출처를 찾고 본문을 읽습니다. 21건·79건을 고정 상한으로 사용하지 않습니다.
- 법제: **17개 기준 비교표 / 법률별 전체 번역** 두 메뉴를 사용합니다. 새 법률 JSON도 자동 발견합니다. 제출 자료 목록과 필수 항목별 피드백은 없습니다.
- 이미 제출된 법제 본문은 미발행·공개 보류 기록만으로 숨기지 않습니다. 누락 조문·파일 오류·이용조건 확인 메모는 보존합니다.
- DB 연결 실패 시 **일부 자료**라고 표시합니다. GitHub 표본만 읽었는데 전체 원고를 확인했다고 보고하지 않습니다.

기존 의견 데이터는 삭제하지 않습니다. 필요하면 기존 `/api/feedback?branch=...`에서 읽을 수 있습니다.

## 계정과 Codex 연결

필요한 것은 사이트 팀 계정과 기존 GitHub 담당 브랜치 저장 권한입니다. Supabase 관리자 키와 Vercel 팀 초대는 필요하지 않습니다.

동향 프롬프트를 복사하면 로그인한 팀원에게 **작업실 연결키**를 발급합니다. 키는 별도 만료 없이 유지되며, 같은 계정에서 새 키를 발급하거나 화면의 **Codex 연결 해제**를 누르면 이전 키가 즉시 무효화됩니다. Codex는 이 키로 원고를 읽고 비공개 작업실 수정본만 저장합니다. 운영 원고 변경, 발행, 삭제, 회원 관리 권한은 없습니다. 키를 공개 GitHub·PR·파일·로그에 올리지 말고, 계정 비밀번호도 Codex에게 보내지 않습니다.

연결키는 공개 GitHub·PR·로그에 저장하지 않습니다. Codex가 임시 환경변수로 사용하고 작업 후 해제하도록 화면 프롬프트에 지시합니다. 미발행 DB 원고도 공개 GitHub에 커밋하지 않습니다.

로그인·키가 없으면 401, 잘못되거나 만료된 키·비활성 팀 권한은 403, 다른 수정과 충돌하면 409로 알립니다. 401/403을 Supabase 관리자 권한이 필요하다는 뜻으로 해석하지 않습니다.

## Codex용 연결·수정 계약

화면 프롬프트에 실제 사이트 주소와 담당 브랜치가 들어갑니다. 공통 도구가 담당 브랜치에 없으면 main 또는 `codex/live-team-workspace`에서 필요한 도구·설명만 가져옵니다. 조사 자료를 덮어쓰지 않습니다.

- GET `/api/team-workspace?role=trends`: 팀 쿠키 또는 `Authorization: Bearer <연결키>`가 필요합니다.
- GET `/api/team-workspace?role=legal`: 이미 공개 저장소에 제출한 법제 자료를 읽습니다.
- PUT `/api/team-workspace?role=trends`: 팀 쿠키(동일 출처 요청) 또는 연결키로 작업실 수정본을 저장합니다.
- POST `/api/team-workspace/connect`: 로그인한 팀원만 키를 발급·해제합니다. 쿠키·동일 출처를 검사하며 키 자체로 다른 키를 발급할 수 없습니다.

조회 JSON의 `trends`는 원고, `documents.legal`은 비교 셀, `translations`는 번역 전문, `translationErrors`는 파일 오류입니다. `databaseAvailable=false`이면 DB 전체 조회가 완료되지 않은 것입니다.

동향 DB 원고 작업 명령:

```sh
node scripts/team-workspace.mjs pull --url https://실제-작업실-주소 --role trends --token-env TEAM_WORKSPACE_TOKEN
node scripts/team-workspace.mjs prepare 실제-원고-UUID
node scripts/team-workspace.mjs validate
node scripts/team-workspace.mjs save --url https://실제-작업실-주소 --token-env TEAM_WORKSPACE_TOKEN
```

담당자가 직접 터미널을 조작하는 것이 아니라 Codex가 실행합니다. `.team-workspace/`는 Git에서 제외됩니다. prepare는 기존 수정 파일을 덮어쓰지 않습니다. prepare한 파일의 형태는 다음과 같습니다.

```json
{
  "edit": {
    "report_id": "API의 id",
    "base_revision": "API의 revision",
    "title_ko": "수정할 제목",
    "summary_ko": "수정할 요약",
    "details_ko": "수정할 본문"
  },
  "expected_revision": 0
}
```

`expected_revision`은 API의 `workspace_revision`을 그대로 사용합니다. PUT 요청은 위 객체들을 `{"edits":[...]}`로 감쌉니다. 한 번에 1~100건, 요청 본문 2MB 이내입니다. 전체 입력을 한 트랜잭션으로 저장하므로 충돌 시 일부만 덮어쓰지 않습니다.

수정본은 DB 비공개 `team_workspace_private.trend_edits`에 저장합니다. DB 기준 원고 revision이 같을 때만 합쳐 보여줍니다. 기준 원고가 변경되면 `editState=conflict`와 `proposedEdit`로 두 내용을 보존합니다. Codex는 최신 원고와 제안을 대조해 재적용해야 하며 번호만 바꾸면 안 됩니다. 다른 담당자가 수정본을 먼저 저장한 경우도 `expected_revision` 검사로 덮어쓰기를 막습니다.

save 명령은 저장 후 API를 다시 읽어 수정 문장과 workspace_revision까지 확인합니다. 작업실 수정은 자동 발행이 아닙니다. 관리자는 최종 원고에 반영한 내용을 확인하고 별도로 발행합니다.

GitHub에만 있는 새 동향 자료는 기존 `data/trends/editorial/report-drafts.json`과 대응 조사 자료를 편집하고 `node scripts/trend-report.mjs --render`로 완성본을 갱신합니다. 법제는 `data/legal/criteria-mapping.csv` 및 대응 Markdown, `data/legal/translations/<법률ID>.json` 및 대응 Markdown을 수정합니다. 번역 전 용어집, 동향 작성 전 문체 지침을 읽고 `npm run validate:data`를 실행합니다.

## 운영과 실패 표시

2026-10-23 두 migration으로 팀 인증 조회와 제한된 작업실 수정 저장을 운영 DB에 적용했습니다. 비로그인 거부, 유효 키 접근, 키 해제, 수정 저장 후 재조회, 오래된 수정 거부, 운영 reports 불변을 트랜잭션 안에서 검증하고 시험 변경은 롤백했습니다.

원문 수집 데이터·담당자 신원·관리자 키는 이 API에서 반환하지 않습니다. 연결키 테이블과 수정본 테이블은 비공개 스키마/RLS/테이블 권한 회수로 보호하고 제한된 함수만 사용합니다. 키는 해시로 저장합니다. 응답은 private/no-store이며 쿠키·연결키에 따라 분리합니다.

GitHub 자료는 하나의 실제 커밋에서 읽습니다. DB 원고·수정본 변화도 ETag에 포함하므로 GitHub 커밋이 같아도 갱신됩니다. DB 원고는 마지막 페이지까지 읽습니다. 브라우저가 로그인 만료를 확인하면 기존 초안 내용을 치웁니다.

GitHub 읽기는 Next Data Cache를 공유하고 선택적 서버 전용 `TEAM_GITHUB_READ_TOKEN`으로 읽기 한도를 높일 수 있습니다. 유료 생성 API는 추가하지 않습니다. 네트워크·GitHub 한도·DB 장애까지 없어지는 것은 아니므로 오류와 마지막 성공본 여부를 표시합니다. 파일 한도는 350개, 파일당 8MiB, 합계 24MiB이며 초과하면 누락 대신 오류를 알립니다.

작업용 첫 화면은 `/team`으로 이동하며 `SITE_ENTRY=public`의 공개 첫 화면은 유지합니다. `/public`과 `/work` 발행 권한은 별개입니다. 이 기능을 처음 도입하는 코드 배포는 한 번 필요하고, 예전 고정 배포 주소의 코드는 자동 변경되지 않습니다.
