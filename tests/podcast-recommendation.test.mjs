import test from 'node:test';
import assert from 'node:assert/strict';
import {rankPodcastStories,recommendedPodcastStory,resolvePodcastMain} from '../lib/podcast-recommendation.ts';
const start='2026-10-19',end='2026-10-25',period=start+'/'+end;
function story(n,extra={}){return {id:`12345678-1234-1234-1234-${String(n).padStart(12,'0')}`,title:'유럽연합, 개인정보 국외이전 규정 개정',summary:'정보주체 권리와 처리 의무 변경',details:'기존 규정과 적용 대상, 조건 및 예외와 후속 절차를 설명합니다. '.repeat(20),officialUrl:'https://example.test/official',officialDate:'2026-10-20',source:'공식 기관',...extra};}
test('substantive change beats a newer fine and does not use the fine amount as a proxy',()=>{
 const major=story(1),fine=story(2,{title:'감독기관, 삭제 요청 위반에 100억 원 과징금 부과',officialDate:end});
 const ranked=rankPodcastStories([fine,major],start,end);
 assert.equal(recommendedPodcastStory(ranked).story.id,major.id);
 assert.equal(ranked.find(r=>r.story.id===fine.id).recommended,false);
 const larger={...fine,title:fine.title.replace('100억','100000억')};
 assert.equal(rankPodcastStories([fine],start,end)[0].score,rankPodcastStories([larger],start,end)[0].score);
});
test('topic buzzwords and long background text alone cannot manufacture a major story',()=>{
 const event=story(3,{title:'감독기관, 인공지능 웨비나 개최',summary:'개인정보 행사 안내'});
 assert.equal(recommendedPodcastStory(rankPodcastStories([event],start,end)),undefined);
 assert.equal(recommendedPodcastStory(rankPodcastStories([story(4,{details:'공지'})],start,end)),undefined);
});
test('proposals stay labelled as proposals, and background proposals do not relabel a court headline',()=>{
 const draft=story(5,{title:'유럽연합, 국외이전 규정 개정안 의견수렴'});
 assert.equal(rankPodcastStories([draft],start,end)[0].stage,'초안·제안·의견수렴');
 assert.equal(rankPodcastStories([draft],start,end)[0].criteria[0].points,22);
 const court=story(6,{title:'법원, 국외이전 관련 판결 선고',summary:'기존 지침 초안과 별개로 정보주체 권리 판단'});
 assert.equal(rankPodcastStories([court],start,end)[0].stage,'법원 판단');
});
test('unknown dates, outside periods, missing content and unsafe source URLs are excluded',()=>{
 const bad=[story(1,{officialDate:''}),story(2,{officialDate:'2026-10-26'}),story(3,{officialDate:'2026-02-30'}),story(4,{details:''}),story(5,{officialUrl:'http://example.test'}),story(6,{officialUrl:'https://user:secret@example.test'})];
 assert.deepEqual(rankPodcastStories(bad,start,end),[]);
 assert.deepEqual(rankPodcastStories([story(7)],end,start),[]);
});
test('ties are deterministic and a manual choice survives changed ranking on refresh',()=>{
 const a=story(1),b=story(2);let ranked=rankPodcastStories([b,a],start,end);
 assert.equal(resolvePodcastMain(ranked,period),a.id);
 const choice={period,id:b.id};
 ranked=rankPodcastStories([a,{...b,summary:'동향 설명',title:'삭제 요청 과징금 부과'}],start,end);
 assert.equal(resolvePodcastMain(ranked,period,choice),b.id);
 assert.equal(resolvePodcastMain(ranked,period,{period,id:''}),'');
 assert.equal(resolvePodcastMain(ranked,period,{period,id:story(9).id}),'');
 assert.equal(resolvePodcastMain(ranked,period,{period:'other period',id:b.id}),a.id);
 assert.equal(resolvePodcastMain([],period),'');
});
