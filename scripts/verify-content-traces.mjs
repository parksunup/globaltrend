import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const routes=['public/laws','public/laws/[lawId]','work/legal','legal-translation','legal-translation/[lawId]'];
for(const route of routes){
 const trace=JSON.parse(readFileSync(`.next/server/app/${route}/page.js.nft.json`,'utf8'));
 for(const file of ['data/derived/gdpr.json',...['appi','pipl','uk-gdpr','ccpa','pdpa'].map(id=>`data/legal/translations/${id}.json`)]){
  assert.ok(trace.files.some(path=>path.replaceAll('\\','/').endsWith('/'+file)),`${route}: missing serverless file ${file}`);
 }
}
console.log('Verified: all six translated corpora are included in public and worker serverless bundles.');
