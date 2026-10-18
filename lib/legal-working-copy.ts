import {createHash} from 'node:crypto';
import {citedLegalPreview,type LegalReviewPackage} from './legal-release.ts';

/** Editable text only: preserve statutory identities, anchors, evidence URLs and structure. */
export function applyLegalTextChanges(original:LegalReviewPackage, changes:Record<string,unknown>):LegalReviewPackage {
 if(!changes||Array.isArray(changes)||typeof changes!=='object'||Object.keys(changes).length>10000)throw new Error('invalid_changes');
 const p=structuredClone(original);const setters=new Map<string,(value:string)=>void>();
 setters.set('summary',v=>{p.instrument.summary=v;});
 if(p.document){setters.set('scopeNote',v=>{p.document!.scopeNote=v;});for(const section of p.document.sections)for(const line of section.lines)setters.set('line:'+line.id,v=>{line.text=v;});}
 for(const c of p.cells){setters.set('cell:'+c.id+':summary',v=>{c.summary=v;});setters.set('cell:'+c.id+':exceptions',v=>{c.exceptions=v;});setters.set('cell:'+c.id+':articleNumbers',v=>{c.articleNumbers=v.split('\n').map(s=>s.trim()).filter(Boolean);});}
 for(const [key,value] of Object.entries(changes)){if(typeof value!=='string'||value.length>30000||!setters.has(key))throw new Error('invalid_field');setters.get(key)!(value);}
 for(const c of p.cells)if(Object.hasOwn(changes,'cell:'+c.id+':articleNumbers'))c.translationLinks=p.document?c.articleNumbers.flatMap(citation=>{const preview=citedLegalPreview(p.document!,citation);return preview?['/legal-translation/'+p.document!.id+'#'+preview.anchorId]:[];}):[];
 if(!p.instrument.summary.trim()||p.cells.some(c=>!c.summary.trim())||p.document?.sections.some(s=>s.lines.some(l=>!l.text.trim())))throw new Error('empty_content');
 const {contentHash:_hash,...body}=p;p.contentHash=createHash('sha256').update(JSON.stringify(body)).digest('hex');return p;
}
