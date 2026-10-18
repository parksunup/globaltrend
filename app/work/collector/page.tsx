import Link from 'next/link';
import WorkFrame from '../frame';
import {workspaceSession} from '../../../lib/workspace-data';
import {canReviewCollector,parseCollectorReview} from '../../../lib/collector-review';
import CollectorReviewPanel from '../../components/collector-review';
export const dynamic='force-dynamic';
export default async function CollectorPage(){const {db,role}=await workspaceSession();let data=null,error=false;
 if(canReviewCollector(role)){try{const result=await db.rpc('get_trend_collector_review');if(result.error)throw result.error;data=parseCollectorReview(result.data);}catch{error=true;}}
 return <WorkFrame active="collector"><h1>수집 상태</h1><p>수집 결과와 처리가 필요한 자료를 확인합니다.</p>{canReviewCollector(role)?<CollectorReviewPanel data={data} error={error} commitSha={process.env.VERCEL_GIT_COMMIT_SHA}/>:<p><Link href="/work">팀 계정으로 로그인</Link>해 주세요.</p>}</WorkFrame>;
}
