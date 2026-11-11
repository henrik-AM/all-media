/** Paket 6: echte Zwei-Konten-/App-Logik-/Website-Rundreise, kein Reset/Schema.
 * Nur mit exklusiver Sitzungsbelegung; erzeugt eigene Chat-/Gerätefixtures,
 * protokolliert IDs für Wiederaufnahme, prüft Bereinigung ausdrücklich.
 * ZIEL muss den eigenen Paket-6-Server bezeichnen (Port 3300).
 */
require('./_ki_belegung').pruefeBelegung('testbestand');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
if(process.env.AM_ENV_DATEI)process.loadEnvFile(process.env.AM_ENV_DATEI);
const {TESTKONTO_PASS,PRUEFKONTO_PASS}=require('./_testpasswoerter');
const {createClient}=require('@supabase/supabase-js');
const {chromium}=require('playwright-core');
const {medienEgressSchuetzen}=require('./_medien_egressschutz');
const {app:appRuntime,Krypto}=require('./_paket6_hilfe.cjs');
const W=path.resolve(__dirname,'../..'),OUT=path.join(W,'pruefbelege/paket-6'),ZIEL=process.env.ZIEL;
if(!ZIEL||!/^http:\/\/(127\.0\.0\.1|localhost):3300\/?$/.test(ZIEL))throw new Error('Eigener Paket-6-Server auf 3300 erforderlich');
const URL=process.env.SUPABASE_URL||process.env.EXPO_PUBLIC_SUPABASE_URL,KEY=process.env.SUPABASE_ANON_KEY||process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if(!URL||!KEY)throw new Error('Supabase-Konfiguration fehlt');
const konten=[{id:'3baafacd-bbdb-40fb-8ef4-a4e365ae00c4',email:'test@all-media.app',pass:TESTKONTO_PASS},{id:'62616c1d-82e2-4ee4-aab9-950e40e438a4',email:'all.media.prueflauf@web.de',pass:PRUEFKONTO_PASS}];
const lauf=crypto.randomUUID(),manifest={lauf,pid:process.pid,chatId:null,schluessel:[],start:new Date().toISOString()};
fs.mkdirSync(OUT,{recursive:true});
const manifestDatei=path.join(OUT,'native-live-fixtures.json');
if(fs.existsSync(manifestDatei)){const alt=JSON.parse(fs.readFileSync(manifestDatei));if(alt.rest!==0)throw new Error('Vorherige Fixture-Bereinigung nicht bestätigt; zuerst _paket6_reste.cjs ausführen');fs.copyFileSync(manifestDatei,path.join(OUT,'live-fixtures-'+alt.lauf+'.json'));}
const sichern=()=>fs.writeFileSync(path.join(OUT,'native-live-fixtures.json'),JSON.stringify(manifest,null,2));sichern();
let browser,chatId,ok=0,fehl=0;const seiten=[],kontakteVorher=new Set();
const log=t=>console.log(new Date().toISOString(),t);
const pruefe=(name,b)=>{if(b)ok++;else fehl++;log(`${b?'OK':'FEHL'} ${name}`);};
const ergebnis=async(q,was)=>{const r=await q;if(r.error)throw new Error(was+': '+r.error.message);return r.data;};
const merken=(seite,id)=>{if(!manifest.schluessel.some(k=>k.id===id)){manifest.schluessel.push({konto:seite.id,id});sichern();}};
function client(){return createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})}});}
async function browserAnmelden(seite){
 const ctx=await browser.newContext({viewport:{width:430,height:920},serviceWorkers:'block'});const page=await ctx.newPage();seiten.push({ctx,page,seite});
 await medienEgressSchuetzen(page);page.setDefaultTimeout(20000);
 await page.goto(ZIEL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.Anmeldung));
 const r=await page.evaluate(async({email,pass})=>Anmeldung.anmelden(email,pass),{email:seite.email,pass:seite.pass});
 if(!r?.ok)throw new Error('Browser-Testanmeldung fehlgeschlagen');
 await page.waitForFunction(id=>Anmeldung.nutzer()?.id===id,seite.id);
 const k=await page.evaluate(async()=>{const k=await KryptoWeb.anmelden();return k?{id:k.id,oeffentlich:k.oeffentlich,kontoId:k.kontoId}:null;});if(!k?.id)throw new Error('Browsergerät fehlt');merken(seite,k.id);
 seite.page=page;return page;
}
async function zeilen(){return ergebnis(konten[0].client.from('messages').select('id,chat_id,sender_id,text,krypto,chiffre,krypto_nonce,absender_schluessel').eq('chat_id',chatId),'Nachrichten gegenlesen');}
async function appLesen(seite,text){const z=await zeilen();await seite.runtime.K.aufschliessen(seite.client,z,seite.meiner,{absenderPruefen:true});return z.find(n=>n.text===text);}
async function webSenden(seite,text){
 return seite.page.evaluate(async({chatId,text})=>{
  const koerper=await sendeKoerper(chatId,text);const r=await fetch('/api/messages/'+chatId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(koerper)});return r.json();
 },{chatId,text});
}
(async()=>{
 log('LIVE: exklusiver Bestand bestätigt; keine Registrierung, kein Reset, kein Schema');
 for(const s of konten){
  s.client=client();const r=await s.client.auth.signInWithPassword({email:s.email,password:s.pass});if(r.error)throw new Error('Testanmeldung fehlgeschlagen: '+r.error.message);assert.equal(r.data.user.id,s.id);
  const k=await ergebnis(s.client.from('contacts').select('id').eq('user_id',s.id).in('contact_id',konten.map(x=>x.id)),'Kontakt-Grundstand');k.forEach(x=>kontakteVorher.add(x.id));
  s.runtime=appRuntime({},konten.map(x=>x.id));s.meiner=await s.runtime.K.meinSchluessel(s.client,s.id);if(!s.meiner)throw new Error('App-Testschlüssel nicht angelegt');merken(s,s.meiner.id);
 }
 const [a,b]=konten;
 const ch=await ergebnis(a.client.from('chats').insert({name:'Paket 6 '+lauf,is_group:false,bereich:'community',created_by:a.id}).select('id').single(),'Isolierten Chat anlegen');chatId=ch.id;manifest.chatId=chatId;sichern();
 for(const s of konten)await ergebnis(a.client.from('chat_members').insert({chat_id:chatId,user_id:s.id}).select('user_id'),'Chatmitglied anlegen');
 // Normale Annahme durch das Gegenüber, ohne privilegierte Datenbankhilfe.
 await a.runtime.aktionen().anfrageEntscheiden(b.client,chatId,true);
 const angenommen=await ergebnis(b.client.from('chats').select('id,anfrage_zustand').eq('id',chatId).single(),'Chatannahme gegenlesen');
 assert.equal(angenommen.anfrage_zustand,'angenommen','Anfrage ist nicht angenommen');
 browser=await chromium.launch();await browserAnmelden(a);await browserAnmelden(b);

 const http=require('node:http');let gestartet=false,ende;const fertig=new Promise(r=>ende=r),nummern=[];
 const natives=new Map();
 // Keine Passwörter im Bundle: flüchtige Test-Sitzungen nur über Loopback.
 // Der Server ist ausschließlich während exklusiver Abnahme erreichbar.
 const bridge=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  try{
   let roh='';for await(const x of req){roh+=x;if(roh.length>20000)throw Error('Zu groß');}const d=roh?JSON.parse(roh):{};
   const send=x=>res.end(JSON.stringify(x));
   if(req.url==='/start'){
    if(gestartet)throw Error('Prüfstart bereits benutzt');gestartet=true;
    return send({lauf,url:URL,anon:KEY,chat:{id:chatId,isGroup:false,requestState:'accepted',bereich:'community',initials:'P6',color:'#767',preview:'',time:''},
     konten:await Promise.all(konten.map(async(s,i)=>({id:s.id,name:i?'B':'A',sitzung:{access_token:(await s.client.auth.getSession()).data.session.access_token,refresh_token:(await s.client.auth.getSession()).data.session.refresh_token}})))});
   }
   if(req.url==='/key'){
    const s=konten.find(s=>s.id===d.konto);assert.ok(s);const k=await ergebnis(s.client.from('krypto_schluessel').select('id,oeffentlich').eq('id',d.id).single(),'Natives Gerät gegenlesen');assert.equal(k.oeffentlich,d.oeffentlich);merken(s,k.id);natives.set(s.id,k);return send({ok:true});
   }
   if(req.url==='/bereit'){
    assert.equal(natives.size,2);pruefe('Zwei native SecureStore-Geräte registriert',true);
    pruefe('Native Geräte je Konto verschieden',natives.get(a.id).oeffentlich!==natives.get(b.id).oeffentlich);
    for(let i=0;i<2;i++){const r=await webSenden(konten[1-i],'Website an Native '+(i?'B':'A'));assert.ok(r.id);}
    return send({ok:true});
   }
   if(req.url==='/nummer'){
    const k=await ergebnis(a.client.from('krypto_schluessel').select('oeffentlich').eq('user_id',d.konto),'Alle echten Geräteschlüssel');const n=Krypto.sicherheitsnummer(k.map(x=>x.oeffentlich));pruefe('Native Sicherheitsnummer gegen alle Live-Geräte',n.nummer===d.nummer&&n.geraete===d.geraete);nummern.push(d);return send({ok:true});
   }
   if(req.url==='/extra'){
    const s=konten[1-d.index],p=Krypto.schluesselpaarErzeugen();const ex=await ergebnis(s.client.from('krypto_schluessel').insert({user_id:s.id,geraet:'native-extra-'+lauf,art:'app',oeffentlich:p.oeffentlich}).select('id').single(),'Reales Zusatzgerät');merken(s,ex.id);return send({ok:true});
   }
   if(req.url==='/falsch'){
    const sender=konten[1-d.index],fake=Krypto.schluesselpaarErzeugen(),emp=await sender.runtime.K.empfaengerSchluessel(sender.client,chatId);
    const pk=Krypto.verschluesseln('Unregistrierter Live-Absender',fake.geheim,emp);
    const n=await ergebnis(sender.client.from('messages').insert({chat_id:chatId,sender_id:sender.id,text:'',krypto:1,chiffre:pk.chiffre,krypto_nonce:pk.nonce,absender_schluessel:pk.absender}).select('id').single(),'Fremden Absender prüfen');
    await ergebnis(sender.client.from('message_keys').insert(pk.kuverts.map(k=>({message_id:n.id,schluessel_id:k.schluesselId,nonce:k.nonce,chiffre:k.chiffre}))),'Kuverts');return send({ok:true});
   }
   if(req.url==='/pruefen'||req.url==='/fertig'){
    const z=await zeilen();let gelesen=0;
    for(let i=0;i<2;i++){const ns=await konten[1-i].page.evaluate(id=>nachrichtenHolen(id),chatId);const trifft=ns.some(n=>n.text==='Native an Website '+(i?'B':'A'));if(trifft)gelesen++;}
    if(req.url==='/pruefen')return send({text:`Live: ${gelesen}/2 native Nachrichten im Browser lesbar; ${z.length} Zeilen, ${z.filter(n=>n.krypto===1&&n.text==='').length} Chiffren`});
    pruefe('Beide nativen Nachrichten in echter Website lesbar',gelesen===2);
    pruefe('Alle Live-Zeilen ohne Klartext',z.length>=4&&z.every(n=>n.krypto===1&&n.text===''));
    pruefe('Zusätzliches echtes Gerät ändert native Sicherheitsnummer',nummern.length>=2&&nummern[0].nummer!==nummern[1].nummer&&nummern[1].geraete===nummern[0].geraete+1);
    send({text:'Live abgeschlossen; Bereinigung läuft'});ende();return;
   }
   res.statusCode=404;send({error:'Unbekannt'});
  }catch(e){log('NATIVE STEUERUNG FEHLER '+e.message);res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
 });
 await new Promise((res,rej)=>{bridge.once('error',rej);bridge.listen(3302,'127.0.0.1',res);});
 log('Native Live-Fixtures bereit; Bridge 3302, nur eigenes Gerät starten');
 let zeit;try{await Promise.race([fertig,new Promise((_,rej)=>zeit=setTimeout(()=>rej(Error('Native Abnahme nach 45 Minuten unvollständig')),45*60000))]);}finally{clearTimeout(zeit);await new Promise(r=>bridge.close(r));}
 manifest.pruefungen={ok,fehl};sichern();
})().catch(e=>{fehl++;log('FEHLER '+e.message);process.exitCode=1;}).finally(async()=>{
 // Browser zuerst schließen: kein Polling mehr während der Bereinigung.
 if(browser)await browser.close().catch(()=>{});
 let rest=0;
 if(chatId&&konten[0].client){
  try{
   const a=konten[0];
   for(const s of konten)await ergebnis(s.client.from('messages').delete().eq('chat_id',chatId).eq('sender_id',s.id).select('id'),'Eigene Nachrichten löschen');
   // RLS erlaubt Chatlöschung erst nach Austritt des Gegenübers.
   await ergebnis(konten[1].client.from('chat_members').delete().eq('chat_id',chatId).eq('user_id',konten[1].id).select('user_id'),'Prüfmitglied austreten');
   await ergebnis(a.client.from('chats').delete().eq('id',chatId).select('id'),'Eigenen Chat löschen');
   for(const s of konten){
    const n=await ergebnis(s.client.from('messages').select('id').eq('chat_id',chatId),'Restnachrichten gegenlesen');rest+=n.length;
    const c=await ergebnis(s.client.from('chats').select('id').eq('id',chatId),'Restchat gegenlesen');rest+=c.length;
   }
  }catch(e){fehl++;rest++;log('BEREINIGUNG Chat: '+e.message);}
 }
 for(const s of konten.filter(s=>s.client)){
  try{
   const ids=manifest.schluessel.filter(k=>k.konto===s.id).map(k=>k.id);
   if(ids.length){await ergebnis(s.client.from('krypto_schluessel').delete().in('id',ids).select('id'),'Eigene Prüfgeräte löschen');rest+=(await ergebnis(s.client.from('krypto_schluessel').select('id').in('id',ids),'Prüfgeräte gegenlesen')).length;}
   const neu=(await ergebnis(s.client.from('contacts').select('id').eq('user_id',s.id).in('contact_id',konten.map(k=>k.id)),'Kontaktzustand nachlesen')).filter(k=>!kontakteVorher.has(k.id));
   if(neu.length){await ergebnis(s.client.from('contacts').delete().in('id',neu.map(k=>k.id)).select('id'),'Neu entstandene Testkontakte entfernen');rest+=(await ergebnis(s.client.from('contacts').select('id').in('id',neu.map(k=>k.id)),'Kontaktbereinigung gegenlesen')).length;}
  }catch(e){fehl++;rest++;log('BEREINIGUNG Geräte/Kontakte: '+e.message);}
 }
 pruefe('Geprüfte Bereinigung: keine eigenen Chat-/Nachrichten-/Geräte-/Kontaktreste',rest===0);
 manifest.ende=new Date().toISOString();manifest.rest=rest;manifest.pruefungen={ok,fehl};sichern();
 log(`${ok}/${ok+fehl} Live-Prüfungen; Rest ${rest}. Native Komponenten mit echtem SecureStore, echter Supabase und echter Website; Rahmenkontexte ersetzt.`);
 if(fehl)process.exitCode=1;
 for(const s of konten.filter(s=>s.client))await s.client.auth.signOut({scope:'local'}).catch(()=>{});
});
