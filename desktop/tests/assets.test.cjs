const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('../src/services/store.cjs');const {createAssets}=require('../src/services/assets.cjs');
function pdf(){
 const stream='BT /F1 12 Tf 50 100 Td (Example Resume) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let text='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(text);text+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`;return text;
}
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'assets-')),store=openStore(root),assets=createAssets(store);t.after(()=>{store.close();fs.rmSync(root,{recursive:true,force:true});});return {root,store,assets};}
test('PDF originals are immutable, text has page provenance, duplicate import reuses version',async t=>{
 const {root,assets}=fixture(t),source=path.join(root,'resume.pdf');fs.writeFileSync(source,pdf());
 const a=await assets.importFile(source);assert.equal(a.parseStatus,'ready');assert.match(a.text,/Example Resume/);assert.equal(a.pages[0].page,1);
 const dup=await assets.importFile(source);assert.equal(dup.id,a.id);assert.equal(dup.duplicate,true);
 const filename=assets.file(a.id);assert.notEqual(filename,source);
 fs.writeFileSync(filename,'%PDF-1.4 changed');assert.throws(()=>assets.file(a.id),/变化或损坏/);
 const repaired=await assets.importFile(source);assert.equal(repaired.repaired,true);assert.equal(repaired.hash,a.hash);assert.ok(assets.file(a.id));
});
test('failed extraction keeps original and defaults/archiving do not modify existing versions',async t=>{
 const {root,assets,store}=fixture(t),source=path.join(root,'broken.pdf');fs.writeFileSync(source,'%PDF-1.4 broken');
 const a=await assets.importFile(source);assert.equal(a.parseStatus,'failed');assert.ok(fs.existsSync(assets.file(a.id)));
 assert.throws(()=>assets.update({...a,default:true}),/可读取/);
 const valid=path.join(root,'valid.pdf');fs.writeFileSync(valid,pdf());const good=await assets.importFile(valid);
 const selected=assets.update({...good,default:true});assert.equal(selected.default,true);
 const archived=assets.update({...selected,archived:true});assert.equal(archived.default,false);assert.equal(archived.hash,good.hash);
 assert.equal(store.list('assets').length,2);
});
