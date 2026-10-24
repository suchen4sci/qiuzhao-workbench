const test=require('node:test'),assert=require('node:assert/strict');
const {DesktopTabs}=require('../src/desktop-tabs.cjs');
const navigation=require('../src/attachment-navigation.cjs');
navigation.openAttachment=async(wc,url)=>wc.downloadURL(url);
function fixture(){
 let handler;const downloads=[],opened=[],errors=[];
 const wc={setWindowOpenHandler(fn){handler=fn;},downloadURL(url){downloads.push(url);}};
 const host={window:{webContents:{executeJavaScript:async()=>false,send:(_,e)=>errors.push(e)}},openFrom:async(id,url)=>opened.push({id,url})};
 DesktopTabs.prototype.configureNavigation.call(host,'parent',{webContents:wc});
 return {run:url=>handler({url}),downloads,opened,errors,wc};
}
test('signed Beisen download preserves parent and creates no blank tab',async()=>{
 const f=fixture(),url='https://qiyuanzp.zhiye.com/AccessAuthorityPortalFile/download/recruitnewportalfile/example.pdf?sig=fixture';
 assert.equal(f.run(url).action,'deny');await new Promise(setImmediate);
 assert.deepEqual(f.downloads,[url]);assert.deepEqual(f.opened,[]);
});
test('normal recruitment and PDF preview pages still open as tabs',async()=>{
 const f=fixture();for(const url of ['https://qiyuanzp.zhiye.com/form?jobAdId=test','https://qiyuanzp.zhiye.com/preview/example.pdf','https://other.example/AccessAuthorityPortalFile/download/x'])f.run(url);
 await new Promise(setImmediate);assert.equal(f.opened.length,3);assert.equal(f.downloads.length,0);
});
test('download failure reports error without creating a blank tab',async()=>{
 const f=fixture();f.wc.downloadURL=()=>{throw Error('failed');};
 f.run('https://qiyuanzp.zhiye.com/AccessAuthorityPortalFile/download/x');
 await new Promise(setImmediate);
 assert.equal(f.errors.length,1);assert.equal(f.opened.length,0);
});
