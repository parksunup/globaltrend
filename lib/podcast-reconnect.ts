export const PODCAST_DEDICATED_ACCOUNT='psunup@gmail.com';
export const PODCAST_RECONNECT_MAX_BYTES=131072;
const names=new Set(['SID','HSID','SSID','APISID','SAPISID','LSID','OSID','__Secure-1PSID','__Secure-3PSID','__Secure-1PAPISID','__Secure-3PAPISID','__Secure-1PSIDTS','__Secure-3PSIDTS','__Secure-1PSIDCC','__Secure-3PSIDCC','SIDCC','NID','AEC','SOCS']);
export function reconnectStorage(value:unknown){
 if(!value||typeof value!=='object')throw Error('로그인 정보를 확인할 수 없습니다.');
 const input=value as {email?:unknown;cookies?:unknown[]};
 if(input.email!==PODCAST_DEDICATED_ACCOUNT||!Array.isArray(input.cookies)||input.cookies.length>100)throw Error('팟캐스트 전용 Google 계정으로 로그인해 주세요.');
 const allowedDomains=new Set(['google.com','accounts.google.com','notebooklm.google.com','notebook.google.com']);
 const cookies=input.cookies.filter((c:any)=>c&&names.has(c.name)&&typeof c.value==='string'&&c.value.length>0&&c.value.length<16000&&typeof c.domain==='string'&&allowedDomains.has(c.domain.replace(/^\./,''))&&c.path==='/').map((c:any)=>({name:c.name,value:c.value,domain:c.domain,path:'/',expires:typeof c.expires==='number'?c.expires:-1,httpOnly:!!c.httpOnly,secure:!!c.secure,sameSite:['Strict','Lax','None'].includes(c.sameSite)?c.sameSite:'None'}));
 const cookieNames=new Set(cookies.map(c=>c.name));
 if(!cookieNames.has('SID')||!cookieNames.has('__Secure-1PSIDTS')&&!cookieNames.has('OSID')&&!(cookieNames.has('APISID')&&cookieNames.has('SAPISID')))throw Error('Google 로그인 세션이 자동 제작에 필요한 상태인지 확인해 주세요.');
 const result={cookies,origins:[],notebooklm:{account:{email:PODCAST_DEDICATED_ACCOUNT}}};
 if(Buffer.byteLength(JSON.stringify(result))>PODCAST_RECONNECT_MAX_BYTES)throw Error('로그인 정보 크기를 확인해 주세요.');
 return result;
}

export function reconnectQueueError(error:{code?:string;message?:string}){
 const known:Record<string,[string,string,number]>={
  'reconnection busy':['RECONNECT_BUSY','다른 연결 확인이 진행 중입니다. 기존 요청 상태를 확인하고 있습니다.',409],
  'invalid cookie scope':['RECONNECT_COOKIE_SCOPE','허용된 Google 쿠키 범위를 확인하지 못했습니다.',400],
  'incomplete dedicated session':['RECONNECT_COOKIE_INCOMPLETE','필수 Google 인증 쿠키가 부족합니다.',400],
  'reconnection rollout pending':['RECONNECT_NOT_READY','서버 연결 기능이 아직 준비되지 않았습니다.',503],
  'administrator only':['RECONNECT_ADMIN_REQUIRED','관리자 로그인을 확인해 주세요.',403]
 };
 const [code,message,status]=known[error.message??'']??['RECONNECT_QUEUE_FAILED','서버가 연결 요청을 저장하지 못했습니다.',500];
 return {status,error:'['+code+'] '+message,diagnostics:{stage:'queue_reconnect',code,sqlState:/^[A-Z0-9]{5}$/.test(error.code??'')?error.code:undefined}};
}
export function reconnectIsPending(value:{result?:string;requestedAt?:string}|null){
 const age=Date.now()-Date.parse(value?.requestedAt??'');
 return value?.result==='pending'&&age>=0&&age<15*60*1000;
}
