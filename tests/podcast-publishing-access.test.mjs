import test from 'node:test';
import assert from 'node:assert/strict';
import {podcastPublishingAllowed} from '../lib/podcast-publishing-access.ts';

const preview='globaltrend-git-codex-podcast-one-click-flow-pipc-fairy.vercel.app';
test('only the named administrator preview can request real podcast publication',()=>{
 assert.equal(podcastPublishingAllowed({nodeEnv:'production',vercelEnv:'preview',branch:'codex/podcast-one-click-flow',hostname:preview}),true);
 assert.equal(podcastPublishingAllowed({nodeEnv:'production',vercelEnv:'preview',branch:'other-branch',hostname:preview}),false);
 assert.equal(podcastPublishingAllowed({nodeEnv:'production',vercelEnv:'preview',branch:'codex/podcast-one-click-flow',hostname:'another-preview.vercel.app'}),false);
 assert.equal(podcastPublishingAllowed({nodeEnv:'development',vercelEnv:'preview',branch:'codex/podcast-one-click-flow',hostname:preview}),false);
 assert.equal(podcastPublishingAllowed({nodeEnv:'production',vercelEnv:'production',hostname:'globaltrend-six.vercel.app'}),true);
});
