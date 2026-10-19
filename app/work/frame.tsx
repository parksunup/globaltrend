import Link from 'next/link';
import type {ReactNode} from 'react';
import {WorkTheme,WorkThemeToggle} from './work-theme';
import styles from './work.module.css';
export default function WorkFrame({children,active='materials'}:{children:ReactNode;active?:string}) {
 return <WorkTheme><main className={styles.page}><header className={styles.header}><Link href="/work"><strong>GlobalTrend</strong> 작업 공간</Link><Link href="/public">공개 사이트 보기 ↗</Link><WorkThemeToggle/></header>
 <nav className={styles.workNav} aria-label="작업 공간"><Link aria-current={active==='materials'?'page':undefined} href="/work">자료 관리</Link><Link aria-current={active==='weekly'?'page':undefined} href="/public/weekly">주간호</Link><Link aria-current={active==='collector'?'page':undefined} href="/work/collector">수집 상태</Link><Link href="/guide">도움말</Link></nav><div className={styles.wrap}>{children}</div></main></WorkTheme>;
}
