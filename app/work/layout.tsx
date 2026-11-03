import Link from 'next/link';
import {createClient} from '../../lib/supabase/server';
import WorkEntry from './work-entry';
export default async function WorkLayout({children}:{children:React.ReactNode}){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return <WorkEntry/>;
 const {data}=await db.from('team_memberships').select('role,is_active').eq('user_id',user.id).maybeSingle();
 if(!data?.is_active||!['admin','editor'].includes(data.role))return <main style={{maxWidth:640,margin:'60px auto',padding:24}}><h1>작업실 접근 권한이 필요합니다</h1><p>팀 관리자에게 담당자 등록을 요청해 주세요.</p><Link href="/public">공개 페이지로 돌아가기</Link></main>;
 return children;
}
