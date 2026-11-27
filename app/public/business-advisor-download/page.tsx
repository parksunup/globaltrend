import Link from "next/link";
import { PublicFooter, PublicHeader } from "../public-navigation";
import styles from "./download.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "국제요정 상담소 · 국제요정",
  description: "국제요정 상담소를 내려받아 개인정보·데이터 정책 업무와 기업의 해외 진출 준비에 관한 질문을 안내서, 공개 자료, 웹 검색을 바탕으로 상담하세요.",
};

type ReleaseAsset = { name: string; browser_download_url: string; size: number; content_type?: string };
type GithubRelease = { tag_name: string; name: string | null; html_url: string; published_at: string | null; draft: boolean; prerelease: boolean; assets: ReleaseAsset[] };

async function latestDesktopRelease(): Promise<{ release: GithubRelease | null; unavailable: boolean }> {
  try {
    const response = await fetch("https://api.github.com/repos/parksunup/globaltrend/releases?per_page=30", {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store",
    });
    if (!response.ok) return { release: null, unavailable: true };
    const releases = await response.json() as GithubRelease[];
    const release = releases.find(item => /^business-advisor-v\d+\.\d+\.\d+/.test(item.tag_name) && !item.draft && !item.prerelease && item.assets.some(asset => ["InternationalFairyCounselorSetup.exe", "InternationalFairyCounselor.exe"].includes(asset.name)));
    return { release: release ?? null, unavailable: false };
  } catch {
    return { release: null, unavailable: true };
  }
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function BusinessAdvisorDownloadPage() {
  const { release, unavailable } = await latestDesktopRelease();
  const assets = release?.assets.filter(asset => ["InternationalFairyCounselorSetup.exe", "InternationalFairyCounselor.exe"].includes(asset.name)) ?? [];
  const hasInstaller = assets.some(asset => asset.name === "InternationalFairyCounselorSetup.exe");
  const version = release?.tag_name.replace(/^business-advisor-v/, "") ?? "";
  return <main className={styles.site}>
    <PublicHeader active="/public/business-advisor-download" />
    <section className={styles.hero}>
      <p className={styles.kicker}>GLOBALTREND · AI ADVISOR</p>
      <h1>국제요정 상담소</h1>
      <p className={styles.lede}>정책 담당자는 개인정보·데이터 정책 업무 중 궁금한 점을 자연어로 물어보고, 기업은 해외 진출과 개인정보 보호 준비를 상담할 수 있습니다. 국제요정의 안내서·상담사례·자가진단·공개 법제와 동향 자료, 웹 검색을 함께 참고합니다.</p>
    </section>
    <section className={styles.card}>
      {unavailable ? <>
        <p className={styles.status}>배포 정보를 확인할 수 없습니다</p>
        <h2>잠시 후 다시 확인해 주세요</h2>
        <p>GitHub Releases 연결이 응답하지 않아 내려받을 수 있는 버전을 확인하지 못했습니다.</p>
        <a className={styles.secondary} href="https://github.com/parksunup/globaltrend/releases" target="_blank" rel="noreferrer">GitHub Releases에서 직접 확인 ↗</a>
      </> : release ? <>
        <p className={styles.status}>최신 공개 버전 · {version}</p>
        <h2>국제요정 상담소 · {version}</h2>
        <p>{hasInstaller ? "Windows 64비트용 설치 파일입니다. 설치를 마친 뒤 자가진단 결과의 상담 버튼을 누르면 앱이 열립니다." : "현재 공개된 버전은 단일 실행 파일입니다. 자가진단 결과에서 앱으로 바로 연결하는 기능을 사용하려면 설치 버전이 공개될 때까지 기다려 주세요."} 출시 노트와 변경 사항은 GitHub에서 확인할 수 있습니다.</p>
        <div className={styles.assets}>{assets.map(asset => <a className={styles.download} key={asset.name} href={asset.browser_download_url}>
          <span><strong>국제요정 상담소 다운로드</strong><small>{asset.name} · {formatSize(asset.size)}</small></span><b aria-hidden="true">↓</b>
        </a>)}</div>
        <a className={styles.releaseLink} href={release.html_url} target="_blank" rel="noreferrer">버전 정보와 변경 내역 보기 ↗</a>
        <p className={styles.signatureNote}>현재 파일은 코드 서명 없이 배포됩니다. Windows에서 앱 실행 전 경고가 표시될 수 있습니다.</p>
      </> : <>
        <p className={styles.status}>아직 공개된 설치 파일이 없습니다</p>
        <h2>앱 배포를 준비하고 있습니다</h2>
        <p>앱은 별도 브랜치에서 개발·검토 중입니다. Windows 설치 파일은 빌드와 검토가 끝난 뒤 GitHub Releases에 게시되며, 이 페이지에 실제 다운로드 링크가 나타납니다.</p>
        <span className={styles.disabled}>공개 버전이 등록되면 다운로드할 수 있습니다</span>
        <a className={styles.releaseLink} href="https://github.com/parksunup/globaltrend/releases" target="_blank" rel="noreferrer">공개 릴리스 목록 보기 ↗</a>
      </>}
    </section>
    <section className={styles.details}>
      <h2>사용 방법</h2>
      <ol><li>Windows용 상담소 파일을 내려받습니다.</li><li>{hasInstaller ? "설치 파일을 실행해 앱을 설치합니다." : "파일을 열어 앱을 실행합니다. 자가진단 결과 연결에는 설치 버전이 필요합니다."} 앱에서 ChatGPT 계정을 연결할 때 로그인은 시스템 브라우저에서 진행됩니다.</li><li>자가진단 결과의 상담 버튼을 누르거나 앱에 직접 질문을 적어 대화를 이어갑니다.</li></ol>
      <p>ChatGPT 프로그램 설치는 필요하지 않습니다. 앱은 Codex 로그인이나 브라우저 쿠키를 읽지 않습니다. 상담 앱의 답변과 안내자료는 개인정보보호위원회나 해외 감독기구의 공식 유권해석 또는 법률 자문이 아닙니다. 최신 법령·공식 지침과 질문의 실제 상황을 확인하고 이에 따른 판단과 조치를 할 책임은 이용자에게 있습니다.</p>
      <p><Link href="/public/business-readiness">기업 자가진단으로 돌아가기 →</Link></p>
    </section>
    <PublicFooter />
  </main>;
}
