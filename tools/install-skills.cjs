const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const source=path.resolve(__dirname,'../skills');
const destination=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills');
fs.mkdirSync(destination,{recursive:true});
for(const name of ['qiuzhao-assistant','repair-resume']){
 const target=path.join(destination,name);
 if(fs.existsSync(target)){console.log('保留已安装技能：'+target+'；如需更新请先备份后手动合并。');continue;}
 require('./copy-tree.cjs').copyTree(path.join(source,name),target);console.log('已安装：'+target);
}
