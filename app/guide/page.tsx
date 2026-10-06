const steps = [
  ["1", "GitHub 저장소를 컴퓨터로 가져오기", "본인 GitHub 계정으로 초대를 수락하고 GitHub Desktop에서 parksunup/globaltrend를 Clone합니다."],
  ["2", "리드가 만든 양식 받기", "Fetch origin으로 목록을 갱신한 뒤 리드가 미리 만든 담당자 브랜치로 전환합니다. 같은 이름의 브랜치를 새로 만들지 않습니다."],
  ["3", "빈 양식에 조사 결과 적기", "법제 담당은 data/legal, 동향 담당은 data/trends의 빈 양식을 복사해 작성합니다. 모르는 내용은 검토 필요로 남깁니다."],
  ["4", "검사하고 PR 만들기", "pnpm validate:data를 실행하고 공식 링크와 검토할 부분을 확인한 뒤 PR을 올립니다. main에는 직접 올리지 않습니다."],
];

const readFirst = `제 역할은 [프로젝트 리드 / 법제 담당 / 동향 담당 중 하나]입니다.\n이 저장소의 README.md, architecture.md, docs/team-onboarding.md를 먼저 읽고\n프로젝트 목적, 공개 범위, 현재 구현 상태, 제 역할을 쉬운 말로 설명해 주세요.\n아직 파일은 수정하지 말고, 제가 이해한 내용이 맞는지 확인할 수 있게 요약해 주세요.\n역할이 비어 있거나 불분명하면 문서만 보고 추정하지 말고 먼저 질문해 주세요.`;
const legalPrompt = `법제 담당입니다. README.md, architecture.md와 온보딩 문서를 먼저 읽으세요.\n한국 PIPA, 일본 APPI, 중국 PIPL, EU GDPR, UK GDPR, 캘리포니아 CCPA, 싱가포르 PDPA의\n공식 법령명, 관할권, 원문 URL, 확인한 판본·시행일, 기존 한국어 번역의 유무와 출처를 조사하세요.\nUK GDPR에 연결되는 영국의 보완 법령도 메모하되 새 비교 기준은 만들지 마세요.\n\n사람이 읽는 data/legal/instruments.md와 대응하는 data/legal/instruments.csv를 만드세요.\n원문과 번역의 이용·재배포 조건을 확인한 내용은 data/legal/review-notes.md에 적으세요.\n확인하지 못한 값은 추정하지 말고 검토 필요로 표시하세요.\n앱 코드, Supabase, 인증, 환경변수는 수정하지 마세요.`;
const legalTranslationPrompt = `법제 담당의 둘째 작업입니다. 공식 판본을 확정한 법률 하나를 선택하세요.\n처음에는 일본 APPI로 시작하고, 이후 다른 해외법에도 같은 작업을 반복합니다.\n선택한 법률의 조문 전체를 빠짐없이 한국어로 번역해 한 문서로 완성하세요.\n길면 여러 작업으로 나누되 각 작업이 끝날 때 같은 문서에 이어 쓰고,\n마지막에 원문 목차와 조·항·호·부칙의 수와 순서를 대조해 누락을 확인하세요.\n\n결과는 법률별 한국어 번역 전문 한 파일입니다. 예: data/legal/translations/appi.md.\n제목에 법률명·관할권·공식 원문 URL·판본·시행일·번역 상태를 적고,\n본문에는 원문의 편·장·절·조·항·호 구조와 조항 번호를 유지하세요.\n원문에 없는 해석을 덧붙이지 말고, 애매한 용어와 번역 결정은 별도 검토 메모에 남기세요.\n각 조항에 연결할 수 있는 appi.json과 누락·검수 상태 목록도 작성하세요.\n검토 메모에는 원문과 번역문의 조·항·호·부칙 수, 빠진 항목, 확인 방법을 표로 적으세요.\n미완료 문서를 '전문'이나 검수 완료로 표시하지 마세요. 모든 번역은 사람 검수 전 초안입니다.\n공개 저장소에 본문을 올릴 수 있는 조건이 불확실하면 본문은 커밋하지 말고\n판본·진행률·공개 보류 이유를 검토 메모에 남겨 리더에게 전달하세요.`;
const legalMappingPrompt = `법제 담당의 셋째 작업입니다. 먼저 완성된 법률별 한국어 번역 문서를 읽으세요.\n그 다음 팀원이 작업 브랜치에 추가한 한국·일본 비교표의 17개 기준을 세로 행으로, 7개 법제를 가로 열로 둔\n조항별 분류·요약표를 작성하세요. 비교표 파일을 읽지 못했다면 작업을 멈추고 필요한 파일명을 먼저 보고하세요.\n각 셀에는 관련 조항 번호, 한국어 핵심 요약, 주요 예외, 번역 문서의 해당 조항 링크,\n공식 원문 URL, 검수 상태를 넣으세요. 여러 조항이 관련되면 모두 연결하세요.\n\ndata/legal/criteria-mapping.md와 각 셀에 대응하는 criteria-mapping.csv를 만드세요.\n우선 한국 PIPA와 일본 APPI부터 채우고, 나머지 법률은 번역 전문이 완성될 때마다 추가하세요.\n아직 조사하지 않은 셀은 '미검토'로 두고 근거 없이 '규정 없음'이라고 쓰지 마세요.\n번역 초안은 검수 완료 번역으로 표시하지 마세요. 앱 코드와 Supabase는 수정하지 마세요.`;
const trendSourcePrompt = `동향 담당입니다. README.md, architecture.md와 온보딩 문서를 먼저 읽으세요.\nEDPB, OECD, CJEU/CURIA의 공식 자료 목록과 상세 페이지를 실제로 확인하세요.\n각 출처의 시작 URL, 자료 유형, 제목·게시일·본문·공식 링크를 얻는 방법,\nRSS·API 제공 여부, 수집 제외 대상, 접근 실패 사례를 기록하세요.\nCURIA는 사건번호·ECLI·선고일이 보이는지도 확인하세요.\n\n출처별로 사람이 읽는 data/trends/source-configs/edpb.md, oecd.md, curia.md와\n대응하는 edpb.json, oecd.json, curia.json을 만드세요.\n확인하지 못한 페이지 구조나 선택자는 추정하지 말고 검토 필요로 적으세요.\n앱 코드, Supabase, 인증, 환경변수는 수정하지 마세요.`;
const trendSamplePrompt = `동향 담당의 다음 작업입니다. EDPB, OECD, CJEU/CURIA에서 개인정보 보호와\n직접 관련된 실제 자료를 출처별로 최대 5건씩 고르세요. 부족하면 건수를 채우려고 꾸미지 마세요.\n각 건의 원제목, 기관, 국가·관할권, 원문 게시일, 공식 URL, 자료 유형,\n한국어 제목·짧은 요약, 요약의 근거 위치, 주제 태그, 중복·검토 상태를 기록하세요.\n판결문·보도자료 등 같은 사건의 문서는 연결하고 중복 건수로 세지 마세요.\n원문에서 확인할 수 없는 법적 결론은 쓰지 마세요.\n\n출처별 data/trends/fixtures/edpb.md·edpb.json, oecd.md·oecd.json,\ncuria.md·curia.json을 만들고 선택·제외 이유를 review-notes.md에 적으세요.\nMarkdown 표의 한 행과 JSON의 한 항목이 대응해야 합니다.\n원문 전문이나 무허가 번역문을 공개 저장소에 넣지 마세요.`;
const trendWeeklyPrompt = `동향 담당의 다음 작업입니다. 수집한 샘플 중 공식 링크와 게시일을\n확인한 건만 사용해 주간 동향 '예시 호'를 만드세요.\n제공된 2026년 제36호 PDF의 목차·항목 구성은 참고하되 내용을 복사하지 마세요.\n표지에는 예시 자료이며 전체 출처를 망라하지 않는다고 표시하세요.\n각 항목에 한국어 제목, 게시일, 기관·관할권, 사실 요약, 개인정보 보호상 의미,\n공식 근거 링크와 사람 검토가 필요한 부분을 구분해 적으세요.\n\ndata/trends/weekly-sample.md와 대응하는 weekly-sample.json을 작성하고\n제외·중복 판단은 data/trends/fixtures/review-notes.md에 남기세요.\n실제 발행 상태로 바꾸거나 앱 코드·Supabase를 수정하지 마세요.`;
const prPrompt = `작업 결과를 검토 가능한 PR로 만들어 주세요.\nPR 제목에는 작업 목적을 적고, 본문에는 변경 파일, 확인한 공식 URL,\n사람이 추가로 확인해야 하는 부분, 실행한 검증을 적으세요.\nmain 브랜치에는 직접 merge하지 마세요.`;

