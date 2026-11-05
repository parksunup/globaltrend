import Link from 'next/link';
import type {Metadata} from 'next';
import {PublicHeader,PublicFooter} from '../public-navigation';
import publicStyles from '../public.module.css';
import styles from './learning.module.css';
import {learningTopics,learningTopic,learningAudience,learningCountries,learningCountriesFor,learningHref,learningComparisonHref,matchedLearningTopics} from '../../../lib/public-learning';
import {jurisdictionName} from '../../../lib/jurisdictions';
import {loadPublicLegal} from '../../../lib/public-legal';
import {loadPublicStories} from '../../../lib/public-content';
import {citedLegalPreview} from '../../../lib/legal-release';
import {publicSubmissionPreviewEnabled} from '../../../lib/public-submission-preview';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'질문으로 탐색 · 국제요정',description:'생활과 업무의 질문에서 출발해 해외 동향, 국가별 개인정보 보호법 비교와 근거 조문을 살펴봅니다.'};
export default async function PublicExplore({searchParams}:{searchParams:Promise<{topic?:string;audience?:string;country?:string|string[]}>}) {
  const params=await searchParams,topic=learningTopic(params.topic),audience=learningAudience(params.audience);
  const countries=learningCountriesFor(typeof params.country==='string'?[params.country]:params.country,topic.countries);
  const [legalResult,storiesResult]=await Promise.allSettled([loadPublicLegal(),loadPublicStories()]);
  const legal=legalResult.status==='fulfilled'?legalResult.value:null;
  const stories=storiesResult.status==='fulfilled'?storiesResult.value.filter(story=>matchedLearningTopics(story).some(item=>item.id===topic.id)).slice(0,4):[];
  const current=learningHref(topic.id,audience,countries),comparison=learningComparisonHref(topic,countries);
  const guide=topic[audience];
  return <main className={publicStyles.site}>
    <PublicHeader active="/public/explore"/>
    <div className={styles.container}>
      <p className={styles.kicker}>생활과 업무에서 출발하는 개인정보 보호 탐색</p>
      <h1>궁금한 질문에서 근거까지</h1><p>쉽게 이해하고, 국가별 조건을 비교한 뒤, 공식 근거를 확인해 보세요.</p>
      {publicSubmissionPreviewEnabled()&&<p className={styles.note}>미리보기 환경입니다. 법제 자료의 판본과 작성·검수 상태를 함께 확인해 주세요.</p>}
      <nav className={styles.grid} aria-label="궁금한 질문 선택">{learningTopics.map(item=><Link prefetch={false} className={styles.card} key={item.id} href={learningHref(item.id,audience)} aria-current={topic.id===item.id?'page':undefined}><strong>{item.question}</strong><span>{item.criterionLabel}</span></Link>)}</nav>
      <nav className={styles.tabs} aria-label="설명의 관점"><Link prefetch={false} href={learningHref(topic.id,'everyday',countries)} aria-current={audience==='everyday'?'page':undefined}>생활 속에서 이해하기</Link><Link prefetch={false} href={learningHref(topic.id,'work',countries)} aria-current={audience==='work'?'page':undefined}>업무에서 확인하기</Link></nav>
      <nav className={styles.steps} aria-label="읽기 단계"><a href="#easy-summary">1. 쉽게 이해하기</a><a href="#country-comparison">2. 나라별로 비교하기</a><a href="#legal-evidence">3. 근거 살펴보기</a></nav>
      <section id="easy-summary" className={styles.panel} aria-labelledby="easy-summary-title"><p className={styles.kicker}>1분 핵심 안내</p><h2 id="easy-summary-title">{topic.question}</h2><p>{topic.introduction}</p><p>{guide.relevance}</p><h3>{audience==='work'?'업무에서 확인할 질문':'생활에서 확인할 질문'}</h3><ul>{guide.questions.map(question=><li key={question}>{question}</li>)}</ul><p className={styles.note}>질문에 따라 자료를 찾아보는 안내입니다. 법의 적용 조건과 예외는 국가별 조문에서 확인할 수 있습니다.</p></section>
      <section id="country-comparison" className={styles.panel} aria-labelledby="country-comparison-title"><h2 id="country-comparison-title">나라별로 비교하기</h2><p>같은 질문을 ‘{topic.criterionLabel}’ 기준으로 살펴봅니다. 선택한 국가·지역의 요약과 조문을 이어서 확인할 수 있습니다.</p>
        <form action="/public/explore" method="get" className={styles.countryForm}><input type="hidden" name="topic" value={topic.id}/><input type="hidden" name="audience" value={audience}/><fieldset><legend>비교할 국가·지역</legend>{learningCountries.map(code=><label key={`${current}-${code}`}><input type="checkbox" name="country" value={code} defaultChecked={countries.includes(code)}/>{jurisdictionName(code)}</label>)}</fieldset><p className={styles.note}>모두 해제하면 이 질문의 기본 국가·지역으로 돌아갑니다.</p><button type="submit">선택한 국가로 보기</button></form>
        <div className={styles.actions}><Link prefetch={false} href={comparison}>전체 비교표에서 ‘{topic.criterionLabel}’ 보기 →</Link></div>
      </section>
      <section id="legal-evidence" aria-labelledby="legal-evidence-title"><h2 id="legal-evidence-title">근거 살펴보기</h2><p>선택 판본의 비교 요약, 예외와 관련 조문을 함께 확인하세요.</p>
        {legalResult.status==='rejected'&&<p role="status" className={styles.note}>법제 자료 연결을 확인하지 못했습니다. 비교 자료를 불러오지 못한 상태이며, 해당 규정이 없다는 뜻은 아닙니다. 잠시 후 다시 확인해 주세요.</p>}
        <div className={styles.grid}>{countries.map(code=>{
          const cell=legal?.cells.find(item=>item.criterionId===topic.criterion&&item.jurisdiction===code);
          const document=legal?.documents.find(item=>item.jurisdiction===code);
          const preview=cell&&document?cell.articleNumbers.map(citation=>citedLegalPreview(document,citation,cell.translationLinks)).find(Boolean):undefined;
          const reader=document?`/public/laws/${document.id}?back=${encodeURIComponent(comparison)}${preview?`#${encodeURIComponent(preview.anchorId)}`:''}`:null;
          return <article className={styles.card} key={code}><h3>{jurisdictionName(code)}</h3>{cell?<>
            <p className={styles.status}>{cell.status==='published'?'공개된 비교 자료':'작성 초안 · 사람 검수 기록 확인 필요'}</p><p>{cell.summary}</p>
            {cell.exceptions&&<details><summary>조건과 예외 확인</summary><p>{cell.exceptions}</p></details>}
            <p>관련 조항: {cell.articleNumbers.join(' · ')||'조항 연결 확인 중'}</p>
            <details><summary>선택 판본과 검토 기록</summary><p>{cell.sourceVersion}</p>{cell.pendingReason&&<p>{cell.pendingReason}</p>}</details>
            <div className={styles.actions}>{reader&&<Link prefetch={false} href={reader}>{document?.jurisdiction==='KR'?'한국어 원문·조문 보기':'한국어 번역·조문 보기'} →</Link>}{cell.sourceUrl&&<a href={cell.sourceUrl} target="_blank" rel="noopener noreferrer">공식 근거 ↗</a>}</div>
          </>:<><p>{legal?'이 기준의 비교 자료는 아직 공개되어 있지 않습니다.':'비교 자료를 불러오지 못했습니다.'} 규정이 없다는 뜻은 아닙니다.</p>{reader&&<Link prefetch={false} href={reader}>읽을 수 있는 법률 자료 보기 →</Link>}</>}</article>;
        })}</div>
      </section>
      <section className={styles.panel} aria-labelledby="related-learning-trends"><h2 id="related-learning-trends">이 질문과 함께 읽을 동향</h2><p className={styles.note}>제목·요약·주제 표시가 질문과 연결되는 공개 동향입니다. 각 사건의 법적 적용 관계를 확정한 목록은 아닙니다.</p>
        {storiesResult.status==='rejected'?<p role="status">동향 자료를 불러오지 못했습니다. 검색에서 다시 확인해 주세요.</p>:stories.length?<div className={styles.grid}>{stories.map(story=><Link prefetch={false} className={styles.card} key={story.id} href={`/public/trends/${encodeURIComponent(story.id)}?${new URLSearchParams({back:current,audience})}`}><span>{story.region} · {story.date}</span><strong>{story.title}</strong><span>{story.summary}</span></Link>)}</div>:<p>현재 공개된 동향에서 이 질문과 연결되는 자료를 찾지 못했습니다.</p>}
        <div className={styles.actions}><Link prefetch={false} href={`/public/search?${new URLSearchParams({q:topic.search})}`}>‘{topic.search}’ 동향 검색 →</Link><Link prefetch={false} href="/public/weekly/podcast">주간 동향을 팟캐스트로 듣기 →</Link></div>
      </section>
    </div><PublicFooter/>
  </main>;
}
