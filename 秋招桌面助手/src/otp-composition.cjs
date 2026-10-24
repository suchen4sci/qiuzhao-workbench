// Prevent an IME commit from being delivered again after an OTP widget moves focus.
function installOtpCompositionGuard(){
 if(window.__qiuzhaoOtpCompositionGuardV3)return;window.__qiuzhaoOtpCompositionGuardV3=true;
 let stroke=null;
 const valid=input=>{if(!input?.matches?.('input.code-input'))return false;const modal=input.closest('[class*="modal"],[class*="Modal"],[role="dialog"]');return !!modal&&modal.querySelectorAll('input.code-input').length===6;};
 const adapt=()=>{for(const input of document.querySelectorAll('input.code-input'))if(valid(input)&&input.type==='number'){input.type='text';input.inputMode='numeric';}};
 adapt();new MutationObserver(adapt).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['type']});
 window.addEventListener('keydown',event=>{if(valid(event.target)&&!event.ctrlKey&&!event.metaKey&&!event.altKey)stroke={accepted:false,previous:new WeakMap()};},true);
 window.addEventListener('beforeinput',event=>{
  if(!valid(event.target)||!stroke||!/^insert/.test(event.inputType)||/Paste/.test(event.inputType))return;
  stroke.previous.set(event.target,event.target.value);
  if(stroke.accepted){if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();}
 },true);
 window.addEventListener('input',event=>{
  if(!valid(event.target)||!stroke||/Paste/.test(event.inputType)||!/^\d+$/.test(event.data||''))return;
  if(stroke.accepted){
   // Non-cancelable IME edits must restore the box they wrongly reached. This
   // is transient widget state only; no digit is sent, logged or persisted.
   const previous=stroke.previous.get(event.target);if(previous!==undefined)event.target.value=previous;
   event.stopImmediatePropagation();return;
  }
  stroke.accepted=true; // Let the original widget distribute/advance normally.
 },true);
 window.addEventListener('keyup',event=>{if(!valid(event.target))return;const done=stroke;setTimeout(()=>{if(stroke===done)stroke=null;},0);},true);
}
module.exports={installOtpCompositionGuard};
