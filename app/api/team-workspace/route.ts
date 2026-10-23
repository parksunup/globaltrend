import { createLiveWorkspaceReader } from '../../../lib/live-team-workspace';
// Next Data Cache is shared across instances. Browser traffic must not multiply
// unauthenticated GitHub requests for the same branch list or immutable files.
const readLiveWorkspace = createLiveWorkspaceReader({
  token:process.env.TEAM_GITHUB_READ_TOKEN,
  fetch:(url,init)=>fetch(url,{...init,cache:'force-cache',next:{revalidate:String(url).includes('/branches?')?120:86400}}),
});
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const role = new URL(request.url).searchParams.get('role');
  const headers = {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
  if (role !== 'legal' && role !== 'trends') return Response.json({error:'법제 또는 동향 담당을 선택해 주세요.'},{status:400,headers});
  try {
    const data = await readLiveWorkspace(role);
    const etag = '"' + role + '-' + data.commitSha + '"';
    if (!data.stale && request.headers.get('if-none-match') === etag) return new Response(null,{status:304,headers:{...headers,ETag:etag}});
    return Response.json(data,{headers:{...headers,ETag:etag}});
  } catch (error) {
    console.error('Team workspace read failed:',error instanceof Error?error.message:'unknown');
    return Response.json({error:'최신 제출 자료를 읽지 못했습니다. GitHub 연결·요청 한도·담당 브랜치 상태를 확인해 주세요. 발행 권한 때문에 숨긴 것이 아닙니다.'},{status:503,headers});
  }
}
