import Link from 'next/link';
import styles from './weekly-formats.module.css';

export default function WeeklyFormats({active}:{active:'written'|'podcast'}) {
  return <nav className={styles.formats} aria-label="주간호 자료 형식">
    <Link href="/public/weekly" aria-current={active==='written'?'page':undefined}>
      <span aria-hidden="true">▤</span><span><strong>서면 주간 동향</strong><small>한 주의 동향을 글로 읽기</small></span>
    </Link>
    <Link href="/public/weekly/podcast" aria-current={active==='podcast'?'page':undefined}>
      <span aria-hidden="true">♫</span><span><strong>팟캐스트</strong><small>주요 주제를 대화로 듣기</small></span>
    </Link>
  </nav>;
}
