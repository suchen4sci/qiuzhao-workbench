const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
function fixture(body){
 const opened=[],written=[];let requestOptions;
 const fakeElectron={app:{getPath:()=>'/temp'},shell:{openPath:async p=>{opened.push(p);return '';}},net:{request(options){requestOptions=options;const request=new EventEmitter();request.abort=()=>{};request.end=()=>queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=200;response.headers={'content-disposition':['attachment; filename="中文简历.pdf"']};request.emit('response',response);response.emit('data',Buffer.from(body));response.emit('end');});return request;}}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/attachment-navigation.cjs'),'utf8'),{module,URL,Buffer,setTimeout,clearTimeout,require:name=>name==='electron'?fakeElectron:name==='node:fs/promises'?{mkdtemp:async()=>'/temp/preview',writeFile:async(p,b)=>written.push(b)}:require(name)});
 return {...module.exports,opened,written,getOptions:()=>requestOptions};
}
test('PDF with Chinese response filename opens through native request and keeps session',async()=>{
 const f=fixture('%PDF-1.7\nfixture'),session={};await f.openAttachment({session},'https://qiyuanzp.zhiye.com/AccessAuthorityPortalFile/download/test.pdf');
 assert.equal(f.getOptions().session,session);assert.equal(f.getOptions().useSessionCookies,true);assert.equal(f.opened.length,1);assert.equal(f.written.length,1);
});
test('login HTML returned as attachment is not opened as PDF',async()=>{
 const f=fixture('<html>login</html>');await assert.rejects(f.openAttachment({session:{}},'https://qiyuanzp.zhiye.com/AccessAuthorityPortalFile/download/test.pdf'),/有效PDF/);assert.equal(f.opened.length,0);
});
