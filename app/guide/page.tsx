const steps = [
  ["1", "GitHub 저장소를 컴퓨터로 가져오기", "본인 GitHub 계정으로 초대를 수락하고 GitHub Desktop에서 parksunup/globaltrend를 Clone합니다."],
  ["2", "문서 먼저 읽히기", "README.md와 architecture.md는 이 프로젝트가 무엇을 만드는지 설명합니다. 작업 전에 Codex에게 먼저 읽게 합니다."],
  ["3", "내 역할의 작업 시키기", "법제 담당은 법제 자료를, 동향 담당은 공식 출처 자료를 맡습니다. 아래 프롬프트를 복사해 사용합니다."],
  ["4", "결과를 확인하고 PR 만들기", "Codex의 결과를 확인하고, 공식 링크와 검토할 부분을 확인한 뒤 PR을 올립니다. main에는 직접 올리지 않습니다."],
];

const readFirst = `이 저장소의 README.md, architecture.md, docs/team-onboarding.md를 먼저 읽고\n프로젝트 목적, 공개 범위, 현재 구현 상태, 제 역할을 쉬운 말로 설명해 주세요.\n아직 파일은 수정하지 말고, 제가 이해한 내용이 맞는지 확인할 수 있게 요약해 주세요.`;
const legalPrompt = `법제 담당으로 작업합니다. README.md와 architecture.md를 먼저 읽으세요.\n한국 PIPA, 일본 APPI, 중국 PIPL, EU GDPR, UK GDPR, 미국 CCPA, 싱가포르 PDPA에 대해\n공식 법령명, 관할권, 공식 원문 URL, 현행 판본 또는 기준일, 확인 메모를 정리하세요.\n\n결과는 두 파일로 작성하세요.\n1) 사람이 읽는 표: data/legal/instruments.md\n2) 사이트가 읽는 데이터: data/legal/instruments.csv\nMarkdown에는 법제별 명칭·관할권·원문 링크·기준일·확인 상태와 확인 메모를 쉬운 말로 적고,\nCSV의 각 행이 Markdown 표의 한 행과 대응하게 하세요.\n공식 출처로 확인하지 못한 값은 추정하지 말고 검토 필요로 표시하세요.\n앱 코드, Supabase migration, 인증, 환경변수는 수정하지 마세요.`;
const legalMappingPrompt = `기존 seed 데이터의 17개 비교 기준을 읽고, 한국 PIPA와 일본 APPI의 관련 조항 후보를 정리하세요.\n\n결과는 두 파일로 작성하세요.\n1) 사람이 읽는 비교표: data/legal/criteria-mapping.md\n2) 사이트가 읽는 데이터: data/legal/criteria-mapping.csv\nMarkdown 표의 세로 행은 비교 기준, 가로 열은 관할권으로 구성하고 각 셀에 조항 번호·한국어 요약·공식 링크·검수 상태를 넣으세요.\nCSV의 각 행은 Markdown 표의 한 셀과 대응해야 합니다.\n정확한 조항을 확인하지 못한 경우 비워 두고 검토 필요라고 표시하세요.\n법률 내용을 추정하거나 새 비교 기준을 만들지 마세요.`;
const trendPrompt = `동향 담당으로 작업합니다. EDPB, OECD, CJEU/CURIA의 공식 페이지를 조사하세요.\n각 출처에서 개인정보 보호와 직접 관련된 자료를 5건씩 골라\nid, 제목, 기관, 국가, 게시일, 원문 URL, 주제, 한국어 요약, 검토 메모를 정리하세요.\n\n출처별로 두 파일씩 작성하세요.\n1) 사람이 읽는 검토표: data/trends/fixtures/edpb.md, oecd.md, curia.md\n2) 사이트가 읽는 데이터: data/trends/fixtures/edpb.json, oecd.json, curia.json\n그리고 세 출처를 고른 이유와 중복·누락 메모를 data/trends/fixtures/review-notes.md에 적으세요.\nMarkdown 검토표의 각 행은 JSON의 한 항목과 대응해야 합니다.\n원문 URL이나 게시일을 확인하지 못한 자료는 제외하거나 검토 필요로 표시하세요.\n앱 코드, Supabase migration, 인증, 환경변수는 수정하지 마세요.`;
const prPrompt = `작업 결과를 검토 가능한 PR로 만들어 주세요.\nPR 제목에는 작업 목적을 적고, 본문에는 변경 파일, 확인한 공식 URL,\n사람이 추가로 확인해야 하는 부분, 실행한 검증을 적으세요.\nmain 브랜치에는 직접 merge하지 마세요.`;

