const approvedPreviewHost='globaltrend-git-codex-podcast-one-click-flow-pipc-fairy.vercel.app';

export function podcastPublishingAllowed(input:{nodeEnv?:string;vercelEnv?:string;branch?:string;hostname:string}){
 if(input.nodeEnv!=='production')return false;
 if(input.vercelEnv!=='preview')return true;
 return input.branch==='codex/podcast-one-click-flow'&&input.hostname===approvedPreviewHost;
}
