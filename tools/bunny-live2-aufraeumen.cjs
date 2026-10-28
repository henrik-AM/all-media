/** Nur eigene Runde-2-Prüfbeiträge und freigegebene Medien entfernen, Mitteilungen nachzählen. */
const assert=require('assert/strict');
const {supabase}=require('../web/server/supabase');
const {TESTKONTO_PASS,PRUEFKONTO_PASS}=require('../app/test/_testpasswoerter');
const {frage,aufraeumen,zaehlen}=require('../app/test/_aufraeumen');
const Bunny=require('../web/server/bunny');
// Ein fehlender Ordner ist nach echtem HTTP404 ebenfalls nachweislich leer.
const speicher=Bunny.erstelleBunny(Bunny.konfigurationAus(),{abruf:async(url,opt)=>{const r=await fetch(url,opt);if(opt.method==='GET'&&r.status===404)return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});return r;}});
(async()=>{
 for(const [email,password] of [['test@all-media.app',TESTKONTO_PASS],['all.media.prueflauf@web.de',PRUEFKONTO_PASS]]){
 console.log('Bereinigung '+email);
 const {data,error}=await supabase.auth.signInWithPassword({email,password});assert.ifError(error);
 const uid=data.user.id,token=data.session.access_token;
 async function api(route,body){const r=await fetch('http://127.0.0.1:3300'+route,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const z=await r.json();assert.ok(r.ok&&z.ok,'Bereinigung '+route);}
 const {data:posts,error:e}=await supabase.from('posts').select('id').eq('user_id',uid).like('description','Bunny-Runde2-%');assert.ifError(e);
 console.log('Eigene Runde-2-Beiträge vorher '+posts.length);
 for(const p of posts)await api(`/api/eigene/${p.id}/loeschen`,{});
 if(process.argv.includes('--nach-gesamtlauf')){await api('/api/reset',{});console.log('Prüfkonto auf Startzustand zurückgesetzt');}
 const objekte=await frage(`select pfad from public.medien_objekte where owner_id='${uid}' and public.ist_testkonto(owner_id)`);assert.ok(Array.isArray(objekte));
 let entfernt=0;
 for(const z of objekte){const {data:recht,error:e}=await supabase.rpc('medium_loeschrecht',{p_pfad:z.pfad});assert.ifError(e);if(recht==='bunny'){await api('/api/medien/loeschen',{pfad:z.pfad});entfernt++;}}
 console.log('Eigene unreferenzierte Bunny-Belege bereinigt '+entfernt);
 const {count,error:restFehler}=await supabase.from('posts').select('id',{count:'exact',head:true}).eq('user_id',uid).like('description','Bunny-Runde2-%');assert.ifError(restFehler);assert.equal(count,0);console.log('Eigene Runde-2-Beiträge nachher '+count);
 const rest=await frage(`select count(*) as anzahl from public.medien_objekte where owner_id='${uid}' and public.ist_testkonto(owner_id)`);console.log('Bunny-Belege Testkonto nachher '+rest[0].anzahl);assert.equal(Number(rest[0].anzahl),0);
 for(const ordner of ['posts','stories','avatars','messages','insights','ptt']){
  const liste=await speicher.auflisten(ordner);assert.ok(liste.ok);
  const eigene=liste.dateien.filter(z=>z.name.startsWith(uid+'-'));
  for(const z of eigene){const p=ordner+'/'+z.name;const {data:benutzt,error:e}=await supabase.rpc('bunny_medium_referenziert',{p_pfad:p});assert.ifError(e);assert.equal(benutzt,false,'Verwaiste Testdatei hat Referenz');const weg=await speicher.loeschen(p);assert.ok(weg.ok||weg.fehlt);}
  const nach=await speicher.auflisten(ordner);assert.ok(nach.ok);assert.equal(nach.dateien.filter(z=>z.name.startsWith(uid+'-')).length,0);
  console.log('Bunny '+ordner+' eigene Testdateien nachher 0');
 }
 }
 const probe=await speicher.auflisten('_probe');assert.ok(probe.ok);assert.equal(probe.dateien.length,0);console.log('Bunny _probe nachher 0');
 for(const mail of ['all.media.prueflauf@web.de','test@all-media.app']){process.env.AM_TEST_MAIL=mail;const vor=await zaehlen();assert.ok(Array.isArray(vor));await aufraeumen();const nach=await zaehlen();assert.equal(Number(nach?.[0]?.anzahl),0);console.log(mail+' Mitteilungen '+vor[0].anzahl+' → 0');}
})().catch(e=>{console.error('FEHL '+e.message);process.exitCode=1;});
