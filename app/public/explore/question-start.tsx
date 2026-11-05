import Link from 'next/link';
import {learningTopics,learningHref} from '../../../lib/public-learning';
import styles from './learning.module.css';
export default function QuestionStart() {
  return <section className={styles.section} aria-labelledby="question-start-title">
    <p className={styles.kicker}>생활에서 업무까지</p><h2 id="question-start-title">궁금한 질문으로 시작해 보세요</h2>
    <p>쉽게 이해하고, 나라별로 비교한 뒤, 근거 조문까지 살펴볼 수 있습니다.</p>
    <div className={styles.grid}>{learningTopics.map(topic=><Link prefetch={false} key={topic.id} className={styles.card} href={learningHref(topic.id)}><strong>{topic.question}</strong><span>{topic.criterionLabel} · 생활 속 의미와 업무 확인 질문 →</span></Link>)}</div>
  </section>;
}
