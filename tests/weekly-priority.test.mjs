import test from 'node:test';
import assert from 'node:assert/strict';
import {rankWeeklyCandidates,weeklyPriority} from '../lib/weekly-priority.ts';
import {rankPodcastStories} from '../lib/podcast-recommendation.ts';

const candidate=(id,title,summary,details,date='2026-10-20')=>({id,title,summary,details,date,documentType:'news',topics:[],jurisdictions:[]});
const substantive='이번 규정은 국외 이전과 정보주체의 권리 보호를 다룹니다. 적용 대상과 예외 조건을 구체적으로 정하고, 기존 제도에 따른 후속 절차와 시행 일정을 설명합니다. '.repeat(5);

test('weekly selection uses its six-part 100-point rubric independently of podcast scoring',()=>{
 const row=candidate('00000000-0000-4000-8000-000000000001','EU, 개인정보 보호 규정 개정','국외 이전과 정보주체 권리의 적용 기준을 개정합니다.',substantive);
 const result=weeklyPriority(row);
 assert.equal(result.score,63);
 assert.equal(result.change,20);
 assert.equal(result.scope,0);
 assert.equal(result.practical,8);
 assert.equal(result.depth,2);
 assert.deepEqual(result.reasons,['총점 63/100','개인정보·권리 직접성 25/25','동향 단계 20/20','한국 관련성·실무성 8/15','정책·사회 학습 가치 8/15','원문·근거 2/10']);
 assert.equal('recommended' in result,false);
 const podcast=rankPodcastStories([{id:row.id,title:row.title,summary:row.summary,details:row.details,officialDate:row.date,officialUrl:'https://example.org/source',source:'공식 기관'}],row.date,row.date)[0];
 assert.notEqual(result.score,podcast.score);
 assert.notDeepEqual(result.criteria,podcast.criteria);
});

test('the weekly ranking sorts by weekly score, then publication date and id',()=>{
 const weak=candidate('00000000-0000-4000-8000-000000000003','기관 행사 개최 안내','기관 행사 일정을 공개합니다.','행사가 열립니다.','2026-10-25');
 const high=candidate('00000000-0000-4000-8000-000000000002','EU, 개인정보 보호 규정 개정','국외 이전과 정보주체 권리의 적용 기준을 개정합니다.',substantive,'2026-10-20');
 const tied=candidate('00000000-0000-4000-8000-000000000001','EU, 개인정보 보호 규정 개정','국외 이전과 정보주체 권리의 적용 기준을 개정합니다.',substantive,'2026-10-20');
 assert.deepEqual(rankWeeklyCandidates([weak,high,tied]).map(row=>row.id),[tied.id,high.id,weak.id]);
});
