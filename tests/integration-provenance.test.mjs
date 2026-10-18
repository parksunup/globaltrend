import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('latest PR15/16 submitted files are preserved byte-for-byte apart from line endings',()=>{
 const manifest=JSON.parse(readFileSync('docs/integration/source-manifest.json','utf8'));
 assert.ok(manifest.files.length>100);
 for(const file of manifest.files){
  const text=readFileSync(file.path,'utf8').replaceAll('\r\n','\n');
  assert.equal(createHash('sha256').update(text).digest('hex'),file.sha256,file.path);
 }
});
