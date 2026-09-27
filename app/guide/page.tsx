const steps = [
  ["1", "Codex에서 저장소 열기", "Codex 데스크톱 앱을 열고 GitHub의 parksunup/globaltrend 저장소를 프로젝트로 추가합니다."],
  ["2", "문서 먼저 읽히기", "README.md와 architecture.md는 이 프로젝트가 무엇을 만드는지 설명합니다. 작업 전에 Codex에게 먼저 읽게 합니다."],
  ["3", "내 역할의 작업 시키기", "법제 담당은 법제 자료를, 동향 담당은 공식 출처 자료를 맡습니다. 아래 프롬프트를 복사해 사용합니다."],
  ["4", "결과를 확인하고 PR 만들기", "Codex의 결과를 확인하고, 공식 링크와 검토할 부분을 확인한 뒤 PR을 올립니다. main에는 직접 올리지 않습니다."],
];

const readFirst = `이 저장소의 README.md, architecture.md, docs/team-onboarding.md를 먼저 읽고\n프로젝트 목적, 공개 범위, 현재 구현 상태, 제 역할을 쉬운 말로 설명해 주세요.\n아직 파일은 수정하지 말고, 제가 이해한 내용이 맞는지 확인할 수 있게 요약해 주세요.`;
const legalPrompt = `법제 담당으로 작업합니다. README.md와 architecture.md를 먼저 읽으세요.\n한국 PIPA, 일본 APPI, 중국 PIPL, EU GDPR, UK GDPR, 미국 CCPA, 싱가포르 PDPA에 대해\n공식 법령명, 관할권, 공식 원문 URL, 현행 판본 또는 기준일, 확인 메모를 정리하세요.\n\n결과는 data/legal/instruments.csv로 작성하세요.\n공식 출처로 확인하지 못한 값은 추정하지 말고 검토 필요로 표시하세요.\n앱 코드, Supabase migration, 인증, 환경변수는 수정하지 마세요.`;
const legalMappingPrompt = `기존 seed 데이터의 17개 비교 기준을 읽고, 한국 PIPA와 일본 APPI의 관련 조항 후보를 정리하세요.\n\n각 행에는 criterion_key, jurisdiction_code, article_reference, source_url,\nsummary_ko, evidence_status, review_note를 넣으세요.\n정확한 조항을 확인하지 못한 경우 비워 두고 검토 필요라고 표시하세요.\n법률 내용을 추정하거나 새 비교 기준을 만들지 마세요.`;
const trendPrompt = `동향 담당으로 작업합니다. EDPB, OECD, CJEU/CURIA의 공식 페이지를 조사하세요.\n각 출처에서 개인정보 보호와 직접 관련된 자료를 5건씩 골라\nid, 제목, 기관, 국가, 게시일, 원문 URL, 주제, 한국어 요약, 검토 메모를 정리하세요.\n\n결과는 data/trends/fixtures/ 아래 JSON 파일로 작성하세요.\n원문 URL이나 게시일을 확인하지 못한 자료는 검토 필요로 표시하세요.\n앱 코드, Supabase migration, 인증, 환경변수는 수정하지 마세요.`;
const prPrompt = `작업 결과를 검토 가능한 PR로 만들어 주세요.\nPR 제목에는 작업 목적을 적고, 본문에는 변경 파일, 확인한 공식 URL,\n사람이 추가로 확인해야 하는 부분, 실행한 검증을 적으세요.\nmain 브랜치에는 직접 merge하지 마세요.`;

