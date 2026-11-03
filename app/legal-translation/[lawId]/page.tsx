import LiveTeamWorkspace from '../../components/live-team-workspace';
export default async function LegalTranslationPage({params}:{params:Promise<{lawId:string}>}) {
  const {lawId} = await params;
  return <LiveTeamWorkspace role="legal" lawId={lawId}/>;
}
