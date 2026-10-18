import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSubmittedStories } from "./public-submission-preview.ts";

export type WeeklyIssueItem = {
  number:number; id:string; title:string; originalTitle:string; category:string;
  organization:string; date:string; sourceLabel:string; leadSummary:string;
  bodyPoints:{label:string;text:string}[]; editorialNote:string; officialUrl:string;
};

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
  const selectedById=new Map<string,(typeof selected)[number]>();
  selected.forEach((story:(typeof selected)[number])=>selectedById.set(story.id,story));
  const contents:WeeklyIssueItem[]=source.entries.map((entry:Record<string,unknown>,index:number)=>{
    const story=selectedById.get(String(entry.fixture_record_id));
    if(!story) throw new Error("Weekly entry has no matching story");
    const facts=entry.facts as Record<string,unknown>;
    const summary=String(facts.summary_ko||story.summary).trim();
    const points=Array.isArray(entry.key_points_ko) ? entry.key_points_ko.map((point:unknown)=>String(point).trim()).filter(Boolean) : [];
    return {
      number:index+1,
      id:story.id,
      title:String(entry.korean_title||story.title),
      originalTitle:String(entry.original_title||story.originalTitle),
      category:String(entry.category||story.kind),
      organization:Array.isArray(entry.organization) ? entry.organization.map(String).join(" · ") : story.institution,
      date:String(entry.source_published_date||story.date),
      sourceLabel:`${Array.isArray(entry.organization) ? entry.organization.map(String).join(" · ") : story.institution} · ${String(entry.source_published_date||story.date)}`,
      leadSummary:summary.split(/\n\s*\n/)[0].trim(),
      bodyPoints:points.map((point:string)=>{
        const separator=point.indexOf(":");
        return separator>0 ? {label:point.slice(0,separator).trim(),text:point.slice(separator+1).trim()} : {label:"주요 내용",text:point};
      }),
      editorialNote:String((entry.privacy_significance as Record<string,unknown>)?.text_ko||"").replace(/^편집 의견:\s*/,""),
      officialUrl:story.officialUrl,
    };
  });
  return {
    title:source.title as string,
    notice:source.coverage_notice as string,
    stories:selected as typeof stories,
    issue:{
      issueNumber:source.issue_number,
      reportingWeek:source.reporting_week,
      sections:["해외·국제","국내"],
      contents,
    },
  };
}
