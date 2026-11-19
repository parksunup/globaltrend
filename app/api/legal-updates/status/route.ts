import {workspaceSession} from '../../../../lib/workspace-data';
import {loadWatchReport} from '../../../../lib/legal-watch-data';
import {pendingEvents} from '../../../../lib/legal-watch';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};const preview=process.env.VERCEL_ENV==='preview';let session:Awaited<ReturnType<typeof workspaceSession>>|undefined;
 try{session=await workspaceSession();}catch{if(!preview)return Response.json({error:'작업실 연결을 확인해 주세요.'},{status:503,headers});}
 if(!session?.canEdit)return Response.json({error:'팀 계정으로 로그인해 주세요.'},{status:session?.user?403:401,headers});
 try{const loaded=await loadWatchReport({allowRemote:!preview&&session?.canEdit===true});return Response.json({generatedAt:loaded.report.generatedAt,source:loaded.source,connection:loaded.connection,stale:loaded.stale,total:loaded.report.laws.length,pending:loaded.report.laws.filter(l=>pendingEvents(l).length).length,changed:loaded.report.laws.filter(l=>pendingEvents(l).some(e=>e.kind==='source_changed')).length,failed:loaded.report.laws.filter(l=>l.status==='error').length,partial:loaded.report.laws.filter(l=>l.status==='partial').length,directPending:loaded.report.laws.filter(l=>l.additionalDirectCheckNote).length},{headers});}catch{return Response.json({error:'점검 결과를 불러오지 못했습니다.'},{status:503,headers});}
}
