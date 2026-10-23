import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLiveWorkspaceReader } from '../lib/live-team-workspace.ts';

const first = 'a'.repeat(40), second = 'b'.repeat(40);
function remote() {
  let sha = first, requests = 0;
  return {
    update() { sha = second; }, get requests() { return requests; },
    async fetch(url) {
      requests++;
      if (url.includes('/branches?')) return Response.json([{name:'feat/trend-source-contracts',commit:{sha}}, {name:'feat/legal-corpus-foundation',commit:{sha}}]);
      if (url.includes('/git/trees/')) return Response.json({truncated:false,tree:[
        {path:'data/trends/fixtures/test.json',type:'blob',size:500},
        {path:'data/legal/translations/test.json',type:'blob',size:500},
        {path:'data/trends/selection-rules.md',type:'blob',size:40},
        {path:'.env.local',type:'blob',size:20},
      ]});
      if (url.endsWith('test.json') && url.includes('/trends/')) return Response.json({items:[{record_id:'one',korean_title:url.includes(second)?'수정한 제목':'첫 제목', summary_ko:'요약', review_status:'withheld'}]});
      if (url.endsWith('test.json')) return Response.json({korean_title:'검토 중 법률',translation:{public_release_status:'withheld'},provisions:[{node_id:'main-a1',tag:'Article',scope:'main',source_order:1,korean_text:'발행 전에도 읽는 번역문'}]});
      if (url.endsWith('selection-rules.md')) return new Response('# 주요 동향 선정 기준');
      throw Error('허용하지 않은 파일 요청: '+url);
    }
  };
}

test('push changes become visible without a new deployment, with one immutable SHA per snapshot', async () => {
  const server = remote(); let time = 0;
  const reader = createLiveWorkspaceReader({fetch:server.fetch,now:()=>time});
  const a = await reader('trends');
  assert.equal(a.commitSha, first); assert.equal(a.items[0].title,'첫 제목');
  const requests = server.requests;
  await reader('trends'); assert.equal(server.requests,requests);
  server.update(); time = 121_000;
  const b = await reader('trends');
  assert.equal(b.commitSha,second); assert.equal(b.items[0].title,'수정한 제목');
  assert.match(b.notes[0].text,/선정 기준/);
});

test('withheld translations are visible for review without DB or publication access', async () => {
  const reader = createLiveWorkspaceReader({fetch:remote().fetch});
  const data = await reader('legal');
  assert.equal(data.translations[0].sections[0].lines[0].text,'발행 전에도 읽는 번역문');
  assert.equal(data.items[0].status,'withheld');
});

test('unknown roles cannot proxy arbitrary branches', async () => {
  const server = remote();
  const reader = createLiveWorkspaceReader({fetch:server.fetch});
  await assert.rejects(()=>reader('../../main'),/담당/);
  assert.equal(server.requests,0);
});

test('network failure is explicit and never silently substitutes deployed/published data', async () => {
  const server = remote(); let fail = false, time = 0;
  const reader = createLiveWorkspaceReader({now:()=>time,fetch:(url)=>fail?Promise.reject(Error('네트워크 오류')):server.fetch(url)});
  await reader('trends'); fail = true; time = 121_000;
  const stale = await reader('trends');
  assert.equal(stale.stale,true); assert.equal(stale.commitSha,first); assert.match(stale.error,/네트워크/);
  const empty = createLiveWorkspaceReader({fetch:async()=>{throw Error('접근 실패');}});
  await assert.rejects(()=>empty('legal'),/접근 실패/);
});

test('unsafe tree paths and truncated trees are rejected, not treated as empty submissions', async () => {
  for (const tree of [{truncated:true,tree:[]},{truncated:false,tree:[{type:'blob',path:'data/trends/../../.env.json',size:10}]}]) {
    const server = remote();
    const reader = createLiveWorkspaceReader({fetch:url=>url.includes('/git/trees/')?Promise.resolve(Response.json(tree)):server.fetch(url)});
    await assert.rejects(()=>reader('trends'),/목록|경로/);
  }
});
