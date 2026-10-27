import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {zipFiles} from '../../../../lib/zip-files';
export const runtime='nodejs';
export async function GET(){
  const names=['manifest.json','popup.html','popup.js','background.js','studio.js','notebook.js','capture.js'];
  const files=await Promise.all(names.map(async name=>({name:'international-fairy-notebooklm/'+name,content:await readFile(path.join(process.cwd(),'extensions/notebooklm-bridge',name))})));
  return new Response(new Uint8Array(zipFiles(files)),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="international-fairy-notebooklm.zip"','Cache-Control':'public, max-age=300'}});
}
