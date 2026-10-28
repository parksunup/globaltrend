import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trusted} from '../supabase/functions/podcast-cloud/trust.ts';
const good={repository:'parksunup/globaltrend',repository_id:'1390776769',repository_owner_id:'289618557',repository_visibility:'public',ref:'refs/heads/main',sub:'repo:parksunup@289618557/globaltrend@1390776769:ref:refs/heads/main',workflow_ref:'parksunup/globaltrend/.github/workflows/podcast-cloud.yml@refs/heads/main',runner_environment:'github-hosted',event_name:'schedule',run_id:'123',run_attempt:'1'};
test('only the exact production workflow identity is trusted',()=>{
 assert.equal(trusted(good),true);
 for(const key of Object.keys(good))assert.equal(trusted({...good,[key]:'attacker'}),false,key);
 assert.equal(trusted({...good,event_name:'workflow_dispatch'}),true);
 assert.equal(trusted({...good,event_name:'pull_request_target'}),false);
});
test('cloud workflow has no PR trigger, credential artifacts or paid runners',()=>{
 const code=readFileSync(new URL('../.github/workflows/podcast-cloud.yml',import.meta.url),'utf8');
 assert.match(code,/PODCAST_CLOUD_ENABLED == 'true'/);assert.match(code,/private == false/);
 assert.match(code,/PODCAST_SESSION_ENABLED == 'true'/);
 assert.match(code,/PODCAST_SESSION_TEST_UNTIL/);
 assert.match(code,/PODCAST_SESSION_KEY: \$\{\{ secrets.PODCAST_SESSION_KEY \}\}/);
 assert.match(code,/runs-on: ubuntu-latest/);assert.match(code,/persist-credentials: false/);
 assert.doesNotMatch(code,/pull_request|upload-artifact|actions\/cache|runs-on:.*self-hosted/);
});
