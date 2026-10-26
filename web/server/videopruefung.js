/** Byteprüfung vor Video-Upload. Keine Clientdauer, keine Netzwerkprotokolle.
 * FFPROBE_PATH optional; ohne ffprobe scheitern neue Video-Beiträge geschlossen.
 */
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const Reel=require('../../gemeinsam/reel');
const run=promisify(execFile);
// Ausschließlich feste eigene Meldungen dürfen am API-Rand sichtbar werden.
class VideoFehler extends Error {}
function auswerten(daten){
 if(!daten.streams?.some(s=>s.codec_type==='video'))throw new VideoFehler('Die Datei enthält kein lesbares Video.');
 const zahlen=[Number(daten.format?.duration),...(daten.streams||[]).map(s=>Number(s.duration))].filter(n=>Number.isFinite(n)&&n>0);
 let anfang=Infinity,ende=-Infinity;
 for(const p of daten.packets||[]){const t=Number(p.pts_time),d=Number(p.duration_time);if(Number.isFinite(t)){anfang=Math.min(anfang,t);ende=Math.max(ende,t+(Number.isFinite(d)&&d>0?d:0));}}
 if(Number.isFinite(anfang)&&ende>anfang)zahlen.push(ende-anfang);
 const sekunden=Math.max(...zahlen);const fehler=Reel.pruefen(sekunden);if(fehler)throw new VideoFehler(fehler);
 // Ohne Paketzeitachse ist eine bloße Container-Dauer kein Bytebeleg.
 if(!Number.isFinite(anfang)||ende<=anfang)throw new VideoFehler('Die Videozeitachse konnte nicht geprüft werden.');
 return sekunden;
}
let aktiv=0;
async function pruefen(bytes){
 if(aktiv>=2)throw new VideoFehler('Die Videoprüfung ist ausgelastet. Bitte gleich erneut versuchen.');
 aktiv++;let ordner;
 try{
  ordner=await fs.mkdtemp(path.join(os.tmpdir(),'allmedia-video-'));
  const datei=path.join(ordner,'aufnahme');await fs.writeFile(datei,bytes,{mode:0o600});
  const {stdout}=await run(process.env.FFPROBE_PATH||'ffprobe',[
   '-v','error','-protocol_whitelist','file','-format_whitelist','mov,matroska,webm',
   '-show_entries','format=duration:stream=codec_type,duration:packet=pts_time,duration_time',
   '-show_packets','-of','json',datei],{timeout:45000,maxBuffer:24*1024*1024,windowsHide:true});
  return auswerten(JSON.parse(stdout));
 }catch(e){if(e.code==='ENOENT')throw new VideoFehler('Die Videoprüfung ist derzeit nicht verfügbar.');if(e.killed||e.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER')throw new VideoFehler('Die Datei ließ sich nicht vollständig prüfen. Bitte ein anderes Video wählen.');if(e.stderr)throw new VideoFehler('Die Videodatei ist beschädigt oder wird nicht unterstützt.');throw e;}
 finally{try{if(ordner)await fs.rm(ordner,{recursive:true,force:true});}finally{aktiv--;}}
}
function dienstclient(){
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new VideoFehler('Die Videoprüfung ist derzeit nicht verfügbar.');
 const {createClient}=require('@supabase/supabase-js');const {supabaseUrl}=require('./supabase');
 return createClient(supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
module.exports={VideoFehler,pruefen,auswerten,dienstclient};
