/** Echte Kleinstprobe. Nur _probe/, keine Schlüssel/Signaturen im Ergebnis. */
const B=require('../../web/server/bunny');
const crypto=require('crypto');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {execFileSync}=require('child_process');
async function main(){
 const konfig=B.konfigurationAus();if(!konfig.ok)throw Error('Bunny-Konfiguration fehlt');
 const a=B.erstelleBunny(konfig),prefix=`live-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bunny-live-'));
 const bild=`_probe/${prefix}.jpg`,video=`_probe/${prefix}.mp4`,angelegt=[];
 const ergebnis={};
 const get=(u,opts={})=>fetch(u,{...opts,redirect:'error',signal:AbortSignal.timeout(20000)});
 try{
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=96x64','-frames:v','1',path.join(tmp,'bild.jpg')]);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=96x64:r=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(tmp,'video.mp4')]);
  const b=fs.readFileSync(path.join(tmp,'bild.jpg')),v=fs.readFileSync(path.join(tmp,'video.mp4'));
  if(v.length>=200000)throw Error('Probevideo zu groß');
  for(const [p,bytes,typ] of [[bild,b,'image/jpeg'],[video,v,'video/mp4']]){
   angelegt.push(p);const r=await a.hochladen(p,bytes,typ,{pruefen:false});if(!r.ok)throw Error('Probeupload fehlgeschlagen');
  }
  const url=a.signierteAdresse(bild,60),r=await get(url),bytes=Buffer.from(await r.arrayBuffer());
  ergebnis.bild={status:r.status,bytes:b.length,identisch:crypto.createHash('sha256').update(bytes).digest('hex')===crypto.createHash('sha256').update(b).digest('hex')};
  const alt=B.adresseBauen({basis:konfig.auslieferung,schluessel:konfig.tokenSchluessel,pfad:'/'+bild,ablauf:Math.floor(Date.now()/1000)-60});
  ergebnis.ohneToken=(await get(konfig.auslieferung+'/'+bild)).status;
  ergebnis.abgelaufen=(await get(alt)).status;
  ergebnis.fremderPfad=(await get(url.replace(bild,video))).status;
  const range=await get(a.signierteAdresse(video,60),{headers:{Range:'bytes=0-31'}});
  const rb=Buffer.from(await range.arrayBuffer());
  ergebnis.video={bytes:v.length,status:range.status,contentRange:range.headers.get('content-range'),identisch:rb.equals(v.subarray(0,32))};
  // Bei 403 bleibt der Nachweis rot. Eine Tokenkorrektur erfolgt separat nach offizieller Doku.
 }finally{
  ergebnis.loeschen=[];
  for(const p of angelegt){const weg=await a.loeschen(p);const liste=await a.auflisten('_probe');const status=(await get(a.signierteAdresse(p,60))).status;ergebnis.loeschen.push({ok:weg.ok,verschwunden:liste.ok&&!liste.dateien.some(z=>z.name===p.split('/')[1]),status});}
  const rest=await a.auflisten('_probe');ergebnis.probeRest=rest.ok?rest.dateien.length:null;
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(JSON.stringify(ergebnis,null,2));
 }
 if(ergebnis.bild?.status!==200||!ergebnis.bild?.identisch||ergebnis.ohneToken!==403||ergebnis.abgelaufen!==403||ergebnis.fremderPfad!==403||ergebnis.video?.status!==206||!ergebnis.video?.identisch||ergebnis.loeschen.some(z=>!z.ok||!z.verschwunden||z.status===200)||ergebnis.probeRest!==0)process.exitCode=1;
}
main().catch(()=>{console.error('Live-Probe fehlgeschlagen; keine Zugangsdaten ausgegeben.');process.exitCode=1;});
