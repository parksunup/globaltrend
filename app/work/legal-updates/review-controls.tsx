'use client';
import {useState} from 'react';
export default function ReviewControls({lawId,packet}:{lawId:string;packet:{request:string;[key:string]:unknown}}){
 const [message,setMessage]=useState(''),[show,setShow]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(packet.request);setMessage('수정안 작성 요청을 복사했습니다. 법제 담당 Codex 대화에 붙여 넣어 주세요.');}catch{setShow(true);setMessage('아래 요청문을 직접 복사해 주세요.');}}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`legal-review-${lawId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('검토 패킷을 내려받았습니다. 저장·공개는 수행하지 않았습니다.');}
 return <div><p><button type="button" onClick={copy}>Codex 수정안 작성 요청 복사</button>{' '}<button type="button" onClick={download}>검토 패킷 JSON 받기</button>{' '}<button type="button" aria-expanded={show} onClick={()=>setShow(!show)}>요청문 {show?'접기':'보기'}</button></p><p role="status">{message}</p>{show&&<label>법제 담당자에게 전달할 요청문<textarea readOnly value={packet.request} rows={15} style={{width:'100%',boxSizing:'border-box'}}/></label>}</div>;
}