export default function GuidePage() {
  return <main className="guide-page">
    <div className="guide-wrap">
      <p className="eyebrow">GLOBALTREND / TEAM GUIDE</p>
      <h1>GlobalTrend 팀 온보딩 가이드</h1>
      <p className="guide-lead">이 프로젝트는 해외 개인정보 보호 동향과 법제를 한국어로 조사하고 비교하는 웹사이트입니다. 코딩을 잘 몰라도 참여할 수 있습니다. Codex에게 작업을 시키고, 결과를 확인하고, PR로 제출하는 방식으로 진행합니다.</p>

      <section className="guide-card"><h2>우리가 만드는 사이트</h2><p>사이트에는 네 가지 큰 기능이 있습니다.</p><ol><li>EDPB·OECD·CJEU 같은 공식 출처에서 개인정보 보호 자료를 모읍니다.</li><li>모인 자료를 한국어로 정리해 주간 동향 자료를 만듭니다.</li><li>한국 PIPA, 일본 APPI, 중국 PIPL, EU GDPR, UK GDPR, 미국 CCPA, 싱가포르 PDPA를 비교합니다.</li><li>동향 자료에서 언급된 법 조항을 실제 법제 자료와 연결합니다.</li></ol><p>수집·번역·초안이 자동으로 공개되지는 않습니다. 팀원이 확인하고 승인한 자료만 일반 사용자에게 공개합니다.</p></section>

      <section><h2 className="guide-section-title">처음 시작할 때 할 일</h2><div className="guide-steps">{steps.map(([number, title, text]) => <div className="guide-step" key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></div>)}</div></section>

      <section className="guide-card"><h2>1. Codex에 GitHub 저장소 추가하기</h2><p>처음에는 Codex가 어느 폴더의 파일을 다뤄야 하는지 알려줘야 합니다. 아래 순서대로 한 번만 설정하면 됩니다.</p><ol><li>Codex 데스크톱 앱을 열고 GitHub 계정으로 로그인합니다.</li><li>왼쪽 사이드바에서 <strong>Projects</strong> 또는 <strong>프로젝트</strong>를 찾습니다. 보이지 않으면 새 작업 화면의 프로젝트 선택 메뉴를 엽니다.</li><li><strong>+</strong>, <strong>Add project</strong>, <strong>프로젝트 추가</strong> 중 보이는 버튼을 누릅니다.</li><li><strong>GitHub 저장소 연결</strong>, <strong>Clone repository</strong> 또는 비슷한 항목을 선택합니다.</li><li>GitHub 권한을 묻는 창이 나오면 저장소를 읽고 작업할 수 있도록 승인합니다. 저장소 목록에서 <code>parksunup/globaltrend</code>를 검색해 선택합니다.</li><li>내 컴퓨터에 저장할 폴더를 선택합니다. 예를 들어 바탕화면에 <code>globaltrend</code> 폴더를 만들 수 있습니다.</li><li>복제 또는 추가가 끝나면 프로젝트 목록에서 <code>globaltrend</code>를 클릭해 엽니다. 파일 목록에 <code>README.md</code>, <code>architecture.md</code>, <code>app</code> 폴더가 보이면 제대로 열린 것입니다.</li><li>작업을 시작하기 전에 브랜치 메뉴에서 <code>main</code>을 기준으로 새 브랜치를 만듭니다. 예: <code>feat/legal-corpus-foundation</code></li></ol><p><strong>저장소가 안 보일 때:</strong> GitHub에 다른 계정으로 로그인했는지 확인하고, 저장소 주소를 직접 <code>https://github.com/parksunup/globaltrend</code>로 열어 접근 가능한지 확인합니다. 권한 요청이 다시 나오면 승인합니다. 그래도 안 되면 Codex를 닫았다가 다시 열고 GitHub 연결을 다시 시도합니다.</p><p><strong>주의:</strong> 새 저장소를 만들거나 파일을 다른 저장소로 복사하지 않습니다. 반드시 기존 <code>parksunup/globaltrend</code>를 연결해야 합니다.</p></section>

      <section className="guide-card"><h2>2. Codex에게 문서를 먼저 읽히기</h2><p>새 작업을 시작할 때 아래 내용을 그대로 붙여 넣습니다.</p><pre>{readFirst}</pre><p>Codex가 요약한 내용을 읽고 프로젝트 목적과 작업 범위를 제대로 이해했는지 확인합니다. 바로 코드를 수정하게 하지 않습니다.</p></section>

      <div className="guide-columns"><section className="guide-card"><h2>3-A. 법제 담당</h2><p>법률 원문, 한국어 번역, 비교 기준을 준비합니다. 처음에는 화면이나 데이터베이스를 수정하지 않습니다.</p><ul><li>7개 법제의 공식 원문과 판본 확인</li><li>한국어 번역 출처 기록</li><li>17개 기준별 조항 후보 정리</li><li>조항 번호·원문·번역·요약·공식 링크 기록</li><li>확인하지 못한 내용은 검토 필요로 표시</li></ul><pre>{legalPrompt}</pre><h3>다음 작업: 조항 매핑</h3><pre>{legalMappingPrompt}</pre></section><section className="guide-card"><h2>3-B. 동향 담당</h2><p>공식 출처의 자료를 조사하고 수집기와 주간 자료에 사용할 기준을 준비합니다.</p><ul><li>EDPB·OECD·CJEU 공식 페이지 확인</li><li>제목·게시일·기관·국가·주제·원문 URL 기록</li><li>중복 자료와 단순 공지 구분</li><li>본문 누락·수집 실패 사례 기록</li><li>주간 동향 자료에 쓸 샘플 작성</li></ul><pre>{trendPrompt}</pre></section></div>

      <section className="guide-card"><h2>4. 결과를 PR로 제출하기</h2><p>Codex가 파일을 만들면 먼저 변경 내용을 확인합니다. 공식 URL이 있는지, 추정한 내용이 섞이지 않았는지, 지정된 폴더 밖의 파일을 수정하지 않았는지 확인합니다.</p><pre>{prPrompt}</pre><p>PR이 올라오면 사용자님이 파일과 Vercel Preview를 확인한 뒤 main에 merge합니다. 팀원은 main에 직접 push하거나 merge하지 않습니다.</p></section>

      <section className="guide-card"><h2>사용자님이 PR에서 확인할 것</h2><ul><li>요청한 결과 파일이 실제로 들어 있는가</li><li>공식 원문 URL을 직접 열 수 있는가</li><li>확인하지 못한 내용이 `검토 필요`로 표시되어 있는가</li><li>앱 코드·Supabase·환경변수를 불필요하게 수정하지 않았는가</li><li>PR에 검증 방법과 남은 문제가 적혀 있는가</li><li>기존 자료를 삭제하거나 덮어쓰지 않았는가</li></ul></section>

      <section className="guide-card"><h2>팀의 기본 원칙</h2><p>법제 담당과 동향 담당은 서로의 작업을 기다릴 필요가 없습니다. 각자 정해진 폴더의 결과물을 만들고 PR을 제출합니다. 사용자님이 결과물을 검토한 뒤 나중에 웹사이트와 Supabase에 연결합니다.</p><p>모르는 부분은 임의로 채우지 말고 `검토 필요`라고 적습니다. Codex가 만든 결과도 최종 법률 판단이나 공개 승인을 대신하지 않습니다.</p></section>
      <a className="guide-back" href="/">검토 보드로 돌아가기 ↗</a>
    </div>
  </main>;
}
