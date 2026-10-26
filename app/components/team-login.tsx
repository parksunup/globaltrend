'use client';
import {useState} from 'react';
import {createClient} from '../../lib/supabase/client';
export default function TeamLogin({onSuccess}:{onSuccess:()=>void}) {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <form onSubmit={async event=>{
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    const form=event.currentTarget,fields=new FormData(form);
    try {const {error}=await createClient().auth.signInWithPassword({email:String(fields.get('email')),password:String(fields.get('password'))});
      if(error)throw error;form.reset();onSuccess();
    }catch {setError('로그인하지 못했습니다. 계정과 비밀번호를 확인해 주세요.');}finally{setBusy(false);}
  }}><h2>팀 계정 로그인</h2><p>현재 사이트에서 사용하는 팀 계정으로 로그인하세요. Supabase·Vercel 계정이 아닙니다.</p><label>이메일 <input name="email" type="email" autoComplete="username" required/></label> <label>비밀번호 <input name="password" type="password" autoComplete="current-password" required/></label> <button disabled={busy}>{busy?'로그인 중…':'로그인'}</button>{error&&<p role="alert">{error}</p>}</form>;
}
