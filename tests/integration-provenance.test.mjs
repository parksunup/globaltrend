import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('submitted files retain recorded provenance; derived public mirrors match their reviewed source',()=>{
 const manifest=JSON.parse(readFileSync('docs/integration/source-manifest.json','utf8'));
 assert.ok(manifest.files.length>100);
 for(const file of manifest.files){
  const text=readFileSync(file.path,'utf8').replaceAll('\r\n','\n');
  assert.equal(createHash('sha256').update(text).digest('hex'),file.sha256,file.path);
  if(file.derived_from){
   assert.match(file.imported_sha256,/^[a-f0-9]{64}$/);
   assert.equal(text,readFileSync(file.derived_from,'utf8').replaceAll('\r\n','\n'),file.path+' must mirror its source');
   assert.ok(file.transformation_reason);
  }
 }
});
