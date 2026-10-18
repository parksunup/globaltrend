import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSubmittedStories } from "./public-submission-preview.ts";

/** Existing PR16 example; never promoted into a real published weekly issue. */
export function loadWeeklySample(root=process.cwd()) {
  const source=JSON.parse(readFileSync(join(root,"data/trends/weekly-sample.json"),"utf8"));
  const stories=loadSubmittedStories(root);
  const selected=source.entries.map((entry:{fixture_record_id:string;official_url:string;source_published_date:string})=>{
    const story=stories.find(story=>story.id===entry.fixture_record_id);
    if(!story || story.officialUrl!==entry.official_url || story.date!==entry.source_published_date.replaceAll("-",".")) throw new Error("Weekly example and source item disagree");
    return story;
  });
  if(!source.is_example || source.is_published || selected.length!==source.selected_count || new Set(selected.map((s:{id:string})=>s.id)).size!==selected.length) throw new Error("Invalid weekly example");
  return {title:source.title as string,notice:source.coverage_notice as string,stories:selected as typeof stories};
}
