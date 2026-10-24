function portalPath(origin,pathname){
 // Moka uses two routes for the same tenant form. Keep company and form ID exact.
 if(origin==='https://app.mokahr.com')return pathname.replace(/^\/(campus_apply|campus-recruitment)\//,'/campus-recruitment/');
 return pathname;
}
module.exports={portalPath};
