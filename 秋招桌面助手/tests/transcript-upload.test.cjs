const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {allows,chooseTranscript,authorized}=require('../src/transcript-upload.cjs');
const catalog={transcript_policy:{status:'user-confirmed',preferred_formats:['png','pdf']},attachments:[
 {kind:'课程成绩单',education_level:'研究生',path:'graduate.png',format:'png',status:'user-confirmed'},
 {kind:'课程成绩单',education_level:'研究生',path:'graduate.pdf',status:'user-confirmed'},
 {kind:'课程成绩单',education_level:'本科',path:'undergraduate.png',format:'png',status:'user-confirmed'}
]};
test('image first, explicit PDF-only falls back, education identity stays separate',()=>{
 assert.equal(chooseTranscript(catalog,'研究生','').path,'graduate.png');
 assert.equal(chooseTranscript(catalog,'研究生','.pdf, image/png').path,'graduate.png');
 assert.equal(chooseTranscript(catalog,'研究生','application/pdf').path,'graduate.pdf');
 assert.equal(chooseTranscript(catalog,'本科','image/*').path,'undergraduate.png');
 assert.equal(chooseTranscript(catalog,'研究生','image/jpeg'),null);
 assert.equal(chooseTranscript(catalog,'博士',''),null);
 assert.equal(chooseTranscript({...catalog,transcript_policy:{status:'provisional'}},'本科',''),null);
 assert.equal(allows('png','.PDF'),false);
});
test('ambiguous attachments and paths outside authorized transcript directory refused',()=>{
 assert.equal(chooseTranscript({...catalog,attachments:[...catalog.attachments,{...catalog.attachments[0],path:'another.png'}]},'研究生',''),null);
 const root=path.resolve('fixture-workspace'),p={workspaceRoot:root,workflow:{upload_authorized:['uploads/transcripts']}};
 assert.equal(authorized(p,{path:path.join(root,'uploads/transcripts/file.png')}),true);
 assert.equal(authorized(p,{path:path.join(root,'uploads/other/file.png')}),false);
 assert.equal(authorized(p,{path:path.join(root,'uploads/transcripts/../../secret.png')}),false);
 assert.equal(authorized({...p,workflow:{}},{path:path.join(root,'uploads/transcripts/file.png')}),false);
});
