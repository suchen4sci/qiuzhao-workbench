function alive(view){try{return !!view?.webContents&&!view.webContents.isDestroyed();}catch{return false;}}
function authPopup(raw){
 try{const u=new URL(raw);return ['http:','https:'].includes(u.protocol)&&(/^(accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com)$/.test(u.hostname)||/\/(auth|oauth2?|login|signin)(?:\/|$)/i.test(u.pathname));}catch{return false;}
}
function recoveryUrl(raw,fallback){
 try{const u=new URL(raw);if(!['http:','https:'].includes(u.protocol))return fallback;
 // One-time OAuth codes must not be replayed after a view has closed.
 return authPopup(raw)||u.searchParams.has('code')?u.origin+'/':u.href;
 }catch{return fallback;}
}
module.exports={alive,authPopup,recoveryUrl};
