import {productionWorkspaceOrigin} from '../../lib/workspace-environment';
import LiveTeamWorkspace from '../components/live-team-workspace';
export const dynamic='force-dynamic';
export default async function WorkPage({searchParams}:{searchParams:Promise<{role?:string;view?:string}>}){
 const {role,view}=await searchParams;
 return <LiveTeamWorkspace role={role==='legal'?'legal':'trends'} weekly={view==='weekly'} readOnly={process.env.VERCEL_ENV==='preview'} productionOrigin={productionWorkspaceOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL)}/>;
}
