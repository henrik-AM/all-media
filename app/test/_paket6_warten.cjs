/** Wartet ohne fremde Belegung zu verändern; startet nach atomarer eigener
 * Belegung den isolierten Server und die ausdrücklich beauftragte Liveprobe.
 * Bleibt beim Ergebnis für Hauptsitzung verfügbar; gibt Bestand nie vor der
 * geprüften Bereinigung und den weiteren Abnahmen vorzeitig frei.
 */
const {spawn,spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const W=path.resolve(__dirname,'../..'),OUT=path.join(W,'pruefbelege/paket-6');
const abgleich=process.env.KI_ABGLEICH||path.join(require('node:os').homedir(),'Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/Claude/Uebergabe/ki-abgleich.sh');
const aus=t=>console.log(new Date().toISOString(),t);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const start=Date.now();
 for(;;){
  const r=spawnSync('bash',[abgleich,'belegen','codex','testbestand','Paket 6: Zwei-Konten-Liveprobe, native Abnahme und eigener Gesamtlauf'],{encoding:'utf8',timeout:15000});
  if(r.status===0){aus('Eigene Testbestand-Belegung erworben.');break;}
  if(r.status!==3)throw new Error('Belegung unklar; Ausgang '+r.status);
  if(Date.now()-start>3*60*60*1000)throw new Error('Nach 3 Stunden weiterhin fremd belegt; keine Anmeldung durchgeführt');
  aus('Testbestand weiterhin fremd belegt; keine Anmeldung.');await pause(30000);
 }
 // Keinen fremden Server verdrängen.
 const belegt=spawnSync('lsof',['-nP','-tiTCP:3300','-sTCP:LISTEN'],{encoding:'utf8'});
 if(belegt.stdout.trim())throw new Error('3300 ist belegt; kein fremder Prozess beendet');
 const env={...process.env,ZIEL:'http://127.0.0.1:3300',KI_NAME:'codex'};
 const fd=fs.openSync(path.join(OUT,'live-server.log'),'a');
 const server=spawn(process.execPath,['app/test/_paket6_server.cjs'],{cwd:W,env,stdio:['ignore',fd,fd]});fs.closeSync(fd);
 fs.writeFileSync(path.join(OUT,'live-server.pid'),String(server.pid));server.unref();
 let bereit=false;
 for(let i=0;i<20;i++){
  try{const r=await fetch(env.ZIEL+'/api/version',{signal:AbortSignal.timeout(2000)});if(r.ok){bereit=true;break;}}catch{}
  await pause(500);
 }
 if(!bereit)throw new Error('Eigener Server wurde nicht bereit; Serverlog prüfen');
 aus('Eigener Prüfserver bereit, PID '+server.pid);
 const log=fs.openSync(path.join(OUT,'live-zwei-konten.log'),'a');
 const p=spawn(process.execPath,['app/test/_paket6_live.cjs'],{cwd:W,env,stdio:['ignore',log,log]});fs.closeSync(log);
 const code=await new Promise((res,rej)=>{p.once('error',rej);p.once('exit',res);});
 aus('Liveprobe beendet, Ausgang '+code+'; Bestand für weitere Prüfung weiterhin selbst belegt.');
 process.exitCode=code||0;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
