const test=require('node:test'),assert=require('node:assert/strict');
const {alive,authPopup,recoveryUrl}=require('../src/browser-lifecycle.cjs');
test('missing/destroyed web contents are distinguished from a live view',()=>{
 assert.equal(alive(undefined),false);assert.equal(alive({}),false);
 assert.equal(alive({webContents:{isDestroyed:()=>true}}),false);
 assert.equal(alive({webContents:{isDestroyed:()=>false}}),true);
 assert.equal(alive({get webContents(){throw Error('Object has been destroyed')}}),false);
});
test('OAuth gets a separate popup and recovery never replays its one-time code',()=>{
 assert.equal(authPopup('https://accounts.google.com/o/oauth2/auth'),true);
 assert.equal(authPopup('https://app.eightfold.ai/auth?code=secret'),true);
 assert.equal(authPopup('https://company.example/jobs/123'),false);
 assert.equal(authPopup('javascript:window.close()'),false);
 assert.equal(recoveryUrl('https://app.eightfold.ai/auth?code=secret&state=x','fallback'),'https://app.eightfold.ai/');
 assert.equal(recoveryUrl('https://company.example/apply?id=123','fallback'),'https://company.example/apply?id=123');
});
