'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('../src/services/store.cjs');
const {createAssets}=require('../src/services/assets.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'assets-review-')),store=openStore(root);t.after(()=>{store.close();fs.rmSync(root,{recursive:true,force:true});});return {root,store,assets:createAssets(store)};}
function makePDF(streams,size=200){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${streams.map((_,i)=>`${4+i*2} 0 R`).join(' ')}] /Count ${streams.length} >>`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 streams.forEach((stream,i)=>{objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size} ${size}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`,`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);});
 let body='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(body);body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Root 1 0 R /Size ${objects.length+1} >>\nstartxref\n${xref}\n%%EOF`;return body;
}
test('mixed text and image-only PDF exposes partial status and preserves text provenance',async t=>{
 const {root,assets}=fixture(t),file=path.join(root,'mixed.pdf');
 // The inline grayscale bitmap has no extractable text.
 fs.writeFileSync(file,makePDF(['BT /F1 12 Tf 20 50 Td (Text page) Tj ET','q 100 0 0 100 0 0 cm BI /W 1 /H 1 /BPC 8 /CS /G /F /AHx ID FF> EI Q']));
 const a=await assets.importFile(file);assert.equal(a.parseStatus,'partial');assert.match(a.pages[0].text,/Text page/);assert.equal(a.pages[1].text.trim(),'');assert.equal(a.pages[1].page,2);
});
test('DOCX provides paragraph provenance explicitly distinct from original page numbers',async t=>{
 const {root,assets}=fixture(t),file=path.join(root,'paragraphs.docx');const zip=new (require('jszip'))();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Education</w:t></w:r></w:p><w:p><w:r><w:t>Experience</w:t></w:r></w:p></w:body></w:document>');
 fs.writeFileSync(file,await zip.generateAsync({type:'nodebuffer'}));const a=await assets.importFile(file);assert.equal(a.parseStatus,'ready');assert.equal(a.pages.length,2);assert.match(a.pages[1].sourceLabel,/正文段落 2（不代表原文页码）/);assert.equal(a.pages[1].text,'Experience');
});
test('oversized PDF page rasterizes within dimension budget and excessive aggregate pixels reject',async t=>{
 const {root,assets}=fixture(t),file=path.join(root,'large.pdf');fs.writeFileSync(file,makePDF([''],100000));const a=await assets.importFile(file);const images=await assets.images(a.id);const png=Buffer.from(images[0].image.split(',')[1],'base64');assert.equal(png.readUInt32BE(16),1800);assert.equal(png.readUInt32BE(20),1800);
 const many=path.join(root,'many.pdf');fs.writeFileSync(many,makePDF(Array(8).fill(''),100000));const b=await assets.importFile(many);await assert.rejects(assets.images(b.id),/图像总量过大/);
});
test('missing original is repaired in place while preserving historical asset reference',async t=>{
 const {root,store,assets}=fixture(t),file=path.join(root,'recover.pdf');fs.writeFileSync(file,makePDF(['BT /F1 12 Tf 20 50 Td (Resume) Tj ET']));const a=await assets.importFile(file);store.put('applications',{id:'historical',assetId:a.id,assetHash:a.hash});fs.unlinkSync(assets.file(a.id));const repaired=await assets.importFile(file);assert.equal(repaired.id,a.id);assert.equal(repaired.repaired,true);assert.equal(store.get('applications','historical').assetHash,repaired.hash);assert.equal(fs.readFileSync(assets.file(a.id),'utf8'),fs.readFileSync(file,'utf8'));
});
