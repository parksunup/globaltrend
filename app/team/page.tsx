import LiveTeamWorkspace from '../components/live-team-workspace';
export default async function TeamPage({searchParams}:{searchParams:Promise<{role?:string}>}) {
  const {role} = await searchParams;
  return <LiveTeamWorkspace role={role==='legal'?'legal':'trends'}/>;
}
