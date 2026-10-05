(() => {
 if(window.__addressBarInstalled)return;
 window.__addressBarInstalled=true;
 const input=document.getElementById('url'),form=document.getElementById('navigation');
 let draft=null,latest=input.value,version=0;
 input.addEventListener('input',()=>{draft=input.value;version++;});
 window.desktop.onState(({type,data})=>{
   if(type!=='navigation')return;
   latest=data.url.startsWith('file:')?'':data.url;
   input.value=draft===null?latest:draft;
 });
 form.onsubmit=event=>{
   event.preventDefault();
   if(input.disabled)return;
   const submitted=input.value,revision=version;
   if(!submitted.trim()){toast('请输入网址或搜索内容');input.focus();return;}
   attempt(async()=>{
     await call('navigate',submitted);
     // A newer edit made during navigation belongs to the user, not the page.
     if(version===revision){draft=null;input.value=latest;}
   });
 };
 input.addEventListener('keydown',event=>{
   if(event.key==='Escape'){draft=null;version++;input.value=latest;input.select();}
 });
 document.addEventListener('keydown',event=>{
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='l'){
     event.preventDefault();input.focus();input.select();
   }
 });
})();
