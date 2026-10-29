export const PODCAST_DEDICATED_ACCOUNT='psunup@gmail.com';
export const PODCAST_RECONNECT_MAX_BYTES=131072;
const names=new Set(['SID','HSID','SSID','APISID','SAPISID','__Secure-1PSID','__Secure-3PSID','__Secure-1PAPISID','__Secure-3PAPISID','__Secure-1PSIDTS','__Secure-3PSIDTS','__Secure-1PSIDCC','__Secure-3PSIDCC','SIDCC','NID','AEC','SOCS']);
export function reconnectStorage(value:unknown){
 if(!value||typeof value!=='object')throw Error('로그인 정보를 확인할 수 없습니다.');
 const input=value as {email?:unknown;cookies?:unknown[]};
 if(input.email!==PODCAST_DEDICATED_ACCOUNT||!Array.isArray(input.cookies)||input.cookies.length>100)throw Error('팟캐스트 전용 Google 계정으로 로그인해 주세요.');
 const cookies=input.cookies.filter((c:any)=>c&&names.has(c.name)&&typeof c.value==='string'&&c.value.length>0&&c.value.length<16000&&['.google.com','google.com','notebooklm.google.com','notebook.google.com'].includes(c.domain)&&c.path==='/').map((c:any)=>({name:c.name,value:c.value,domain:c.domain,path:'/',expires:typeof c.expires==='number'?c.expires:-1,httpOnly:!!c.httpOnly,secure:!!c.secure,sameSite:['Strict','Lax','None'].includes(c.sameSite)?c.sameSite:'None'}));
 if(!['SID','__Secure-1PSIDTS'].every(n=>cookies.some(c=>c.name===n)))throw Error('Google 로그인을 마친 뒤 다시 연결해 주세요.');
 const result={cookies,origins:[],notebooklm:{account:{email:PODCAST_DEDICATED_ACCOUNT}}};
 if(Buffer.byteLength(JSON.stringify(result))>PODCAST_RECONNECT_MAX_BYTES)throw Error('로그인 정보 크기를 확인해 주세요.');
 return result;
}
