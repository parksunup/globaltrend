import { publicTopics, matchesPublicTopic } from './public-topics.ts';
/** Search only over the public corpus supplied by the server; scores are not legal judgments. */
export type SearchDocument = {
    id: string;
    kind: 'trend' | 'comparison' | 'article';
    title: string;
    text: string;
    url: string;
    jurisdictions: string[];
    tags: string[];
    date: string;
    version: string;
    sourceUrl: string;
    criterionId?: string;
    lawId?: string;
    lawTitle?: string;
};
export type SearchFilters = {
    q: string;
    scope: 'all' | 'trends' | 'laws';
    mode: 'hybrid' | 'keyword';
    countries: string[];
    topic: string;
    from: string;
    to: string;
    sort: 'relevance' | 'newest';
    page: number;
    errors: string[];
};
export type SemanticHit = {
    id: string;
    score: number;
};
export type SearchHit = {
    document: SearchDocument;
    reasons: string[];
    snippet: string;
    score: number;
};
export const quickSearchQuestions = [
    '해외 서비스도 한국법의 적용을 받나요?', '아이의 개인정보는 어떻게 보호하나요?',
    '개인정보가 해외로 가면 무엇을 확인하나요?', '내 정보를 열람하거나 삭제해 달라고 할 수 있나요?',
    '내 개인정보를 이용하려면 꼭 동의를 받아야 하나요?', '개인정보 유출 소식을 들으면 무엇을 확인하나요?',
];
export const searchConcepts = [
    { label: '역외 적용', criteria: ['extraterritorial_scope'], aliases: ['역외적용', '해외서비스', '외국서비스', '해외사업자', '외국사업자'], terms: ['역외', '국외 사업자', '외국 사업자', 'territorial scope'] },
    { label: '아동 개인정보', criteria: ['children_information'], aliases: ['아이', '아동', '어린이', '청소년', '미성년', 'children', 'minor'], terms: ['아동', '청소년', '미성년', '어린이', 'children'] },
    { label: '국외이전', criteria: ['cross_border_transfer'], aliases: ['국외이전', '해외로', '해외이전', '외국으로', '국경간', 'crossborder'], terms: ['국외이전', '국외 이전', '외국', '국외', 'cross-border', 'transfer'] },
    { label: '정보주체 권리', criteria: ['data_subject_rights'], aliases: ['열람', '삭제', '정정', '내정보보기', '이동권', '전송요구', 'data subject right'], terms: ['열람', '삭제', '정정', '이동권', '정보주체 권리', 'erasure'] },
    { label: '개인정보 이용 근거', criteria: ['processing_basis_use', 'processing_basis_collection'], aliases: ['동의', '처리근거', '이용근거', '수집근거', 'legalbasis', 'lawfulbasis', 'consent'], terms: ['동의', '정당한 이익', '처리근거', '법적 의무', 'consent'] },
    { label: '유출 통지·신고', criteria: ['breach_notification'], aliases: ['유출', '해킹', '침해사고', '새어나', '정보가샜', 'breach'], terms: ['유출', '침해', '통지', '신고', 'breach'] },
];
const stopWords = new Set(['내', '제', '저', '우리', '정보', '개인정보', '관련', '자료', '어떤', '어떻게', '무엇을', '무엇', '꼭', '수', '할', '있나요', '하나요', '되나요', '때', '하려면', '받아야', '알려', '주세요', '궁금합니다', '필요한가요', '찾아주세요']);
const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] ?? '' : v ?? '';
export function normalizeSearchText(value: string): string {
    return value.normalize('NFKC').toLocaleLowerCase().replace(/제\s*(\d+(?:의\d+)?)\s*조/g, '제$1조').replace(/article\s+(\d+)/g, '제$1조').replace(/[^\p{L}\p{N}.]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function searchTokens(value: string): string[] {
    const all = normalizeSearchText(value).split(' ').filter(Boolean).map(word => word.replace(/(?:으로|에서|에게|하려면|할까요|인가요|나요|를|을|은|는|의|가|이|도)$/u, suffix => word.length - suffix.length >= 2 ? '' : suffix));
    const useful = all.filter(word => !stopWords.has(word));
    return [...new Set(useful.length ? useful : all)];
}
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
export function parseSearchFilters(params: Record<string, string | string[] | undefined>, now = new Date()): SearchFilters {
    const errors: string[] = [], raw = first(params.q).normalize('NFKC').trim(), q = Array.from(raw).slice(0, 300).join('');
    if (Array.from(raw).length > 300)
        errors.push('검색 질문은 300자 이내로 입력해 주세요.');
    if (raw && !normalizeSearchText(raw))
        errors.push('검색할 단어나 질문을 입력해 주세요.');
    const scope = first(params.scope), mode = first(params.mode), sort = first(params.sort);
    let from = first(params.from), to = first(params.to);
    const period = first(params.period);
    if (['최근 1개월', '최근 6개월', '최근 1년'].includes(period)) {
        to = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
        const start = new Date(to + 'T00:00:00Z');
        const day = start.getUTCDate();
        start.setUTCDate(1);
        start.setUTCMonth(start.getUTCMonth() - (period === '최근 1개월' ? 1 : period === '최근 6개월' ? 6 : 12));
        start.setUTCDate(Math.min(day, new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()));
        from = start.toISOString().slice(0, 10);
    }
    if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to))
        errors.push('검색 기간의 시작일과 종료일을 확인해 주세요.');
    const rawCountries = Array.isArray(params.country) ? params.country : [first(params.country)];
    const countries = [...new Set(rawCountries.flatMap(value => value.split(',')).filter(code => /^[a-zA-Z0-9:-]{1,40}$/.test(code)).map(code => code === 'UK' ? 'GB' : code))].slice(0, 30);
    const page = Number(first(params.page));
    return { q, scope: scope === 'trends' || scope === 'laws' ? scope : 'all', mode: mode === 'keyword' ? 'keyword' : 'hybrid', countries, topic: publicTopics.some(topic => topic.id === first(params.topic)) ? first(params.topic) : '', from, to, sort: sort === '최신순' || sort === 'newest' ? 'newest' : 'relevance', page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1, errors };
}
export function searchHref(filters: SearchFilters, changes: Partial<SearchFilters> = {}): string {
    const f = { ...filters, ...changes }, p = new URLSearchParams();
    if (f.q)
        p.set('q', f.q);
    if (f.scope !== 'all')
        p.set('scope', f.scope);
    if (f.mode === 'keyword')
        p.set('mode', f.mode);
    for (const c of f.countries)
        p.append('country', c);
    if (f.topic)
        p.set('topic', f.topic);
    if (f.from)
        p.set('from', f.from);
    if (f.to)
        p.set('to', f.to);
    if (f.sort === 'newest')
        p.set('sort', 'newest');
    if (f.page > 1)
        p.set('page', String(f.page));
    return `/public/unified-search?${p}`;
}
export function matchingConcepts(query: string) { const q = normalizeSearchText(query).replaceAll(' ', ''); return searchConcepts.filter(concept => concept.aliases.some(alias => q.includes(normalizeSearchText(alias).replaceAll(' ', '')))); }
function snippet(text: string, terms: string[]): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const folded = cleaned.toLocaleLowerCase();
    const found = terms.map(term => folded.indexOf(term)).filter(index => index >= 0);
    const start = found.length ? Math.max(0, Math.min(...found) - 70) : 0;
    return `${start ? '…' : ''}${cleaned.slice(start, start + 330)}${cleaned.length > start + 330 ? '…' : ''}`;
}
export function rankPublicDocuments(documents: SearchDocument[], filters: SearchFilters, semantic: SemanticHit[] = []): SearchHit[] {
    if (!filters.q || filters.errors.length)
        return [];
    const terms = searchTokens(filters.q), concepts = filters.mode === 'hybrid' ? matchingConcepts(filters.q) : [];
    const normalized = documents.map(document => ({ document, title: normalizeSearchText(document.title + ' ' + (document.lawTitle ?? '')), text: normalizeSearchText(document.text), tags: normalizeSearchText(document.tags.join(' ')) }));
    const frequencies = new Map(terms.map(term => [term, normalized.filter(row => (row.title + ' ' + row.text + ' ' + row.tags).includes(term)).length]));
    const semanticById = new Map<string, number>();
    if (filters.mode === 'hybrid')
        for (const hit of semantic) {
            if (Number.isFinite(hit.score) && hit.score >= .75 && hit.score <= 1)
                semanticById.set(hit.id, Math.max(semanticById.get(hit.id) ?? 0, hit.score));
        }
    const hits: SearchHit[] = [];
    for (const row of normalized) {
        const d = row.document;
        if (filters.scope === 'trends' && d.kind !== 'trend' || filters.scope === 'laws' && d.kind === 'trend')
            continue;
        if (filters.countries.length && !filters.countries.some(code => d.jurisdictions.map(c => c === 'UK' ? 'GB' : c).includes(code)))
            continue;
        const topic = publicTopics.find(item => item.id === filters.topic);
        if (topic && (d.kind === 'trend' ? !matchesPublicTopic(d.tags, topic.id) : !topic.terms.some(term => (row.title + ' ' + row.text + ' ' + row.tags).includes(normalizeSearchText(term)))))
            continue;
        // Date filters describe trend publication dates, never statute versions or effective dates.
        if (d.kind === 'trend' && ((filters.from && (!d.date || d.date < filters.from)) || (filters.to && (!d.date || d.date > filters.to))))
            continue;
        let lexical = 0;
        const matched: string[] = [];
        for (const term of terms) {
            const idf = Math.log(1 + (documents.length + 1) / ((frequencies.get(term) ?? 0) + 1));
            const score = row.title.includes(term) ? 5 : row.tags.includes(term) ? 3 : row.text.includes(term) ? 1 : 0;
            if (score) {
                lexical += score * idf;
                matched.push(term);
            }
        }
        const exact = normalizeSearchText(filters.q);
        if (exact.length > 1 && row.title.includes(exact))
            lexical += 15;
        const expanded = concepts.filter(concept => Boolean(d.criterionId && concept.criteria.includes(d.criterionId)) || concept.terms.some(term => (row.title + ' ' + row.text + ' ' + row.tags).includes(normalizeSearchText(term))));
        const meaning = semanticById.get(d.id) ?? 0;
        if (!lexical && !expanded.length && !meaning)
            continue;
        const displayReasons = [...(matched.length ? ['검색어 일치'] : []), ...expanded.map(concept => `${concept.label} 관련 표현`), ...(meaning ? ['의미가 가까운 자료'] : [])];
        hits.push({ document: d, reasons: displayReasons, snippet: snippet(d.text, [...matched, ...expanded.flatMap(c => c.terms)]), score: lexical + expanded.length * 7 + (d.criterionId && expanded.some(concept => concept.criteria.includes(d.criterionId ?? '')) ? 10 : 0) + (meaning ? (meaning - .7) * 20 : 0) });
    }
    return hits.sort((a, b) => b.score - a.score || b.document.date.localeCompare(a.document.date) || a.document.id.localeCompare(b.document.id));
}
