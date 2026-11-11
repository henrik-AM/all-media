/** Vollständiges Journal vor Austausch schreiben; SIGKILL zerreißt nicht das Ziel. */
function schreiben(datei,inhalt,fs=require('node:fs')){
 const tmp=datei+'.tmp-'+process.pid;
 fs.writeFileSync(tmp,JSON.stringify(inhalt,null,2),{mode:0o600});
 fs.renameSync(tmp,datei);
}
module.exports={schreiben};
