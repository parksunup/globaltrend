import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {validateWatchReport,type WatchReport,type WatchSource} from './legal-watch.ts';
export const WATCH_REPO='parksunup/globaltrend';
export const WATCH_WORKFLOW='legal-amendment-watch.yml';
export const watchSources=()=>JSON.parse(readFileSync(join(process.cwd(),'config/legal-watch/sources.json'),'utf8')).sources as WatchSource[];
function checksum(bytes:Buffer){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** Bounded ZIP reader for the two JSON members uploaded by the trusted workflow. */
export function reportFromArchive(zip:Buffer):unknown{
 if(zip.length>8_000_000)throw Error('archive_too_large');
 let end=-1;for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw Error('invalid_archive');const entries=zip.readUInt16LE(end+10);if(entries>2)throw Error('unexpected_members');let offset=zip.readUInt32LE(end+16);let result:unknown;const names=new Set<string>();
 for(let i=0;i<entries;i++){
  if(offset+46>zip.length||zip.readUInt32LE(offset)!==0x02014b50)throw Error('invalid_archive');
  const method=zip.readUInt16LE(offset+10),size=zip.readUInt32LE(offset+20),expanded=zip.readUInt32LE(offset+24),nameLength=zip.readUInt16LE(offset+28),extra=zip.readUInt16LE(offset+30),comment=zip.readUInt16LE(offset+32),local=zip.readUInt32LE(offset+42);
  const name=zip.subarray(offset+46,offset+46+nameLength).toString();if(names.has(name)||!['report.json','checkpoint.json'].includes(name)||expanded>4_000_000||local+30>zip.length||zip.readUInt32LE(local)!==0x04034b50||zip.readUInt16LE(offset+8)&1)throw Error('unsafe_archive');
  names.add(name);
  if(name==='report.json'){
   const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);if(start+size>zip.length)throw Error('invalid_archive');const compressed=zip.subarray(start,start+size);
   const raw=method===0?compressed:method===8?inflateRawSync(compressed,{maxOutputLength:4_000_000}):null;if(!raw||raw.length!==expanded||checksum(raw)!==zip.readUInt32LE(offset+16))throw Error('invalid_archive');result=JSON.parse(raw.toString('utf8'));
  }
  offset+=46+nameLength+extra+comment;
 }
 if(!result)throw Error('missing_report');return result;
}
async function limited(response:Response,max:number){if(!response.ok||Number(response.headers.get('content-length')??0)>max)throw Error('report_unavailable');const reader=response.body?.getReader();if(!reader)throw Error('empty_response');let size=0;const chunks:Uint8Array[]=[];try{for(;;){const c=await reader.read();if(c.done)break;size+=c.value.byteLength;if(size>max){await reader.cancel();throw Error('response_too_large');}chunks.push(c.value);}}finally{reader.releaseLock();}return Buffer.concat(chunks);}
export async function loadWatchReport(options:{allowRemote?:boolean;fetch?:typeof fetch;token?:string;initial?:unknown}={}){
 const sources=watchSources(),initial=options.initial??JSON.parse(readFileSync(join(process.cwd(),'data/legal-watch/initial-report.json'),'utf8'));
 const fallback=validateWatchReport(initial,sources),token=options.token??process.env.TEAM_GITHUB_READ_TOKEN;
 let connection:'not_configured'|'unavailable'|'connected'='not_configured',source:'bundled'|'github'='bundled',report:WatchReport=fallback,runUrl:string|undefined;
 if(options.allowRemote!==false&&token){
  try{
   const fetcher=options.fetch??fetch;const api=async(path:string)=>{
    const r=await fetcher('https://api.github.com/repos/'+WATCH_REPO+'/'+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},cache:'no-store',signal:AbortSignal.timeout(8000),redirect:'error'});return JSON.parse((await limited(r,2_000_000)).toString());
   };
   const runs=await api('actions/workflows/'+WATCH_WORKFLOW+'/runs?branch=main&per_page=10');
   const trusted=(runs.workflow_runs??[]).filter((r:{event:string;head_branch:string;head_repository?:{full_name:string};path:string})=>['schedule','workflow_dispatch'].includes(r.event)&&r.head_branch==='main'&&r.head_repository?.full_name===WATCH_REPO&&r.path==='.github/workflows/'+WATCH_WORKFLOW);
   const completed=trusted.filter((r:{status:string})=>r.status==='completed');if(completed[0]&&completed[0].conclusion!=='success')throw Error('latest_run_failed');
   const run=trusted.find((r:{conclusion:string})=>r.conclusion==='success');if(!run)throw Error('no_scheduled_report');
   const artifacts=await api('actions/runs/'+run.id+'/artifacts');const artifact=artifacts.artifacts.find((a:{name:string;expired:boolean})=>a.name==='legal-amendment-watch'&&!a.expired);if(!artifact||!Number.isSafeInteger(artifact.id))throw Error('missing_artifact');
   let response=await fetcher(`https://api.github.com/repos/${WATCH_REPO}/actions/artifacts/${artifact.id}/zip`,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(8000)});
   if([301,302,303,307,308].includes(response.status)){
    const target=new URL(response.headers.get('location')??'');if(target.protocol!=='https:'||target.username||target.password||!['.blob.core.windows.net','.githubusercontent.com'].some(suffix=>target.hostname.endsWith(suffix)))throw Error('unapproved_artifact_host');
    response=await fetcher(target,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
   }
   report=validateWatchReport(reportFromArchive(await limited(response,8_000_000)),sources);source='github';connection='connected';runUrl=`https://github.com/${WATCH_REPO}/actions/runs/${run.id}`;
  }catch{connection='unavailable';}
 }
 return {report,source,connection,runUrl,stale:Date.now()-Date.parse(report.generatedAt)>14*86400000};
}
