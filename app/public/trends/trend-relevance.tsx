'use client';
import {useState} from 'react';
import Link from 'next/link';
import {learningTopics,learningHref,type LearningAudience} from '../../../lib/public-learning';
import styles from '../explore/learning.module.css';
export default function TrendRelevance({topicIds,initialAudience='everyday',countries}:{topicIds:string[];initialAudience?:LearningAudience;countries?:string[]}) {
  const [audience,setAudience]=useState<LearningAudience>(initialAudience);
  const topics=topicIds.map(id=>learningTopics.find(topic=>topic.id===id)).filter((topic):topic is (typeof learningTopics)[number]=>Boolean(topic)).slice(0,2);
  return <section className={styles.panel} aria-labelledby="trend-relevance-title" id="trend-relevance">
    <h2 id="trend-relevance-title">나와 어떤 관련이 있나요?</h2>
    <div className={styles.tabs} role="group" aria-label="확인 질문 선택"><button type="button" aria-pressed={audience==='everyday'} onClick={()=>setAudience('everyday')}>생활 속에서</button><button type="button" aria-pressed={audience==='work'} onClick={()=>setAudience('work')}>업무에서</button></div>
    {topics.length?topics.map(topic=><div key={topic.id}><h3>{topic.question}</h3><p>{topic[audience].relevance}</p><ul>{topic[audience].questions.map(question=><li key={question}>{question}</li>)}</ul><div className={styles.actions}><Link prefetch={false} href={learningHref(topic.id,audience,countries)}>이 질문으로 국가별 비교와 근거 보기 →</Link></div></div>):<><p>이 동향의 대상·적용 범위·발표 이후의 추가 안내를 공식 원문에서 확인해 보세요.</p><Link prefetch={false} href="/public/explore">궁금한 질문으로 법제 탐색하기 →</Link></>}
    <p className={styles.note}>제목·요약·주제 표시를 바탕으로 고른 읽기 안내입니다. 이 사건에 어떤 법이 적용되는지는 본문에 인용된 조문과 공식 원문을 함께 확인해 주세요.</p>
  </section>;
}
