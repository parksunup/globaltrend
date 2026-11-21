import Link from "next/link";
import { PublicFooter, PublicHeader } from "../public-navigation";
import styles from "./business-readiness.module.css";
import BusinessReadinessFlow from "./business-readiness-flow";

export const metadata = {
  title: "기업 상담소 · 국제요정",
  description: "진출 국가별 개인정보 보호 준비사항을 질문으로 점검하고 확인할 자료를 살펴봅니다.",
};

export default function BusinessReadinessPage() {
  return <main className={styles.site}>
    <PublicHeader active="/public/business-readiness" />
    <section className={styles.hero}>
      <p className={styles.kicker}>BUSINESS PRIVACY READINESS</p>
      <h1>해외 진출 전,<br />개인정보 보호 준비를 점검하세요</h1>
      <p className={styles.lede}>진출 지역을 고르면 그 지역 안내서에 맞춘 쉬운 질문을 차례로 보여드립니다. 답을 바탕으로 더 살펴볼 자료와 준비할 일을 정리합니다.</p>
    </section>
    <aside className={styles.prototypeNotice} role="note"><strong>자가점검 안내</strong><span>일본·중국·EU·영국·캘리포니아·싱가포르 질문을 각각 다른 안내서에 근거해 구성했습니다. 이 자가점검은 개인정보보호위원회나 해외 감독기구의 공식 유권해석 또는 법률 자문이 아니며, 이용자의 답변을 바탕으로 준비 상황을 정리할 뿐 법률상 준수 여부나 위반 여부를 판정하지 않습니다. 실제 적용 판단과 조치의 책임은 이용자에게 있습니다.</span></aside>
    <BusinessReadinessFlow />
    <section className={styles.nextStep}>
      <div><p className={styles.kicker}>LEGAL GUIDANCE PILOT</p><h2>궁금한 점을 이어서 상담하기</h2><p>ChatGPT 계정을 연결하고 자연어로 질문해 주세요. 국제요정의 안내서·상담사례·자가점검·공개 자료와 가능한 경우 웹 검색을 함께 참고해 대화합니다.</p></div>
      <div className={styles.nextLinks}>
        <Link href="/public/business-readiness/guides">국가별 안내서 읽기 <span aria-hidden="true">→</span></Link>
        <Link href="/public/business-advisor-download">상담 앱 다운로드 <span aria-hidden="true">→</span></Link>
        <Link href="/public/laws">국가별 법제와 근거 보기 <span aria-hidden="true">→</span></Link>
      </div>
    </section>
    <p className={styles.legalNotice}>이 서비스의 자가점검·안내·상담 답변은 개인정보보호위원회나 해외 감독기구의 공식 유권해석 또는 법률 자문이 아닙니다. 질문 답변은 이용자가 입력한 내용을 바탕으로 한 참고 정보이며, 최신 법령·공식 지침과 회사의 실제 상황을 확인하고 이에 따른 판단과 조치를 할 책임은 이용자에게 있습니다.</p>
    <PublicFooter />
  </main>;
}
