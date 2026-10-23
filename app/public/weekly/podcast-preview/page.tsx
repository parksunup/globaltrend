import {buildWeeklyPodcastScript} from "../../../../lib/weekly-podcast-script";
import PodcastPreview from "./podcast-preview";
export const dynamic="force-dynamic";
export default function Page(){const sample=buildWeeklyPodcastScript();return <main style={{maxWidth:880,margin:"40px auto",padding:24,fontFamily:"sans-serif"}}><p>제작 테스트 · 비공개</p><h1>{sample.title}</h1><p>{sample.notice}</p><PodcastPreview turns={sample.turns}/></main>}
