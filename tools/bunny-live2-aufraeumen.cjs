/** Nur eigene Runde-2-Prüfbeiträge und freigegebene Medien entfernen, Mitteilungen nachzählen. */
const assert=require('assert/strict');
const {supabase}=require('../web/server/supabase');
const {TESTKONTO_PASS}=require('../app/test/_testpasswoerter');
const {frage,aufraeumen,zaehlen}=require('../app/test/_aufraeumen');
const Bunny=require('../web/server/bunny');
(async()=>{
 const {data,error}=await supabase.auth.signInWithPassword({email:'test@all-media.app',password:TESTKONTO_PASS});assert.ifError(error);
 const uid=data.user.id,token=data.session.access_token;
 async function api(route,body){const r=await fetch('http://127.0.0.1:3300'+route,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const z=await r.json();assert.ok(r.ok&&z.ok,'Bereinigung '+route);}
 const {data:posts,error:e}=await supabase.from('posts').select('id').eq('user_id',uid).like('description','Bunny-Runde2-%');assert.ifError(e);
 console.log('Eigene Runde-2-Beiträge vorher '+posts.length);
 for(const p of posts)await api(`/api/eigene/${p.id}/loeschen`,{});
 const objekte=await frage(`select pfad from public.medien_objekte where owner_id='${uid}' and public.ist_testkonto(owner_id)`);assert.ok(Array.isArray(objekte));
 let entfernt=0;
 for(const z of objekte){const {data:recht,error:e}=await supabase.rpc('medium_loeschrecht',{p_pfad:z.pfad});assert.ifError(e);if(recht==='bunny'){await api('/api/medien/loeschen',{pfad:z.pfad});entfernt++;}}
 console.log('Eigene unreferenzierte Bunny-Belege bereinigt '+entfernt);
 const {count,error:restFehler}=await supabase.from('posts').select('id',{count:'exact',head:true}).eq('user_id',uid).like('description','Bunny-Runde2-%');assert.ifError(restFehler);assert.equal(count,0);console.log('Eigene Runde-2-Beiträge nachher '+count);
 const rest=await frage(`select count(*) as anzahl from public.medien_objekte where owner_id='${uid}' and public.ist_testkonto(owner_id)`);console.log('Bunny-Belege Testkonto nachher '+rest[0].anzahl);assert.equal(Number(rest[0].anzahl),0);
 const probe=await Bunny.erstelleBunny(Bunny.konfigurationAus()).auflisten('_probe');assert.ok(probe.ok);assert.equal(probe.dateien.length,0);console.log('Bunny _probe nachher 0');
 for(const mail of ['all.media.prueflauf@web.de','test@all-media.app']){process.env.AM_TEST_MAIL=mail;const vor=await zaehlen();assert.ok(Array.isArray(vor));await aufraeumen();const nach=await zaehlen();assert.equal(Number(nach?.[0]?.anzahl),0);console.log(mail+' Mitteilungen '+vor[0].anzahl+' → 0');}
})().catch(e=>{console.error('FEHL '+e.message);process.exitCode=1;});
