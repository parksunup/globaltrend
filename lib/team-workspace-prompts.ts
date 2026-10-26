export function teamWorkspacePrompt(role:'trends'|'legal',origin:string,connection?:{token:string}) {
  const branch=role==='legal'?'feat/legal-corpus-foundation':'feat/trend-source-contracts';
  const common=`저는 ${role==='legal'?'법제':'동향'} 담당입니다. GitHub 저장소는 https://github.com/parksunup/globaltrend 이고 배정된 브랜치는 ${branch}입니다. 새 브랜치를 만들지 마세요.
먼저 기존 작업을 보존하고 README.md, architecture.md, docs/team-onboarding.md, docs/live-team-workspace.md, docs/translation/glossary.md를 읽으세요. 필요한 공통 도구가 없으면 main 또는 codex/live-team-workspace에서 해당 도구·설명만 가져오고 제 조사 자료를 덮어쓰지 마세요.
작업실은 ${origin}/team?role=${role} 이며 자료 JSON은 ${origin}/api/team-workspace?role=${role} 입니다. 제 자연어 요청을 자료 전반에 적용하세요. Supabase 대시보드·관리자 키·Vercel 팀 권한은 필요하지 않습니다. 운영 reports 테이블에 직접 쓰거나 발행하지 마세요.
`;
  const task=role==='legal'?`법제 비교표는 data/legal/criteria-mapping.csv와 대응 Markdown, 전체 번역은 data/legal/translations/<법률ID>.json과 대응 Markdown을 수정하세요. 공식 원문·판본과 대조하고 조항 번호·원문 구조·조건·예외를 보존하세요. 17개 기준 비교표와 전체 번역을 각각 검토하고 미검토 부분을 완료 처리하지 마세요. 새 법률도 공통 JSON 형식으로 작성하면 발견됩니다. 미발행 기록만으로 이미 제출된 본문을 숨기지 마세요.
검사 후 기존 담당 브랜치에 commit/push하고 API의 commitSha가 push한 실제 커밋과 일치하는지 확인하세요.`:
`docs/trend-report-style.md도 먼저 읽으세요. ${connection?`Authorization: Bearer ${connection.token} 헤더로 작업실 API에 연결하세요. 이 키는 사용자가 새 키를 발급하거나 작업실에서 연결을 해제할 때까지 원고 열람과 비공개 작업실 수정본 저장만 허용합니다. 발행·삭제·관리자 기능은 허용하지 않습니다. 키를 파일·Git·PR·로그에 저장하거나 출력하지 말고, 임시 환경변수 TEAM_WORKSPACE_TOKEN으로 사용한 뒤 해제하세요.`:'화면에서 팀 로그인 후 Codex 연결 프롬프트를 복사해야 연결키를 받을 수 있습니다.'}
node scripts/team-workspace.mjs pull --url ${origin} --role trends --token-env TEAM_WORKSPACE_TOKEN 으로 전체 원고를 받으세요. trends 배열은 DB 초안·발행 원고와 새 GitHub 자료를 합친 목록입니다. 21건이나 79건으로 제한하지 마세요. databaseAvailable=false이거나 오류가 나면 전체를 읽었다고 하지 마세요.
DB 원고는 node scripts/team-workspace.mjs prepare <원고 UUID>로 .team-workspace/edits/ 아래 수정 파일을 준비하세요. edit 안의 report_id, base_revision은 유지하고 title_ko, summary_ko, details_ko를 수정합니다. expected_revision은 API의 workspace_revision입니다. .team-workspace/는 커밋하지 마세요. 원문과 제목·날짜·수치·조건·범위를 대조하세요.
node scripts/team-workspace.mjs validate 후 node scripts/team-workspace.mjs save --url ${origin} --token-env TEAM_WORKSPACE_TOKEN 으로 저장하세요. 여러 원고를 함께 수정할 수 있습니다. 저장은 비공개 작업실 수정본에만 적용되며 운영 원고를 덮어쓰거나 발행하지 않습니다. 409 충돌이면 최신 원고와 기존 제안을 비교하고 실제 수정 내용을 재적용하세요. revision 번호만 기계적으로 바꾸지 마세요.
GitHub에만 있는 새 조사 자료는 data/trends/editorial/report-drafts.json 및 대응 조사 자료를 수정하고 node scripts/trend-report.mjs --render를 실행한 뒤 기존 담당 브랜치에 commit/push하세요. DB 원고 수정은 공개 GitHub에 올리지 않습니다.
같은 API를 다시 읽어 수정한 모든 문장과 workspace_revision이 저장 결과와 일치하는지 확인하세요. GitHub 자료도 바꿨다면 commitSha를 확인하세요. 연결키가 해제되었거나 새 키로 교체되었다면 작업실 화면에서 다시 복사하세요.`;
  return `${common}${task}
관련 검사를 실행하고 GitHub 자료를 바꿨으면 npm run validate:data도 실행하세요. PR 병합·승인·대외 발행·배포는 하지 마세요. 브라우저 캐시 갱신에 몇 분 걸릴 수 있으므로 실제 화면/API 확인 전에는 반영 완료라고 하지 마세요. 작업실 링크, 수정한 범위, 확인 결과, 남은 쟁점을 쉬운 말로 보고해 주세요. 실제 GitHub 인증 오류나 팀 로그인·연결 해제 문제를 Supabase 관리자 권한 문제로 혼동하지 마세요.

이번 수정 요청: [화면을 읽고 발견한 문제를 여기에 자유롭게 적겠습니다.]`;
}
