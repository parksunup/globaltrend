import {NextResponse} from 'next/server';
import {podcastAdmin,podcastError} from '../../../../lib/podcast-server';
import {monthlyWeekIssueKey} from '../../../../lib/weekly-label';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:Request){
 try{
  const db=await podcastAdmin(request);
  const body=await request.json();
  const weekStart=typeof body.weekStart==='string'?body.weekStart:'';
  const date=new Date(`${weekStart}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)||Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==weekStart||date.getUTCDay()!==1)throw Error('월요일 시작일을 선택해 주세요.');
  const {data:issueKey,error}=await db.rpc('reserve_weekly_podcast_issue_key',{p_week_start:weekStart});
  if(error||typeof issueKey!=='string'||!issueKey.startsWith(`${monthlyWeekIssueKey(weekStart)}-`))throw Error('새 팟캐스트 회차를 예약하지 못했습니다.');
  return NextResponse.json({issueKey},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return podcastError(error);}
}
