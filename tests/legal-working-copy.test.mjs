import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLegalReviewPackages} from '../lib/legal-release.ts';
import {applyLegalTextChanges} from '../lib/legal-working-copy.ts';
const pkg=buildLegalReviewPackages().find(p=>p.document?.sections.some(s=>s.lines.length));
test('legal editor updates only requested line and comparison text while preserving anchors, evidence and source snapshot',()=>{
 const section=pkg.document.sections.find(s=>s.lines.length),line=section.lines[0],cell=pkg.cells[0],before=structuredClone(pkg);
 const changed=applyLegalTextChanges(pkg,{['line:'+line.id]:'수정한 번역문',['cell:'+cell.id+':summary']:'수정한 비교 요약'});
 assert.notEqual(changed.contentHash,pkg.contentHash);assert.deepEqual(pkg,before);
 assert.equal(changed.document.sections.find(s=>s.id===section.id).lines.find(l=>l.id===line.id).text,'수정한 번역문');
 assert.equal(changed.cells[0].summary,'수정한 비교 요약');assert.equal(changed.cells[0].sourceUrl,cell.sourceUrl);assert.deepEqual(changed.cells[0].translationLinks,cell.translationLinks);assert.equal(changed.recordId,pkg.recordId);
});
test('legal editor refuses evidence/hash/identity changes and missing text',()=>{
 for(const changes of [{contentHash:'f'.repeat(64)},{recordId:'changed'},{sourceUrl:'https://evil.test'},{summary:''},{['cell:'+pkg.cells[0].id+':summary']:''},{summary:4}])assert.throws(()=>applyLegalTextChanges(pkg,changes));
});

test('correcting cited articles rebuilds only matching same-law anchors instead of leaving old comparison links',()=>{
 const cell=pkg.cells[0];const changed=applyLegalTextChanges(pkg,{['cell:'+cell.id+':articleNumbers']:'제1조'});
 assert.deepEqual(changed.cells[0].articleNumbers,['제1조']);assert.ok(changed.cells[0].translationLinks.every(link=>link.startsWith('/legal-translation/'+pkg.document.id+'#')));assert.ok(changed.cells[0].translationLinks.length>0);
 const otherStatute=applyLegalTextChanges(pkg,{['cell:'+cell.id+':articleNumbers']:'시행령 제1조'});assert.deepEqual(otherStatute.cells[0].translationLinks,[]);
});
