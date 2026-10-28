/** Zwei vollständige Läufe, derselbe Live-Datenbankstand, seriell auf Port 3300. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),main=path.resolve(root,'../bunny-live2-main');
const aus=path.join(root,'pruefbelege/bunny-live2');
require('../app/test/_ki_belegung').pruefeBelegung();
let server,lauf;
const nurMain=process.argv.includes('--nur-main');
const status=nurMain?JSON.parse(fs.readFileSync(path.join(aus,'05-status.json'),'utf8')):[];
function manifest(cwd){
 const krypto=require('crypto'),liste=[];
 const sammel=p=>{if(!fs.existsSync(p))return;const z=fs.statSync(p);if(z.isFile()){liste.push({pfad:path.relative(cwd,p),sha256:krypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});return;}for(const e of fs.readdirSync(p,{withFileTypes:true}))if(e.name!=='node_modules'&&!e.name.startsWith('.'))sammel(path.join(p,e.name));};
 for(const p of ['app/test','app/lib','app/tools/pruefgeraet.js','gemeinsam','web/server','web/public'])sammel(path.join(cwd,p));return liste.sort((a,b)=>a.pfad.localeCompare(b.pfad));
}
const warte=ms=>new Promise(r=>setTimeout(r,ms));
function start(args,cwd,env,log){const fd=fs.openSync(log,'w');const p=spawn(process.execPath,args,{cwd,env,stdio:['ignore',fd,fd]});fs.closeSync(fd);return p;}
async function ende(p){return new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',(code,signal)=>resolve({code,signal}));});}
async function serverAus(){if(!server)return;const p=server;server=null;const fertig=ende(p);p.kill('SIGTERM');await fertig;}
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{lauf?.kill(s);server?.kill(s);process.exitCode=1;});
(async()=>{
 const r=await fetch('https://api.supabase.com/v1/projects/ijztosbjfybdgotpdixw/api-keys?reveal=true',{headers:{Authorization:`Bearer ${process.env.SUPABASE_TOKEN}`},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Verwaltungsabruf HTTP '+r.status);
 const key=(await r.json()).find(k=>k.name==='service_role')?.api_key;if(!key)throw Error('Dienstschlüssel fehlt');
 for(const [name,cwd] of (nurMain?[['main',main]]:[['bunny-live',root],['main',main]])){
  const vorher=manifest(cwd);fs.writeFileSync(path.join(aus,`05-${name}-manifest-vorher.json`),JSON.stringify(vorher,null,2)+'\n');
  const env={...process.env,PORT:'3300',SUPABASE_SERVICE_ROLE_KEY:key};
  if(name==='main')for(const k of Object.keys(env))if(k.startsWith('BUNNY_'))delete env[k];
  server=start(['web/server/lokal.js'],cwd,env,path.join(aus,`05-${name}-server.txt`));
  for(let i=0;;i++){if(server.exitCode!==null)throw Error(name+' Server beendet');try{const r=await fetch('http://127.0.0.1:3300',{signal:AbortSignal.timeout(2000)});if(r.ok)break;}catch{}if(i>=30)throw Error('Serverstart Zeitgrenze');await warte(500);}
  env.BUNNY_PRUEF_ROOT=path.join(cwd,'app/test');
  env.NODE_OPTIONS=[process.env.NODE_OPTIONS||'',`--require=${path.join(root,'app/test/_bunny_port3300.cjs')}`].filter(Boolean).join(' ');
  const beginn=new Date().toISOString();console.log(name+' Start '+beginn);
  lauf=start(['test/alles.js'],path.join(cwd,'app'),env,path.join(aus,`05-${name}-alles.txt`));
  const ergebnis=await ende(lauf);lauf=null;
  const nachher=manifest(cwd);fs.writeFileSync(path.join(aus,`05-${name}-manifest-nachher.json`),JSON.stringify(nachher,null,2)+'\n');
  console.log(name+' Manifest unverändert '+(JSON.stringify(vorher)===JSON.stringify(nachher)));
  status.push({name,stand:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim(),beginn,ende:new Date().toISOString(),...ergebnis});
  fs.writeFileSync(path.join(aus,'05-status.json'),JSON.stringify(status,null,2)+'\n');
  console.log(name+' beendet '+JSON.stringify(ergebnis));
  await serverAus();
 }
})().catch(e=>{console.error('Vergleich fehlgeschlagen: '+e.message);process.exitCode=1;}).finally(serverAus);
