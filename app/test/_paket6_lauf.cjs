/** Prüfläufe ausschließlich aus eigenem Worktree/Server, Geheimnisse nur im RAM. */
require('./_ki_belegung').pruefeBelegung('testbestand');
const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process');
const W=path.resolve(__dirname,'../..');
if(!process.env.AM_ENV_DATEI||!process.env.AM_TOKEN_DATEI)throw Error('Umgebungs-/Tokendateipfad erforderlich');
process.loadEnvFile(process.env.AM_ENV_DATEI);
const token=fs.readFileSync(process.env.AM_TOKEN_DATEI,'utf8').match(/sbp_[A-Za-z0-9]+/);
if(!token)throw Error('Vorhandener Management-Token fehlt');process.env.SUPABASE_TOKEN=token[0];
process.env.SUPABASE_URL=process.env.EXPO_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_ANON_KEY=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
process.env.ZIEL='http://127.0.0.1:3300';
process.env.NODE_OPTIONS='--require='+path.join(__dirname,'_bunny_port3300.cjs');
async function sauber(){
 const {frage}=require('./_aufraeumen');
 const filter="actor_id in (select id from auth.users where email in ('test@all-media.app','all.media.prueflauf@web.de')) or user_id in (select id from auth.users where email in ('test@all-media.app','all.media.prueflauf@web.de'))";
 const x=await frage(`with weg as (delete from notifications where ${filter} returning 1) select count(*) as geloescht from weg`);
 const y=await frage(`select count(*) as anzahl from notifications where ${filter}`);
 console.log('Beide erlaubten Testkonten: Mitteilungen entfernt',x?.[0]?.geloescht,'Rest',y?.[0]?.anzahl);
 if(Number(y?.[0]?.anzahl)!==0)throw Error('Testmitteilungen nicht leer');
}
(async()=>{
 const args=process.argv.slice(2);
 if(args[0]==='bereinigen')return sauber();
 if(!args.length)throw Error('Prüfdateien fehlen');
 // Der 3000-Wächter greift am eigenen Port nicht: hier Quelle und Version prüfen.
 const pids=spawnSync('lsof',['-nP','-tiTCP:3300','-sTCP:LISTEN'],{encoding:'utf8'}).stdout.trim().split(/\s+/).filter(Boolean);
 if(pids.length!==1)throw Error('Eigener Server nicht eindeutig');
 const ps=spawnSync('ps',['-p',pids[0],'-o','command='],{encoding:'utf8'}).stdout;
 if(!ps.includes(path.join(W,'app/test/_paket6_server.cjs')))throw Error('3300 gehört nicht dem Paket-6-Prüfserver');
 const v=await fetch(process.env.ZIEL+'/api/version',{signal:AbortSignal.timeout(5000)});if(!v.ok)throw Error('Version nicht erreichbar');
 console.log('Eigener Paket-6-Server bestätigt; PID',pids[0]);
 for(const datei of args){
  if(!/^[_a-z0-9-]+\.(?:js|cjs)$/.test(datei)||!fs.existsSync(path.join(__dirname,datei)))throw Error('Keine zulässige Prüfdatei');
  const log=path.join(W,'pruefbelege/paket-6/live-'+datei.replace(/\.(c?js)$/,'')+'.log'),fd=fs.openSync(log,'a');
  console.log('START',datei);
  const p=spawn(process.execPath,['test/'+datei],{cwd:path.join(W,'app'),env:process.env,stdio:['ignore',fd,fd]});fs.closeSync(fd);
  const code=await new Promise((r,j)=>{p.once('error',j);p.once('exit',r);});console.log('ENDE',datei,code);if(code)process.exitCode=1;
  if(datei!=='alles.js')await sauber();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
