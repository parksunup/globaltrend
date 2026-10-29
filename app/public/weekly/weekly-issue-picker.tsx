'use client';
import {useRouter} from 'next/navigation';
import styles from './weekly-issue-picker.module.css';

type IssueOption={issue_key:string;title:string;week_start:string;week_end:string};

export default function WeeklyIssuePicker({issues,selectedKey,basePath,label}:{issues:IssueOption[];selectedKey:string;basePath:string;label:string}){
 const router=useRouter();
 if(!issues.length)return null;
 return <nav className={styles.picker} aria-label={label}>
  <label htmlFor="weekly-issue-select">지난 호 선택</label>
  <select id="weekly-issue-select" value={selectedKey} onChange={event=>router.push(`${basePath}?issue=${encodeURIComponent(event.target.value)}`)}>
   {issues.map(issue=><option key={issue.issue_key} value={issue.issue_key}>{issue.issue_key} · {issue.week_start}–{issue.week_end} · {issue.title}</option>)}
  </select>
 </nav>;
}
