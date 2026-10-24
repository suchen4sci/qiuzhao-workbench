const{normalize}=require('./rules.cjs');
function sameMajor(expected,observed){const clean=s=>normalize(String(s||'').replace(/[（(]\+?AI[）)]?$/i,''));return !!expected&&!!observed&&clean(expected)===clean(observed);}
function canRepairParsedMajor(record,control){const id=control.recordIdentity||{};return !!control.structuredRecord&&!!id.level&&normalize(id.school)===normalize(record.school)&&sameMajor(record.major,control.observedValue)&&String(record.major)!==String(control.observedValue);}
module.exports={sameMajor,canRepairParsedMajor};
