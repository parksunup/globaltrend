import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

export type TrendEditorial = {record_id:string; title_ko:string; summary_ko:string; details_ko:string};
export function loadTrendEditorial(root=process.cwd()):Map<string,TrendEditorial> {
  const path=join(root,'data/trends/editorial/report-drafts.json');
  if(!existsSync(path)) return new Map();
  const data=JSON.parse(readFileSync(path,'utf8'));
  if(!Array.isArray(data.items)) throw new Error('Invalid trend editorial collection');
  const entries=new Map<string,TrendEditorial>();
  for(const item of data.items){
    if(!item.record_id || entries.has(item.record_id) || !item.title_ko || !item.summary_ko || !item.details_ko) throw new Error('Invalid or duplicate trend editorial record');
    entries.set(item.record_id,item);
  }
  return entries;
}

export function reportPoints(details:string):{label:string;text:string}[] {
  return details.split(/\n\s*\n/).filter(Boolean).map(line=>{
    const point=/^- \(([^)]+)\) ([\s\S]+)$/.exec(line);
    return point ? {label:point[1],text:point[2]} : {label:'주요 내용',text:line};
  });
}
