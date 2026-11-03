import LiveTeamWorkspace from '../../components/live-team-workspace';

export const dynamic='force-dynamic';

export default function WeeklyEditorPage(){
 return <LiveTeamWorkspace role="trends" weekly readOnly={process.env.VERCEL_ENV==='preview'}/>;
}
