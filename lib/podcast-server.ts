import {createHash} from 'node:crypto';
import {createClient} from './supabase/server';
import type {PodcastStory} from './podcast-production';

export async function podcastAdmin(request?: Request) {
  if (request && request.headers.get('origin') !== new URL(request.url).origin) throw Error('국제요정 제작 화면에서 실행해 주세요.');
  const db = await createClient();
  const {data: {user}} = await db.auth.getUser();
  if (!user) throw Object.assign(Error('사이트 관리자 계정으로 로그인해 주세요.'), {status: 401});
  const {data, error} = await db.from('team_memberships').select('role,is_active').eq('user_id', user.id).maybeSingle();
  if (error || !data?.is_active || data.role !== 'admin') throw Object.assign(Error('총괄 관리자 계정이 필요합니다.'), {status: 403});
  return db;
}
export function podcastError(error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 400;
  return Response.json({error: error instanceof Error ? error.message : '작업을 처리하지 못했습니다.'}, {status, headers: {'Cache-Control': 'private, no-store'}});
}
export const storyHash = (stories: PodcastStory[]) => createHash('sha256').update(JSON.stringify(stories)).digest('hex');
export async function podcastStories(db: Awaited<ReturnType<typeof podcastAdmin>>, ids?: string[]): Promise<PodcastStory[]> {
  const result: PodcastStory[] = [];
  for (let offset = 0; ; offset += 200) {
    let query = db.from('reports').select('id,source_item_id,title_ko,one_line_summary_ko,detailed_summary_ko').eq('status','published').order('id').range(offset, offset + 199);
    if (ids) query = query.in('id', ids);
    const {data: rows, error} = await query;
    if (error) throw Error('공개 동향을 불러오지 못했습니다.');
    if (!rows?.length) break;
    const {data: originals, error: sourceError} = await db.from('source_items').select('id,canonical_url,published_at,title_original').in('id', rows.map(row => row.source_item_id));
    if (sourceError) throw Error('동향의 공식 출처를 불러오지 못했습니다.');
    for (const row of rows) {
      const source = originals?.find(original => original.id === row.source_item_id);
      if (!source) throw Error('공식 출처가 없는 동향이 있습니다.');
      result.push({id:row.id, title:row.title_ko, summary:row.one_line_summary_ko ?? '', details:row.detailed_summary_ko ?? '', officialUrl:source.canonical_url, officialDate:source.published_at?.slice(0,10) ?? '', source:new URL(source.canonical_url).hostname});
    }
    if (rows.length < 200) break;
  }
  return ids ? ids.map(id => {const story = result.find(row => row.id === id); if (!story) throw Error('선택한 동향이 공개 상태가 아닙니다.'); return story;}) : result;
}
export function productionPublication() {
  if (process.env.NODE_ENV !== 'production') throw Object.assign(Error('로컬 개발 화면에서는 공개할 수 없습니다. 배포된 제작 화면에서 실행해 주세요.'), {status:409});
}
