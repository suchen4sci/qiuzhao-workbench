'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const data=fs.readFileSync(workerData.filename);
 if(workerData.extension==='.docx'){
  const mammoth=require('mammoth');
  const result=await mammoth.extractRawText({buffer:data});
  if(result.value.length>1_000_000)throw Error('文档正文超出导入限制');
  parentPort.postMessage({text:result.value,pages:result.value.split(/\n\s*\n/).filter(p=>p.trim()).map((text,index)=>({page:index+1,text,sourceLabel:`正文段落 ${index+1}（不代表原文页码）`})),warnings:result.messages.map(m=>m.type).slice(0,20)});return;
 }
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const loading=getDocument({data:new Uint8Array(data),standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts/'),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,stopAtErrors:true});
 try{
  const pdf=await loading.promise;
  if(pdf.numPages>80)throw Error('简历超过 80 页，请拆分后导入');
  const pages=[];let text='', imageBytes=0, imagePixels=0;
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i);
   if(workerData.mode==='images'){
    if(pdf.numPages>10)throw Error('一次 OCR 最多处理 10 页');
    const native=page.getViewport({scale:1});
    if(!Number.isFinite(native.width)||!Number.isFinite(native.height)||native.width<=0||native.height<=0)throw Error('PDF 页面尺寸无效');
    const scale=Math.min(1.25,1800/native.width,1800/native.height);
    const viewport=page.getViewport({scale});
    imagePixels+=Math.ceil(viewport.width)*Math.ceil(viewport.height);
    if(imagePixels>24_000_000)throw Error('OCR 图像总量过大，请拆分文件');
    const {createCanvas}=require('@napi-rs/canvas');
    const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const image=canvas.toDataURL('image/png');imageBytes+=Buffer.byteLength(image);
    if(imageBytes>16*1024*1024)throw Error('OCR 图像总量超过 16 MB，请拆分文件');
    pages.push({page:i,image});canvas.width=1;canvas.height=1;
   }else{
    const content=await page.getTextContent();
    const pageText=content.items.map(item=>typeof item.str==='string'?item.str+(item.hasEOL?'\n':' '):'').join('');
    pages.push({page:i,text:pageText});text+=pageText+'\n';
    if(text.length>1_000_000)throw Error('文档正文超出导入限制');
   }
   page.cleanup();
  }
  parentPort.postMessage({text,pages,warnings:[]});
 }finally{await loading.destroy();}
})().catch(error=>parentPort.postMessage({error:error.name==='PasswordException'?'文件已加密，请先解锁再导入':String(error.message||'文档解析失败').slice(0,200)}));
