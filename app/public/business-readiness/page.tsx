import Link from "next/link";
import { PublicFooter, PublicHeader } from "../public-navigation";
import styles from "./business-readiness.module.css";
import BusinessReadinessFlow from "./business-readiness-flow";

export const metadata = {
  title: "해외 진출 개인정보 자가점검 · 국제요정",
  description: "진출 국가별 개인정보 보호 준비사항을 질문으로 점검하고 확인할 자료를 살펴봅니다.",
};

export default function BusinessReadinessPage() {
  return <main className={styles.site}>
    <PublicHeader active="/public/business-readiness" />
    <section className={styles.hero}>
      <p className={styles.kicker}>BUSINESS PRIVACY READINESS</p>
      <h1>해외 진출 전,<br />개인정보 보호 준비를 점검하세요</h1>
      <p className={styles.lede}>진출하려는 국가와 사업 상황을 선택하면 확인할 항목과 참고 근거를 안내합니다.</p>
    </section>
    <aside className={styles.prototypeNotice} role="note"><strong>자가점검 안내</strong><span>기존 7개 법제 번역은 사람 검수가 완료된 자료입니다. 이 페이지에서 새로 연결한 질문·조항과 보완 안내는 별도로 확인 중입니다. 결과는 실제 준수 판정이나 법률 자문이 아닙니다.</span></aside>
    <BusinessReadinessFlow />
    <section className={styles.nextStep}>
      <div><p className={styles.kicker}>LEGAL GUIDANCE PILOT</p><h2>근거를 확인하고 더 알아보기</h2><p>ChatGPT 계정으로 로그인해 공개 법령 설명자료를 바탕으로 질문할 수 있는 별도 앱을 시범 준비했습니다.</p></div>
      <div className={styles.nextLinks}>
        <Link href="/public/business-advisor-download">상담 앱 다운로드 <span aria-hidden="true">→</span></Link>
        <Link href="/public/laws">국가별 법제와 근거 보기 <span aria-hidden="true">→</span></Link>
      </div>
    </section>
    <p className={styles.legalNotice}>이 자가점검은 기업의 준비 상황을 돌아보기 위한 안내이며 법률 자문이나 법적 준수 판정이 아닙니다. 국가별 적용 범위와 최신 법령, 계약·사업 구조를 전문가와 별도로 확인해 주세요.</p>
    <PublicFooter />
  </main>;
}
