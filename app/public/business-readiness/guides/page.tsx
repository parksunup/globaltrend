import Link from "next/link";
import { PublicFooter, PublicHeader } from "../../public-navigation";
import GuideReader from "./guide-reader";
import styles from "./guides.module.css";

export const metadata = {
  title: "국가별 개인정보 보호 안내서 · 기업 상담소 · 국제요정",
  description: "일본·중국·EU·영국·미국 캘리포니아주·싱가포르의 기업용 개인정보 보호 안내서를 한국어로 읽어보세요.",
};

export default function BusinessGuidesPage() {
  return <main className={styles.site}>
    <PublicHeader active="/public/business-readiness" />
    <section className={styles.hero}>
      <p className={styles.kicker}>BUSINESS PRIVACY GUIDES</p>
      <h1>국가별 안내서</h1>
      <p>해외 감독기구의 기업 안내자료를 바탕으로 정리한 한국어 학습본입니다. 개인정보보호위원회나 해당 해외 감독기구의 공식 유권해석·공식 번역 또는 법률 자문이 아닙니다. 최신 원문과 회사의 실제 상황을 확인하고 이에 따른 판단과 조치를 할 책임은 이용자에게 있습니다. 기준일과 자료 범위는 안내서 안에서 확인해 주세요.</p>
      <Link href="/public/business-readiness">기업 상담소로 돌아가기 →</Link>
    </section>
    <section className={styles.library} aria-label="관할별 안내서">
      <GuideReader />
    </section>
    <PublicFooter />
  </main>;
}
