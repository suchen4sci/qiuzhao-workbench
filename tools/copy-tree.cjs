const fs=require('fs'),path=require('path');
function copyTree(source,destination){
 fs.mkdirSync(destination,{recursive:true});
 for(const entry of fs.readdirSync(source,{withFileTypes:true})){
  const from=path.join(source,entry.name),to=path.join(destination,entry.name);
  if(entry.isSymbolicLink())throw Error('模板目录不允许符号链接');
  if(entry.isDirectory())copyTree(from,to);
  else fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
 }
}
module.exports={copyTree};
