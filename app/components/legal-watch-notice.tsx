'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Status={source:string;changed:number;pending:number;failed:number;partial:number;directPending?:number;stale:boolean};
export default function LegalWatchNotice(){
 const [status,setStatus]=useState<Status|null>(null);
 useEffect(()=>{const controller=new AbortController();let alive=true;const refresh=async()=>{try{const r=await fetch('/api/legal-updates/status',{cache:'no-store',signal:controller.signal});if(!r.ok){if(alive)setStatus(null);return;}const value=await r.json() as Status;if(alive)setStatus(value);}catch{if(alive)setStatus(null);}};void refresh();const timer=setInterval(refresh,300000);return()=>{alive=false;controller.abort();clearInterval(timer);};},[]);
 return <section aria-label="법령 변경 점검 안내" style={{padding:'14px 16px',border:'1px solid currentColor',borderRadius:8,margin:'16px 0'}}><strong>법령 변경 점검</strong>{status?<p role="status">변경 후보 검토 대기 {status.changed}개 · 초기 확인 포함 검토 대기 {status.pending}개 · 확인 실패 {status.failed}개 · 제한된 확인 {status.partial}개 · 추가 직접 대조 미완료 {status.directPending??0}개{status.source==='bundled'?' · 초기 수동 점검 자료':''}{status.stale?' · 오래된 점검 결과':''}</p>:<p>팀 계정으로 점검 결과와 판본 확인 상태를 확인해 주세요.</p>}<Link href="/work/legal-updates">변경 조항·영향 기준과 수정안 작성 요청 보기 →</Link></section>;
}
