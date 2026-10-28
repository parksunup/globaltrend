import Link from 'next/link';

export default function GuidePage() {
  return <main className="guide-wrap">
    <p className="eyebrow">GLOBALTREND / TEAM GUIDE</p>
    <h1>담당자 작업실 안내</h1>
    <p className="guide-lead">자료를 훑어보고, 평소 쓰는 Codex에 자연어로 고칠 점을 말씀하시면 됩니다. Codex가 저장한 내용을 이 화면에서 다시 확인할 수 있습니다.</p>
    <section className="guide-card">
      <h2>작업 순서</h2>
      <ol>
        <li>담당 작업실을 엽니다. 동향은 <Link href="/work">동향 작업실</Link>, 법제는 <Link href="/work?role=legal">법제 작업실</Link>입니다.</li>
        <li>동향 담당자는 이 사이트의 팀 계정으로 로그인해 원고를 읽습니다. Supabase 관리자 권한이나 Vercel 팀 가입은 필요하지 않습니다.</li>
        <li>화면의 <strong>Codex에 수정 요청하는 방법 · 예시 프롬프트</strong>를 열고 <strong>Codex 연결 프롬프트 복사</strong>를 누릅니다. 저장소 주소와 기존 담당 브랜치, 수정·확인 방법이 포함되어 있습니다.</li>
        <li>복사한 문장을 본인의 Codex에 붙여 넣고, 마지막에 고칠 점을 편하게 적습니다. 항목마다 따로 의견을 등록할 필요는 없습니다.</li>
        <li>Codex가 저장을 마치면 같은 작업실에서 결과를 확인합니다. 화면은 2분마다 새로 확인합니다.</li>
      </ol>
    </section>
    <section className="guide-card">
      <h2>자료는 어디에 저장되나요?</h2>
      <p>동향 DB 원고 수정은 비공개 작업실 수정본에 저장됩니다. 운영 원고를 직접 변경하거나 자동 발행하지 않습니다. Codex 연결키는 별도 만료 없이 유지되고, 새 키를 발급하거나 작업실에서 연결 해제하면 즉시 무효화됩니다. 키는 원고를 읽고 비공개 수정본을 저장하는 데만 쓰이며, 계정 비밀번호는 프롬프트에 들어가지 않습니다.</p>
      <p>법제 자료와 GitHub에만 있는 조사 자료는 기존 담당 브랜치에 저장합니다. 동향은 <code>feat/trend-source-contracts</code>, 법제는 <code>feat/legal-corpus-foundation</code>입니다. 새 브랜치를 만들 필요가 없습니다.</p>
      <p>동향 자료를 바꿀 때는 사이트에서 팀 로그인 후 연결 프롬프트를 복사하세요. 법제는 <Link href="/work?role=legal">법제 작업실</Link>에서 예시 프롬프트를 복사하면 됩니다. 코드 변경은 기존 담당 브랜치에 push되어야 화면에 반영됩니다.</p>
    </section>
    <section className="guide-card">
      <h2>화면 구성</h2>
      <ul>
        <li>동향 담당: 모든 동향 원고를 검색하고 본문과 공식 출처를 읽습니다.</li>
        <li>법제 담당: 17개 기준 비교표와 법률별 전체 번역을 따로 살펴봅니다.</li>
      </ul>
      <p>매 수정마다 PR 병합이나 사이트 재배포를 기다리지 않습니다. 다만 이미 배포된 기능 코드가 없는 오래된 주소에서는 새 작업실 기능을 볼 수 없습니다.</p>
      <p>작업실 수정은 대외 공개와 별개입니다. 기존 공개 페이지는 <Link href="/public">국제요정 공개 페이지</Link>, 운영 자료 관리는 <code>/work</code>에서 확인합니다.</p>
    </section>
    <p className="guide-lead"><Link href="/work">동향 작업실 열기 →</Link>　<Link href="/work?role=legal">법제 작업실 열기 →</Link></p>
  </main>;
}
