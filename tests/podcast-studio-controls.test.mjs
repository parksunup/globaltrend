import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('Chrome is the initial production mode while cloud remains selectable',()=>{
 const studio=read('../app/work/podcast/studio.tsx');
 assert.match(studio,/useState<'cloud'\|'browser'>\('browser'\)/);
 assert.match(studio,/<option value="cloud">/);
 assert.match(studio,/<option value="browser">/);
});

test('published podcast jobs can be unpublished and show the terminal state',()=>{
 const studio=read('../app/work/podcast/studio.tsx');
 const api=read('../app/api/podcast/production/route.ts');
 const migration=read('../supabase/migrations/20261029170000_monthly_week_keys_and_podcast_editions.sql');
 assert.match(studio,/job\.phase==='published'.*게시 취소/s);
 assert.match(studio,/unpublished:'공개 취소'/);
 assert.match(api,/rpc\('unpublish_podcast_production_job'/);
 assert.match(api,/unpublish_weekly_podcast_issue/);
 assert.match(api,/weekly_podcast_episodes/);
 assert.match(studio,/<h2>공개된 팟캐스트<\/h2>/);
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