export default function GuidePage() {
  return <main className="guide-page">
    <div className="guide-wrap">
      <p className="eyebrow">GLOBALTREND / TEAM GUIDE</p>
      <h1>GlobalTrend 팀 온보딩 가이드</h1>
      <p className="guide-lead">이 프로젝트는 해외 개인정보 보호 동향과 법제를 한국어로 조사하고 비교하는 웹사이트입니다. 코딩을 잘 몰라도 참여할 수 있습니다. Codex에게 작업을 시키고, 결과를 확인하고, PR로 제출하는 방식으로 진행합니다.</p>

      <section className="guide-card"><h2>우리가 만드는 사이트</h2><p>사이트에는 네 가지 큰 기능이 있습니다.</p><ol><li>EDPB·OECD·CJEU 같은 공식 출처에서 개인정보 보호 자료를 모읍니다.</li><li>모인 자료를 한국어로 정리해 주간 동향 자료를 만듭니다.</li><li>한국 PIPA, 일본 APPI, 중국 PIPL, EU GDPR, UK GDPR, 미국 CCPA, 싱가포르 PDPA를 비교합니다.</li><li>동향 자료에서 언급된 법 조항을 실제 법제 자료와 연결합니다.</li></ol><p>수집·번역·초안이 자동으로 공개되지는 않습니다. 팀원이 확인하고 승인한 자료만 일반 사용자에게 공개합니다.</p><div className="guide-note"><strong>결과 파일은 3종 세트로 만듭니다.</strong><br />사람이 읽는 <code>.md</code> 요약표 + 사이트가 읽는 <code>.csv</code> 또는 <code>.json</code> + 확인하지 못한 내용을 적는 검토 메모입니다. 팀원은 Markdown을 먼저 보고, 기계용 파일은 표의 내용과 서로 맞는지 확인합니다.</div></section>

      <section><h2 className="guide-section-title">처음 시작할 때 할 일</h2><div className="guide-steps">{steps.map(([number, title, text]) => <div className="guide-step" key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></div>)}</div></section>

      <section className="guide-card">
        <h2>1. 팀원이 자기 계정으로 저장소 열기 · Windows</h2>
        <p><strong>계정은 두 개입니다.</strong> GitHub에는 팀원 본인의 GitHub 계정으로, Codex가 있는 ChatGPT 데스크톱 앱에는 본인의 ChatGPT 계정으로 로그인합니다. 리더의 계정을 함께 쓰지 않습니다.</p>
        <p>Codex의 로컬 프로젝트는 컴퓨터의 폴더를 엽니다. 먼저 GitHub Desktop으로 저장소를 컴퓨터에 복제하고, 그 폴더를 Codex에서 선택하세요.</p>
        <h3>① 리더가 초대하고, 팀원이 수락합니다</h3>
        <ol>
          <li>리더가 <a href="https://github.com/parksunup/globaltrend">parksunup/globaltrend</a>에서 <strong>Settings → Collaborators → Add people</strong>로 들어가 팀원의 GitHub 사용자 이름을 초대합니다. <strong>Access</strong> 묶음이 보이면 그 아래 <strong>Collaborators</strong>를 선택합니다.</li>
          <li>팀원은 본인의 GitHub 계정으로 로그인해 초대 이메일 또는 알림의 <strong>View invitation / Accept invitation</strong>을 눌러 수락합니다.</li>
        </ol>
        <h3>② GitHub Desktop에서 저장소를 Clone합니다</h3>
        <ol>
          <li><a href="https://desktop.github.com/">GitHub Desktop</a>을 설치하고 실행합니다. <strong>Sign in to GitHub.com</strong>으로 본인 계정에 로그인합니다.</li>
          <li>상단 메뉴 <strong>File → Clone repository…</strong>를 누릅니다.</li>
          <li><strong>URL</strong> 탭을 누르고 주소 칸에 <code>https://github.com/parksunup/globaltrend</code>를 붙여 넣습니다. 자기 계정의 저장소 목록에 안 보여도 URL로 지정할 수 있습니다.</li>
          <li><strong>Local path → Choose…</strong>에서 컴퓨터에 저장할 위치를 고른 뒤 <strong>Clone</strong>을 누릅니다. 표시된 경로를 기억합니다.</li>
          <li><strong>Repository → Show in Explorer</strong>로 폴더를 열어 <code>README.md</code>, <code>architecture.md</code>, <code>app</code> 폴더가 있는지 확인합니다.</li>
        </ol>
        <p>브라우저의 저장소 페이지에서 녹색 <strong>Code → Open with GitHub Desktop → Choose… → Clone</strong>으로 진행해도 됩니다.</p>
        <h3>③ Codex에서 그 폴더를 엽니다</h3>
        <ol>
          <li>ChatGPT 데스크톱 앱에 본인의 ChatGPT 계정으로 로그인하고, 상단 <strong>ChatGPT</strong> 선택 메뉴에서 <strong>Codex</strong>를 고릅니다.</li>
          <li><strong>Add new project</strong>를 누르거나 <strong>Ctrl+O</strong>를 누릅니다.</li>
          <li>파일 선택 창에서 방금 Clone한 <strong>globaltrend 폴더 자체</strong>를 선택합니다. <code>README.md</code> 파일 하나를 선택하지 않습니다.</li>
          <li>왼쪽 프로젝트 목록의 <strong>globaltrend</strong>를 열고 새 작업을 시작합니다. 아래 2번의 프롬프트로 문서를 먼저 읽힙니다.</li>
        </ol>
        <h3>④ 자기 브랜치를 만듭니다</h3>
        <p>GitHub Desktop에서 <strong>Current branch → New branch</strong>를 눌러 <code>main</code> 기준의 본인 작업 브랜치를 만듭니다. 이름 예: <code>feat/legal-corpus-foundation</code>. <strong>Create branch</strong>를 누른 뒤 Codex에서 작업합니다. <code>main</code>에는 직접 작업하지 않습니다.</p>
        <p><strong>저장소가 안 보인다면:</strong> GitHub Desktop의 <strong>URL</strong> 탭에 위 주소를 직접 넣으세요. Clone이 실패하면 GitHub Desktop 로그인 계정과 주소를 확인합니다. Clone은 되지만 변경 사항을 올릴 수 없다면 초대 수락 상태를 확인합니다.</p>
        <p><strong>Codex에서 폴더가 안 보인다면:</strong> GitHub Desktop의 <strong>Repository → Show in Explorer</strong>에서 실제 위치를 확인한 뒤 <strong>Add new project / Ctrl+O</strong>로 그 폴더를 고릅니다. 이 절차에는 Codex GitHub 플러그인 연결이 필요하지 않습니다.</p>
        <p><strong>주의:</strong> <strong>Create a new repository</strong>나 <strong>Fork</strong>를 선택하지 않습니다. 기존 저장소를 <strong>Clone</strong>합니다.</p>
        <p>화면 메뉴 참고: <a href="https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop">GitHub Desktop 공식 안내</a> · <a href="https://learn.chatgpt.com/docs/windows/windows-app">ChatGPT Windows 앱 공식 안내</a> · <a href="https://learn.chatgpt.com/docs/projects">Codex 로컬 프로젝트 안내</a></p>
      </section>

      <section className="guide-card"><h2>2. Codex에게 문서를 먼저 읽히기</h2><p>새 작업을 시작할 때 아래 내용을 그대로 붙여 넣습니다.</p><pre>{readFirst}</pre><p>Codex가 요약한 내용을 읽고 프로젝트 목적과 작업 범위를 제대로 이해했는지 확인합니다. 바로 코드를 수정하게 하지 않습니다.</p></section>

      <div className="guide-columns"><section className="guide-card"><h2>3-A. 법제 담당</h2><p>법률 원문, 한국어 번역, 비교 기준을 준비합니다. 처음에는 화면이나 데이터베이스를 수정하지 않습니다.</p><ul><li>7개 법제의 공식 원문과 판본 확인</li><li>한국어 번역 출처 기록</li><li>17개 기준별 조항 후보 정리</li><li>조항 번호·원문·번역·요약·공식 링크 기록</li><li>확인하지 못한 내용은 검토 필요로 표시</li><li><strong>Markdown 검토표와 CSV를 함께 제출</strong></li></ul><pre>{legalPrompt}</pre><h3>다음 작업: 조항 매핑</h3><pre>{legalMappingPrompt}</pre></section><section className="guide-card"><h2>3-B. 동향 담당</h2><p>공식 출처의 자료를 조사하고 수집기와 주간 자료에 사용할 기준을 준비합니다.</p><ul><li>EDPB·OECD·CJEU 공식 페이지 확인</li><li>제목·게시일·기관·국가·주제·원문 URL 기록</li><li>중복 자료와 단순 공지 구분</li><li>본문 누락·수집 실패 사례 기록</li><li>주간 동향 자료에 쓸 샘플 작성</li><li><strong>Markdown 검토표와 JSON을 함께 제출</strong></li></ul><pre>{trendPrompt}</pre></section></div>

      <section className="guide-card"><h2>4. 결과를 PR로 제출하기</h2><p>Codex가 파일을 만들면 먼저 변경 내용을 확인합니다. 공식 URL이 있는지, 추정한 내용이 섞이지 않았는지, 지정된 폴더 밖의 파일을 수정하지 않았는지 확인합니다.</p><pre>{prPrompt}</pre><p>PR이 올라오면 사용자님이 파일과 Vercel Preview를 확인한 뒤 main에 merge합니다. 팀원은 main에 직접 push하거나 merge하지 않습니다.</p></section>

      <section className="guide-card"><h2>사용자님이 PR에서 확인할 것</h2><ul><li>요청한 결과 파일이 실제로 들어 있는가</li><li><strong>Markdown 표를 먼저 읽고 내용을 이해할 수 있는가</strong></li><li>Markdown 표와 CSV·JSON의 행·항목 수가 서로 맞는가</li><li>공식 원문 URL을 직접 열 수 있는가</li><li>확인하지 못한 내용이 `검토 필요`로 표시되어 있는가</li><li>앱 코드·Supabase·환경변수를 불필요하게 수정하지 않았는가</li><li>PR에 검증 방법과 남은 문제가 적혀 있는가</li><li>기존 자료를 삭제하거나 덮어쓰지 않았는가</li></ul></section>

      <section className="guide-card"><h2>팀의 기본 원칙</h2><p>법제 담당과 동향 담당은 서로의 작업을 기다릴 필요가 없습니다. 각자 정해진 폴더의 결과물을 만들고 PR을 제출합니다. 사용자님이 결과물을 검토한 뒤 나중에 웹사이트와 Supabase에 연결합니다.</p><p>모르는 부분은 임의로 채우지 말고 `검토 필요`라고 적습니다. Codex가 만든 결과도 최종 법률 판단이나 공개 승인을 대신하지 않습니다.</p></section>
      <a className="guide-back" href="/">검토 보드로 돌아가기 ↗</a>
    </div>
  </main>;
}