export default function GuidePage() {
  return <main className="guide-page">
    <div className="guide-wrap">
      <p className="eyebrow">GLOBALTREND / TEAM GUIDE</p>
      <h1>GlobalTrend 팀 온보딩 가이드</h1>
      <p className="guide-lead">이 프로젝트는 해외 개인정보 보호 동향과 법제를 한국어로 조사하고 비교하는 웹사이트입니다. 코딩을 잘 몰라도 참여할 수 있습니다. Codex에게 작업을 시키고, 결과를 확인하고, PR로 제출하는 방식으로 진행합니다.</p>

      <section className="guide-card"><h2>우리가 만드는 사이트</h2><p>사이트에는 네 가지 큰 기능이 있습니다.</p><ol><li>EDPB·OECD·CJEU 같은 공식 출처에서 개인정보 보호 자료를 모읍니다.</li><li>모인 자료를 한국어로 정리해 주간 동향 자료를 만듭니다.</li><li>한국 PIPA, 일본 APPI, 중국 PIPL, EU GDPR, UK GDPR, 미국 CCPA, 싱가포르 PDPA를 비교합니다.</li><li>동향 자료에서 언급된 법 조항을 실제 법제 자료와 연결합니다.</li></ol><p>수집·번역·초안이 자동으로 공개되지는 않습니다. 팀원이 확인하고 승인한 자료만 일반 사용자에게 공개합니다.</p><div className="guide-note"><strong>현재는 P1 기반 구현 단계입니다.</strong><br />공개 검토 보드, Supabase 초기 스키마·RLS·seed, <code>/team</code> 로그인과 승인·반려·검수 메모 저장, 수집 자료의 중복 방지·판본 보존·초안 작업 등록을 담당하는 DB 입구가 있습니다. 승인은 자동 공개가 아니며, 실제 출처별 자동 수집·Codex 초안 자동화·검색·발행은 아직 연결되지 않았습니다.</div><div className="guide-note"><strong>먼저 빈 업무 양식을 사용합니다.</strong><br />법제 담당은 <code>data/legal</code>, 동향 담당은 <code>data/trends</code>의 <code>*.template.*</code> 파일을 복사합니다. 사람이 읽는 <code>.md</code> + 사이트가 읽는 <code>.csv</code> 또는 <code>.json</code> + 검토 메모를 함께 제출하고 <code>pnpm validate:data</code>로 검사합니다.</div></section>

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
        <h3>④ 리드가 만든 담당자 브랜치로 전환합니다</h3>
        <p>리드가 공용 양식을 <code>main</code>에 반영하고 담당자 브랜치를 만들었다는 안내를 받은 뒤 시작합니다. GitHub Desktop에서 <strong>Fetch origin</strong>을 눌러 원격 브랜치 목록을 갱신한 다음 <strong>Current branch</strong>에서 자기 브랜치를 선택합니다.</p>
        <p>법제 담당은 <code>feat/legal-corpus-foundation</code>, 동향 담당은 <code>feat/trend-source-contracts</code>를 사용합니다. <strong>New branch</strong>나 <strong>Create branch</strong>는 누르지 않습니다. 브랜치가 보이지 않으면 새로 만들지 말고 리드에게 확인합니다.</p>
        <p><strong>저장소가 안 보인다면:</strong> GitHub Desktop의 <strong>URL</strong> 탭에 위 주소를 직접 넣으세요. Clone이 실패하면 GitHub Desktop 로그인 계정과 주소를 확인합니다. Clone은 되지만 변경 사항을 올릴 수 없다면 초대 수락 상태를 확인합니다.</p>
        <p><strong>Codex에서 폴더가 안 보인다면:</strong> GitHub Desktop의 <strong>Repository → Show in Explorer</strong>에서 실제 위치를 확인한 뒤 <strong>Add new project / Ctrl+O</strong>로 그 폴더를 고릅니다. 이 절차에는 Codex GitHub 플러그인 연결이 필요하지 않습니다.</p>
        <p><strong>주의:</strong> <strong>Create a new repository</strong>나 <strong>Fork</strong>를 선택하지 않습니다. 기존 저장소를 <strong>Clone</strong>합니다.</p>
        <p>화면 메뉴 참고: <a href="https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop">GitHub Desktop 공식 안내</a> · <a href="https://learn.chatgpt.com/docs/windows/windows-app">ChatGPT Windows 앱 공식 안내</a> · <a href="https://learn.chatgpt.com/docs/projects">Codex 로컬 프로젝트 안내</a></p>
      </section>

      <section className="guide-card"><h2>2. Codex에게 문서를 먼저 읽히기</h2><p>새 작업을 시작할 때 아래 내용을 붙여 넣고, 첫 줄의 대괄호를 자신의 실제 역할 하나로 바꿉니다. 역할명은 고정된 책임 범위이며 현재 대화 상대가 자동으로 프로젝트 리드가 되는 것은 아닙니다.</p><pre>{readFirst}</pre><p>Codex가 요약한 내용을 읽고 프로젝트 목적과 작업 범위를 제대로 이해했는지 확인합니다. 바로 코드를 수정하게 하지 않습니다.</p></section>

      <div className="guide-columns">
        <section className="guide-card">
          <h2>3-A. 법제 담당</h2>
          <p>공식 판본 확인 → 법률별 한국어 번역 전문 작성 → 완성된 번역을 바탕으로 17개 기준별 조항 분류·요약표 작성 순서로 진행합니다. 번역은 법률 하나씩 이어서 작성합니다.</p>
          <h3>첫 작업 · 7개 법제와 판본 확인</h3>
          <pre>{legalPrompt}</pre>
          <h3>둘째 작업 · 법률별 한국어 번역 전문</h3>
          <pre>{legalTranslationPrompt}</pre>
          <h3>셋째 작업 · 17개 기준 분류·요약표</h3>
          <pre>{legalMappingPrompt}</pre>
        </section>
        <section className="guide-card">
          <h2>3-B. 동향 담당</h2>
          <p>공식 출처 조사 → 근거가 있는 샘플 자료 → 주간 자료 예시 호 순서로 진행합니다. 첫 조사에서 수집기의 입력 규칙을 마련합니다.</p>
          <h3>첫 작업 · EDPB·OECD·CURIA 출처 확인</h3>
          <pre>{trendSourcePrompt}</pre>
          <h3>둘째 작업 · 샘플 동향 자료</h3>
          <pre>{trendSamplePrompt}</pre>
          <h3>셋째 작업 · 주간 자료 예시 호</h3>
          <pre>{trendWeeklyPrompt}</pre>
        </section>
      </div>

      <section className="guide-card"><h2>4. 검사하고 PR로 제출하기</h2><p>Codex가 파일을 만들면 <code>pnpm validate:data</code>를 실행합니다. 그다음 공식 URL이 있는지, 추정한 내용이 섞이지 않았는지, 지정된 폴더 밖의 파일을 수정하지 않았는지 확인합니다.</p><pre>{prPrompt}</pre><p>PR이 올라오면 담당자는 자기 Vercel Preview 첫 화면의 <strong>PR 제출물</strong> 탭에서 제출 내용과 상태를 확인합니다. 이 화면은 브랜치 파일을 읽기 전용으로 보여주며 검수 승인이나 실제 발행이 아닙니다. 프로젝트 리드는 Markdown 원본·공식 근거·검토 필요 항목·자동 검사와 Preview 표시를 함께 확인한 뒤 main에 merge합니다. 팀원은 main에 직접 push하거나 merge하지 않습니다.</p></section>

      <section className="guide-card"><h2>프로젝트 리드가 PR에서 확인할 것</h2><ul><li>요청한 결과 파일이 실제로 들어 있는가</li><li>법률별 번역 전문이 원문 조·항·호·부칙과 빠짐없이 대응하는가</li><li>17개 기준표의 조항 링크가 해당 법률 전문과 공식 판본을 가리키는가</li><li><strong>Markdown 표를 먼저 읽고 내용을 이해할 수 있는가</strong></li><li>Markdown 표와 CSV·JSON의 행·항목 수가 서로 맞는가</li><li>공식 원문 URL을 직접 열 수 있는가</li><li>확인하지 못한 내용이 `검토 필요`로 표시되어 있는가</li><li>앱 코드·Supabase·환경변수를 불필요하게 수정하지 않았는가</li><li>PR에 검증 방법과 남은 문제가 적혀 있는가</li><li>기존 자료를 삭제하거나 덮어쓰지 않았는가</li></ul></section>

      <section className="guide-card"><h2>팀의 기본 원칙</h2><p>법제 담당과 동향 담당은 서로의 작업을 기다릴 필요가 없습니다. 각자 정해진 폴더의 결과물을 만들고 PR을 제출합니다. 프로젝트 리드가 결과물을 검토한 뒤 나중에 웹사이트와 Supabase에 연결합니다.</p><p>모르는 부분은 임의로 채우지 말고 `검토 필요`라고 적습니다. Codex가 만든 결과도 최종 법률 판단이나 공개 승인을 대신하지 않습니다.</p></section>
      <a className="guide-back" href="/">검토 보드로 돌아가기 ↗</a>
    </div>
  </main>;
}
