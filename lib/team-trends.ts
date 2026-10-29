import { createHash } from 'node:crypto';
import type { LiveWorkspace } from './live-team-workspace.ts';
import {trendEditMatchesRow} from './team-trend-publication.ts';

export type TeamTrend = {
  id:string; revision:string; title_ko:string; summary_ko:string; details_ko:string;
  original_title:string; official_url:string; source_name:string; published_date:string;
  jurisdictions:string[]; topics:string[]; status:string;
  editFile?:string; editState?:'applied'|'synced'|'conflict'; proposedEdit?:TrendEdit;
  workspace_revision?:number; workspaceEdit?:TrendEdit;
};
export type TrendEdit = {report_id:string;base_revision:string;title_ko:string;summary_ko:string;details_ko:string};
export function parseTrendEdit(value:unknown):TrendEdit {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('원고 수정본은 JSON 객체여야 합니다.');
  const row=value as Record<string,unknown>;
  if(Object.keys(row).some(key=>!['report_id','base_revision','title_ko','summary_ko','details_ko'].includes(key)))throw Error('수정본에는 지정된 다섯 필드만 사용해 주세요.');
  if(typeof row.report_id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(row.report_id)||typeof row.base_revision!=='string'||!/^[a-f0-9]{32}$/.test(row.base_revision))throw Error('원고 ID 또는 기준 판본이 올바르지 않습니다.');
  for(const key of ['title_ko','summary_ko','details_ko'])if(typeof row[key]!=='string'||!row[key].trim()||row[key].length>100000)throw Error(`${key}에 비어 있지 않은 한국어 내용을 작성해 주세요.`);
  return row as unknown as TrendEdit;
}
export function composeTeamTrends(rows:TeamTrend[],snapshot:LiveWorkspace,edits:TrendEdit[]) {
  const ids=new Set(rows.map(row=>row.id));
  if(new Set(edits.map(edit=>edit.report_id)).size!==edits.length)throw Error('같은 원고의 수정본이 중복되었습니다.');
  const warnings:string[]=[];
  const byId=new Map([...edits,...rows.flatMap(row=>row.workspaceEdit?[row.workspaceEdit]:[])].map(edit=>[edit.report_id,edit]));
  for(const edit of edits)if(!ids.has(edit.report_id))warnings.push(`원고 ${edit.report_id}가 현재 DB 목록에 없습니다. 수정본을 삭제하지 말고 확인해 주세요.`);
  const items=rows.map(row=>{
    const edit=byId.get(row.id);
    const editFile=`.team-workspace/edits/${row.id}.json`;
    if(!edit)return {...row,editFile};
    // Publishing changes the report status and its calculated revision. An edit
    // already present in the working copy is synchronized, not a conflict.
    if(trendEditMatchesRow(edit,row))return {...row,editFile,editState:'synced' as const};
    if(edit.base_revision!==row.revision){warnings.push(`${row.id}: 기준 원고가 바뀌어 수정본 자동 적용을 보류했습니다.`);return {...row,editFile,editState:'conflict' as const,proposedEdit:edit};}
    return {...row,title_ko:edit.title_ko,summary_ko:edit.summary_ko,details_ko:edit.details_ko,editFile,editState:'applied' as const};
  });
  const urls=new Set(rows.map(row=>row.official_url));
  // Newly researched repository articles also participate, without duplicating DB originals.
  for(const item of snapshot.items.filter(item=>item.kind==='동향 표본')) {
    const url=item.links.find(link=>link.label==='공식 원문')?.url??'';
    if(urls.has(url))continue;
    if(url)urls.add(url);
    items.push({id:item.id,revision:snapshot.commitSha,title_ko:item.title,summary_ko:item.summary,details_ko:item.fields.find(field=>field.label==='주요 내용')?.value??'',original_title:item.subtitle,official_url:url,source_name:item.fields.find(field=>field.label==='기관')?.value??'',published_date:item.fields.find(field=>field.label==='게시일')?.value??'',jurisdictions:[],topics:[],status:'repository',editFile:'data/trends/editorial/report-drafts.json'});
  }
  return {items,warnings,revision:createHash('sha256').update(JSON.stringify(items)).digest('hex')};
}

export async function loadTeamTrendRows(options:{url?:string;key?:string;fetch?:typeof fetch;readPage?:(offset:number)=>Promise<unknown>}={}):Promise<TeamTrend[]> {
  const url=options.url??process.env.NEXT_PUBLIC_SUPABASE_URL,key=options.key??process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!options.readPage&&(!url||!key))throw Error('작업실 원고 읽기 연결이 설정되지 않았습니다.');
  const request=options.fetch??fetch,rows:TeamTrend[]=[];
  let offset=0;
  for(;;){
    const response=options.readPage?Response.json(await options.readPage(offset)):await request(`${url!.replace(/\/$/,'')}/rest/v1/rpc/get_team_trend_workspace`,{method:'POST',headers:{apikey:key!,'Content-Type':'application/json'},body:JSON.stringify({p_offset:offset,p_limit:200}),cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`작업실 원고 읽기 실패 (${response.status}). 담당자의 DB 관리 권한이 아니라 서버 읽기 경로를 확인해야 합니다.`);
    const data=await response.json();
    if(!data||!Array.isArray(data.items)||!Number.isInteger(data.total))throw Error('작업실 원고 응답 형식이 올바르지 않습니다.');
    for(const row of data.items){
      if(!row||typeof row.id!=='string'||typeof row.revision!=='string'||typeof row.title_ko!=='string'||typeof row.summary_ko!=='string'||typeof row.details_ko!=='string')throw Error('작업실 원고 필수 필드가 없습니다.');
      // Whitelist output, even if a future RPC mistakenly adds internal fields.
      rows.push({id:row.id,revision:row.revision,title_ko:row.title_ko,summary_ko:row.summary_ko,details_ko:row.details_ko,original_title:row.original_title??'',official_url:row.official_url??'',source_name:row.source_name??'',published_date:row.published_date??'',jurisdictions:Array.isArray(row.jurisdictions)?row.jurisdictions:[],topics:Array.isArray(row.topics)?row.topics:[],status:row.status??'draft',workspace_revision:Number.isSafeInteger(row.workspace_revision)?row.workspace_revision:0,...(row.workspace_edit?{workspaceEdit:parseTrendEdit(row.workspace_edit)}:{})});
    }
    if(data.nextOffset===null)break;
    if(!Number.isInteger(data.nextOffset)||data.nextOffset<=offset||!data.items.length)throw Error('다음 원고 페이지를 확인할 수 없습니다.');
    offset=data.nextOffset;
  }
  if(new Set(rows.map(row=>row.id)).size!==rows.length)throw Error('원고 목록이 조회 중 변경되었습니다. 다시 확인해 주세요.');
  return rows;
}
