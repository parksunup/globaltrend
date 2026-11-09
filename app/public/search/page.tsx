import Link from 'next/link';
import { PublicHeader, PublicFooter } from '../public-navigation';
import site from '../public.module.css';
import styles from '../unified-search.module.css';
import { parseSearchFilters, rankPublicDocuments, quickSearchQuestions, searchHref, type SearchHit } from '../../../lib/unified-search';
import { loadPublicSearchCorpus } from '../../../lib/unified-search-data';
import { semanticSearch } from '../../../lib/search-semantic-provider';
import { jurisdictionName } from '../../../lib/jurisdictions';
import { publicTopics } from '../../../lib/public-topics';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const metadata = { title: '통합 검색 · 국제요정', description: '질문과 검색어로 공개 동향, 국가별 법제 비교와 근거 조문을 함께 찾습니다.' };
const pageSize = 8;
export default async function PublicSearchPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const filters = parseSearchFilters(await searchParams);
    const requested = Boolean(filters.q && !filters.errors.length);
    const corpus = requested ? await loadPublicSearchCorpus() : { documents: [], sources: { trends: true, laws: true } };
    const semantic = requested && corpus.documents.length > 0 && filters.mode === 'hybrid' ? await semanticSearch(filters.q, corpus.documents) : { state: 'off' as const, hits: [] };
    const hits = rankPublicDocuments(corpus.documents, filters, semantic.hits), trends = hits.filter(hit => hit.document.kind === 'trend'), laws = hits.filter(hit => hit.document.kind !== 'trend');
    if (filters.sort === 'newest')
        trends.sort((a, b) => b.document.date.localeCompare(a.document.date) || b.score - a.score);
    const pages = Math.max(1, Math.ceil(Math.max(trends.length, laws.length) / pageSize)), page = Math.min(filters.page, pages), offset = (page - 1) * pageSize;
    const countries = [...new Set(['KR', 'JP', 'CN', 'EU', 'GB', 'US-CA', 'SG', ...corpus.documents.flatMap(d => d.jurisdictions), ...filters.countries].map(code => code === 'UK' ? 'GB' : code))].sort((a, b) => jurisdictionName(a).localeCompare(jurisdictionName(b), 'ko'));
    const back = searchHref(filters, { page });
    const linkFor = (hit: SearchHit) => { const u = new URL(hit.document.url, 'https://local.invalid'); u.searchParams.set('back', back); return u.pathname + u.search + u.hash; };
    const card = (hit: SearchHit) => <article className={styles.card} key={hit.document.id}>
   <div className={styles.meta}>{hit.document.kind === 'trend' ? '동향' : hit.document.kind === 'comparison' ? '법제 비교 요약' : '법률 조문'} · {hit.document.jurisdictions.map(jurisdictionName).join(' · ')}</div>
   <h3><Link prefetch={false} href={linkFor(hit)}>{hit.document.lawTitle ? `${hit.document.lawTitle} · ` : ''}{hit.document.title}</Link></h3>
   <div className={styles.meta}>{hit.document.kind === 'trend' ? `공식 출처 게시일: ${hit.document.date || '확인 필요'}` : `선정 판본: ${hit.document.version || '자료에서 확인'}`}</div>
   <p>{hit.snippet}</p><div className={styles.reasons} aria-label="검색 연결 이유">{hit.reasons.map(reason => <span key={reason}>{reason}</span>)}</div>
   <Link prefetch={false} href={linkFor(hit)}>전체 내용과 조건 확인 →</Link>{hit.document.sourceUrl && <> · <a href={hit.document.sourceUrl} target="_blank" rel="noopener noreferrer">공식 원문 ↗</a></>}
 </article>;
    return <main className={site.site}><PublicHeader active="/public/search"/><div className={styles.page}>
  <h1>동향과 법제를 함께 찾아보세요</h1><p>궁금한 질문이나 법률명·조항 번호를 입력해 보세요.</p>
  <form key={back} action="/public/search" method="get" className={styles.form} aria-label="통합 검색">
   <label htmlFor="unified-query">질문 또는 검색어</label><div className={styles.inputRow}><input id="unified-query" type="search" name="q" defaultValue={filters.q} maxLength={300} placeholder="예: 내 개인정보를 이용하려면 꼭 동의를 받아야 하나요?"/><button type="submit">검색</button><Link href="/public/search">초기화</Link></div>
   <details className={styles.filters} open={Boolean(filters.countries.length || filters.topic || filters.from || filters.to || filters.scope !== 'all' || filters.mode === 'keyword')}><summary>자료 종류·국가·기간 선택</summary>
    <div className={styles.filterRows}><label>자료 종류<select name="scope" defaultValue={filters.scope}><option value="all">동향과 법제</option><option value="trends">동향만</option><option value="laws">법제만</option></select></label>
    <label>찾는 방식<select name="mode" defaultValue={filters.mode}><option value="hybrid">관련 표현까지</option><option value="keyword">검색어 일치</option></select></label>
    <label>주제<select name="topic" defaultValue={filters.topic}><option value="">전체 주제</option>{publicTopics.map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
    <label>동향 정렬<select name="sort" defaultValue={filters.sort}><option value="relevance">관련도순</option><option value="newest">최신순</option></select></label></div>
    <fieldset className={styles.countries}><legend>국가·지역 (선택하지 않으면 전체)</legend>{countries.map(code => <label key={`${back}-${code}`}><input type="checkbox" name="country" value={code} defaultChecked={filters.countries.includes(code)}/>{jurisdictionName(code)}</label>)}</fieldset>
    <div className={styles.filterRows}><label>동향 시작일<input type="date" name="from" defaultValue={filters.from}/></label><label>동향 종료일<input type="date" name="to" defaultValue={filters.to}/></label></div><p className={styles.note}>기간과 최신순은 동향의 게시일에 적용합니다. 법제 자료의 선정 판본과 시행일은 별도로 확인해 주세요.</p>
   </details>
  </form>
  {filters.errors.map(error => <p key={error} role="alert" className={styles.notice}>{error}</p>)}
  {!requested ? <section aria-labelledby="quick-title"><h2 id="quick-title">궁금한 질문으로 빠르게 시작하기</h2><p>질문을 고르거나 직접 입력해 관련 자료를 찾아보세요.</p><div className={styles.quick}>{quickSearchQuestions.map(question => <Link prefetch={false} key={question} href={searchHref(filters, { q: question, page: 1 })}>{question} →</Link>)}</div></section> : <>
   {!corpus.sources.trends && <p role="status" className={styles.notice}>동향 자료 연결을 확인하지 못했습니다. 동향이 없다는 뜻은 아닙니다.</p>}
   {!corpus.sources.laws && <p role="status" className={styles.notice}>법제 자료 연결을 확인하지 못했습니다. 해당 규정이 없다는 뜻은 아닙니다.</p>}
   <p role="status">동향 {trends.length}건 · 법제 {laws.length}건</p>
   {filters.scope === 'all' && <nav className={styles.resultJump} aria-label="검색 결과 영역 이동"><a href="#trend-results">동향 보기 ↓</a><a href="#law-results">법제·근거 조문 보기 ↓</a></nav>}
   <p className={styles.note}>{filters.mode === 'keyword' ? '검색어가 일치하는 자료를 찾았습니다.' : semantic.state === 'active' ? '단어·관련 표현과 의미가 가까운 자료를 함께 찾았습니다.' : semantic.state === 'unavailable' ? '의미 검색 연결을 확인하지 못해 단어·관련 표현으로 찾았습니다.' : '단어와 정해진 관련 표현으로 찾았습니다.'} 검색의 관련도는 법적 적용 여부를 판단한 결과가 아닙니다.</p>
   <div className={styles.groups}>
    {filters.scope !== 'laws' && <section className={styles.group} aria-labelledby="trend-results"><h2 id="trend-results">동향 <small>{trends.length}건</small></h2>{trends.slice(offset, offset + pageSize).map(card)}{trends.length > 0 && offset >= trends.length && <p>동향 결과는 이전 페이지에서 볼 수 있습니다.</p>}{!trends.length && corpus.sources.trends && <p>현재 공개 동향에서 일치하는 자료를 찾지 못했습니다. 질문을 짧게 바꾸거나 필터를 넓혀 보세요.</p>}</section>}
    {filters.scope !== 'trends' && <section className={styles.group} aria-labelledby="law-results"><h2 id="law-results">법제·근거 조문 <small>{laws.length}건</small></h2>{laws.slice(offset, offset + pageSize).map(card)}{laws.length > 0 && offset >= laws.length && <p>법제 결과는 이전 페이지에서 볼 수 있습니다.</p>}{!laws.length && corpus.sources.laws && <p>현재 공개 법제에서 일치하는 자료를 찾지 못했습니다. 규정이 없다는 뜻은 아닙니다.</p>}</section>}
   </div>
   {pages > 1 && <nav className={styles.pagination} aria-label="검색 결과 페이지">{page > 1 && <Link href={searchHref(filters, { page: page - 1 })}>← 이전</Link>}<span>{page} / {pages}</span>{page < pages && <Link href={searchHref(filters, { page: page + 1 })}>다음 →</Link>}</nav>}
   <details className={styles.filters}><summary>다른 질문으로 찾아보기</summary><div className={styles.quick}>{quickSearchQuestions.map(question => <Link prefetch={false} key={question} href={searchHref(filters, { q: question, page: 1 })}>{question}</Link>)}</div></details>
  </>}
 </div><PublicFooter /></main>;
}
