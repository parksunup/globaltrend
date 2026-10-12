import type { PublicFeedback } from "../../lib/public-feedback";
import styles from "./feedback.module.css";

export default function FeedbackList({ feedback }: { feedback: PublicFeedback[] }) {
  return <ol className={styles.list}>{feedback.map((entry) => <li key={entry.id} className={styles.entry}>
    <header><strong>{entry.author_name || "익명"}</strong><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (한국시간)</time></header>
    <p className={styles.body}>{entry.body}</p>
    <details><summary>의견이 남겨진 자료와 버전</summary><dl>
      <dt>브랜치</dt><dd>{entry.branch_name}</dd><dt>항목</dt><dd>{entry.item_id}</dd>
      <dt>작성 당시 커밋</dt><dd>{entry.commit_sha}</dd><dt>피드백 번호</dt><dd>{entry.id}</dd>
    </dl></details>
  </li>)}</ol>;
}
