/** Eigenes migriertes Testmedium: Bunny löschen, Supabase-Original ausdrücklich behalten. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {dienst,testumgebung,basis,frage}=require('./bunny-umzug-helfer.cjs');
require('../app/test/_ki_belegung').pruefeBelegung();testumgebung();
const {supabase}=require('../web/server/supabase');const Bunny=require('../web/server/bunny');
const web='https://all-media-website.onrender.com';
const aus=path.resolve('pruefbelege/bunny-umzug');
(async()=>{
 const key=await dienst();
 const {data,error}=await supabase.auth.signInWithPassword({email:'test@all-media.app',password:process.env.AM_TESTKONTO_PASS});assert.ifError(error);
 const token=data.session.access_token,uid=data.user.id;
 const pfad=`posts/${uid}-umzug-loeschprobe-${Date.now()}.jpg`;
 const bild=require('child_process').execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=32x32','-frames:v','1','-f','image2pipe','-vcodec','mjpeg','pipe:1']);
 const sha256=crypto.createHash('sha256').update(bild).digest('hex');
 const ergebnis={pfad,bytes:bild.length,sha256,quelleBleibtAbsichtlich:true,pruefungen:[]};
 fs.writeFileSync(path.join(aus,'08-loeschprobe.json'),JSON.stringify(ergebnis,null,2)+'\n');
 const check=(n,b)=>{assert.ok(b,n);ergebnis.pruefungen.push(n);console.log('PASS '+n);fs.writeFileSync(path.join(aus,'08-loeschprobe.json'),JSON.stringify(ergebnis,null,2)+'\n');};
 async function api(route,body){const r=await fetch(web+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);return r.json();}
 const hoch=await supabase.storage.from('media').upload(pfad,bild,{contentType:'image/jpeg',upsert:false});assert.ifError(hoch.error);check('Eigene Supabase-Testquelle angelegt',true);
 const adapter=Bunny.erstelleBunny(Bunny.konfigurationAus());
 check('Testquelle zu Bunny kopiert',(await adapter.hochladen(pfad,bild,'image/jpeg')).ok);
 const reg=await fetch(basis+'/rest/v1/rpc/medien_umzug_registrieren',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_pfad:pfad,p_typ:'image/jpeg',p_bytes:bild.length,p_sha256:sha256}),signal:AbortSignal.timeout(30000)});
 check('Testquelle als Altmedium registriert',reg.ok&&(await reg.json())==='bunny');
 const sig=await api('/api/medien/unterschreiben',{pfade:[pfad]});const url=sig.dateien?.[0]?.url;check('Produktion signiert Bunny',sig.ok&&!!url&&new URL(url).hostname==='allmedia-cdn.b-cdn.net');
 const vor=await fetch(url,{signal:AbortSignal.timeout(15000)});check('Bunny vor DELETE 200, gleiche Bytes',vor.status===200&&Buffer.from(await vor.arrayBuffer()).equals(bild));
 const start=Date.now();check('Produktions-DELETE erfolgreich',(await api('/api/medien/loeschen',{pfad})).ok);
 let status;do {const r=await fetch(url,{signal:AbortSignal.timeout(10000)});status=r.status;await r.body?.cancel();if(status===404)break;await new Promise(r=>setTimeout(r,500));}while(Date.now()-start<30000);
 ergebnis.nachDeleteMs=Date.now()-start;check('Gleiche gecachte Bunny-Signatur nach DELETE 404',status===404);
 const liste=await adapter.auflisten('posts');check('Datei nicht mehr in Bunny-Liste',liste.ok&&!liste.dateien.some(e=>'posts/'+e.name===pfad));
 const erneut=await api('/api/medien/unterschreiben',{pfade:[pfad]});check('Neue Signatur verweigert; kein Supabase-Rückfall',erneut.ok&&erneut.dateien?.[0]?.url===null);
 const original=await supabase.storage.from('media').download(pfad);assert.ifError(original.error);check('Supabase-Original bleibt bytegleich',Buffer.from(await original.data.arrayBuffer()).equals(bild));
 const rows=await frage(`select migriert_am is not null as migriert,geloescht_am is not null as geloescht from public.medien_objekte where pfad='${pfad}'`);check('Dauerhafte Löschmarke bleibt',rows.length===1&&rows[0].migriert&&rows[0].geloescht);
 console.log(`${ergebnis.pruefungen.length}/${ergebnis.pruefungen.length} Prüfungen; Quelle und Löschmarke bleiben absichtlich erhalten.`);
})().catch(e=>{console.error('FEHL '+e.message);process.exitCode=1;});
