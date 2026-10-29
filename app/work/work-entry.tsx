"use client";
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import TeamLogin from '../components/team-login';
import styles from './work-entry.module.css';
export default function WorkEntry(){const router=useRouter();return <main className={styles.entry}><p>국제요정 · 작업실</p><h1>담당자 작업실</h1><TeamLogin onSuccess={()=>router.refresh()}/><Link href="/public">← 공개 페이지로 돌아가기</Link></main>;}
