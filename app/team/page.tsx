import {redirect} from 'next/navigation';
export default async function TeamPage({searchParams}:{searchParams:Promise<{role?:string;view?:string}>}){
 const {role,view}=await searchParams;
 const query=new URLSearchParams();if(role==='legal')query.set('role','legal');if(view==='weekly')query.set('view','weekly');
 redirect(`/work${query.size?`?${query}`:''}`);
}
