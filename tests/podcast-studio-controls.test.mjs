import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('one action queues an MCP cloud job with publication chosen, and login resumes the same selection',()=>{
 const studio=read('../app/work/podcast/studio.tsx');
 assert.match(studio,/executionMode:'cloud'/);
 assert.match(studio,/autoPublish:true/);
 assert.match(studio,/제작 후 자동으로 게시/);
 assert.match(studio,/GT_RECONNECT_OPEN/);
 assert.match(studio,/packetSignature!==pending.packet/);
 assert.doesNotMatch(studio,/제작 방식<select/);
});

test('published podcast jobs can be unpublished and show the terminal state',()=>{
 const studio=read('../app/work/podcast/studio.tsx');
 const api=read('../app/api/podcast/production/route.ts');
 const migration=read('../supabase/migrations/20261029170000_monthly_week_keys_and_podcast_editions.sql');
 assert.match(studio,/job\.phase==='published'.*게시 취소/s);
 assert.match(studio,/unpublished:'게시 취소'/);
 assert.match(api,/rpc\('unpublish_podcast_production_job'/);
 assert.match(api,/unpublish_weekly_podcast_issue/);
 assert.match(api,/weekly_podcast_episodes/);
 assert.match(studio,/<h2>제작 현황<\/h2>/);
 assert.match(migration,/update public\.weekly_podcast_episodes set status='withdrawn'/);
 assert.doesNotMatch(migration,/update public\.weekly_issues set status='withdrawn'/);
});

test('studio and direct upload share the monthly edition allocator',()=>{
 const studio=read('../app/api/podcast/production/route.ts');
 const upload=read('../app/work/podcast/upload-form.tsx');
 const nextIssue=read('../app/api/podcast/next-issue/route.ts');
 assert.match(studio,/reserve_weekly_podcast_issue_key/);
 assert.match(upload,/\/api\/podcast\/next-issue/);
 assert.match(nextIssue,/reserve_weekly_podcast_issue_key/);
 assert.doesNotMatch(upload,/name="issueKey"/);
});
