import Link from 'next/link';
import styles from './weekly-issue-picker.module.css';

type IssueOption={issue_key:string;title:string;week_start:string;week_end:string};

export default function WeeklyIssuePicker({issues,selectedKey,basePath,label}:{issues:IssueOption[];selectedKey:string;basePath:string;label:string}){
 if(!issues.length)return null;
 return <nav className={styles.picker} aria-label={label}>
  <h2>지난 호 선택</h2>
  <ul>{issues.map(issue=><li key={issue.issue_key}>
   <Link href={`${basePath}?issue=${encodeURIComponent(issue.issue_key)}`} aria-current={issue.issue_key===selectedKey?'page':undefined}>
    <span>{issue.issue_key} · {issue.week_start}–{issue.week_end}</span><strong>{issue.title}</strong>
   </Link>
  </li>)}</ul>
 </nav>;
}
