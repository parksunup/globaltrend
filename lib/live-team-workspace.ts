import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { loadSubmissionPreview, loadSubmissionDocuments } from './submission-preview.ts';
import { listLegalTranslationEntries, loadLegalTranslation } from './legal-translation-review.ts';
import type { LegalTranslationDocument } from './legal-translation-review.ts';

export const TEAM_BRANCHES = {
  trends: 'feat/trend-source-contracts', legal: 'feat/legal-corpus-foundation',
} as const;
export type TeamRole = keyof typeof TEAM_BRANCHES;
export type LiveWorkspace = {
  role: TeamRole; branch: string; commitSha: string; checkedAt: string;
  stale: boolean; error?: string;
  items: ReturnType<typeof loadSubmissionPreview>;
  documents: ReturnType<typeof loadSubmissionDocuments>;
  translations: LegalTranslationDocument[];
  translationErrors: {id: string; error: string}[];
  notes: {path: string; text: string}[];
};
type Entry = {path: string; type: string; size?: number};
const REPO = 'parksunup/globaltrend';
const INTERVAL = 120_000;
const MAX_BYTES = 24 * 1024 * 1024;

/** Only already-public, submitted repository data. No DB/publication-state dependency. */
export function createLiveWorkspaceReader(options: {fetch?: typeof fetch; now?: ()=>number; token?: string} = {}) {
  const request = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let heads: Record<string,string> = {}, headsAt = -Infinity;
  let pendingHeads: Promise<void> | undefined;
  const cache = new Map<TeamRole, LiveWorkspace>();
  const pending = new Map<TeamRole, Promise<LiveWorkspace>>();
  const retryAt = new Map<TeamRole, number>();

  async function response(url: string, api = true) {
    const result = await request(url, {cache:'no-store', signal:AbortSignal.timeout(20_000),
      headers:{'User-Agent':'globaltrend-team-review', ...(api && options.token ? {Authorization:`Bearer ${options.token}`} : {})}});
    if (!result.ok) throw Error(`GitHub 자료 읽기 실패 (${result.status}). ${result.status === 403 || result.status === 429 ? '요청 한도 또는 저장소 접근 상태를 확인해 주세요.' : '잠시 후 다시 확인해 주세요.'}`);
    return result;
  }
  async function refreshHeads() {
    if (now() - headsAt < INTERVAL) return;
    if (!pendingHeads) pendingHeads = (async () => {
      // Both assigned branches share one API request/cache rather than spending the public quota per viewer.
      const rows = await (await response(`https://api.github.com/repos/${REPO}/branches?per_page=100`)).json();
      if (!Array.isArray(rows)) throw Error('GitHub 브랜치 목록을 읽을 수 없습니다.');
      const next: Record<string,string> = {};
      for (const row of rows) if (Object.values(TEAM_BRANCHES).includes(row.name) && /^[a-f0-9]{40}$/.test(row.commit?.sha)) next[row.name] = row.commit.sha;
      heads = next; headsAt = now();
    })().finally(()=>{pendingHeads=undefined;});
    await pendingHeads;
  }
  async function update(role: TeamRole): Promise<LiveWorkspace> {
    try {
      await refreshHeads();
      const branch = TEAM_BRANCHES[role], sha = heads[branch];
      if (!sha) throw Error('배정된 담당 브랜치를 찾을 수 없습니다. 브랜치 삭제 또는 이름 변경 여부를 확인해 주세요.');
      const previous = cache.get(role);
      if (previous?.commitSha === sha) {
        const fresh = {...previous, checkedAt:new Date(now()).toISOString(), stale:false, error:undefined};
        cache.set(role,fresh); return fresh;
      }
      const listing = await (await response(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`)).json();
      if (listing.truncated || !Array.isArray(listing.tree)) throw Error('GitHub 자료 목록이 불완전합니다. 자료를 빈 목록으로 표시하지 않습니다.');
      const entries: Entry[] = listing.tree.filter((entry: Entry) => {
        if (entry.type !== 'blob') return false;
        const relevant = entry.path.startsWith(`data/${role === 'legal' ? 'legal' : 'trends'}/`) || (role === 'legal' && entry.path === 'data/derived/gdpr.json');
        if (!relevant) return false;
        if (entry.path.split('/').some(part=>part==='..' || part==='.' || !part) || /[\\\x00-\x1f]/.test(entry.path)) throw Error('제출 자료 경로가 올바르지 않습니다.');
        return /\.(json|csv|md)$/.test(entry.path);
      });
      if (entries.length > 350 || entries.some(e=>(e.size??0)>8*1024*1024) || entries.reduce((n,e)=>n+(e.size??0),0)>MAX_BYTES) throw Error('제출 자료 크기가 읽기 한도를 초과했습니다. 일부를 숨기지 않고 오류를 표시합니다.');
      const root = mkdtempSync(join(tmpdir(),'globaltrend-team-'));
      try {
        let cursor = 0, bytes = 0;
        const downloads = await Promise.allSettled(Array.from({length:Math.min(6,entries.length)},async()=>{
          while (cursor < entries.length) {
            const entry = entries[cursor++];
            const result = await response(`https://raw.githubusercontent.com/${REPO}/${sha}/${entry.path.split('/').map(encodeURIComponent).join('/')}`,false);
            const body = await result.text(); bytes += Buffer.byteLength(body);
            if (bytes > MAX_BYTES) throw Error('제출 자료 크기가 읽기 한도를 초과했습니다.');
            const path = join(root,...entry.path.split('/')); mkdirSync(dirname(path),{recursive:true}); writeFileSync(path,body);
          }
        }));
        const failed = downloads.find(result=>result.status==='rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        const translations: LegalTranslationDocument[] = [], translationErrors: LiveWorkspace['translationErrors'] = [];
        for (const entry of listLegalTranslationEntries(root)) {
          if ('error' in entry) translationErrors.push(entry);
          else { const document = loadLegalTranslation(entry.id,root); if (document) translations.push(document); }
        }
        const snapshot: LiveWorkspace = {role,branch,commitSha:sha,checkedAt:new Date(now()).toISOString(),stale:false,
          items:loadSubmissionPreview(root).filter(item=>item.group===role),documents:loadSubmissionDocuments(root),translations,translationErrors,
          // The formatted translation/comparison already contains these full bodies.
          // Do not duplicate megabytes of them in the supplementary notes response.
          notes:entries.filter(e=>e.path.endsWith('.md') &&
            !(e.path==='data/legal/criteria-mapping.md' && loadSubmissionDocuments(root).legal.length) &&
            !translations.some(document=>e.path===`data/legal/translations/${document.id}.md`))
            .map(e=>({path:e.path,text:readFileSync(join(root,...e.path.split('/')),'utf8')}))};
        cache.set(role,snapshot); return snapshot;
      } finally { rmSync(root,{recursive:true,force:true}); }
    } catch (error) {
      retryAt.set(role,now()+INTERVAL);
      const previous = cache.get(role);
      if (!previous) throw error;
      return {...previous,stale:true,error:error instanceof Error?error.message:'최신 자료 확인 실패'};
    }
  }
  return async (value: string): Promise<LiveWorkspace> => {
    if (value !== 'legal' && value !== 'trends') throw Error('담당은 legal 또는 trends여야 합니다.');
    if ((retryAt.get(value)??0)>now()) {
      const previous = cache.get(value);
      if (previous) return {...previous,stale:true,error:'최신 자료 확인에 실패해 잠시 후 재시도합니다. 마지막 성공본입니다.'};
      throw Error('최신 자료 접근 실패 후 재시도 대기 중입니다. 잠시 후 다시 확인해 주세요.');
    }
    if (!pending.has(value)) pending.set(value,update(value).finally(()=>pending.delete(value)));
    return pending.get(value)!;
  };
}

