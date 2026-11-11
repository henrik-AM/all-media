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
const manifestDatei=path.join(OUT,'live-fixtures.json');
if(fs.existsSync(manifestDatei)){const alt=JSON.parse(fs.readFileSync(manifestDatei));if(alt.rest!==0)throw new Error('Vorherige Fixture-Bereinigung nicht bestätigt; zuerst _paket6_reste.cjs ausführen');fs.copyFileSync(manifestDatei,path.join(OUT,'live-fixtures-'+alt.lauf+'.json'));}
const sichern=()=>fs.writeFileSync(path.join(OUT,'live-fixtures.json'),JSON.stringify(manifest,null,2));sichern();
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
 pruefe('Zwei App- und zwei echte Browsergeräte registriert',manifest.schluessel.length===4);
 for(const [sender,empfaenger] of [[a,b],[b,a]]){
  const text='Paket6 App '+sender.id.slice(0,4)+' '+lauf;
  await sender.runtime.aktionen().nachrichtSenden(sender.client,sender.id,chatId,text);
  const web=await empfaenger.page.evaluate(id=>nachrichtenHolen(id),chatId);
  pruefe('App → Website '+sender.email,web.some(n=>n.text===text&&!n.nichtPruefbar));
  const wtext='Paket6 Web '+sender.id.slice(0,4)+' '+lauf;const gesendet=await webSenden(sender,wtext);pruefe('Website-Sendeantwort '+sender.email,!!gesendet.id);
  const n=await appLesen(empfaenger,wtext);pruefe('Website → App-Logik '+sender.email,!!n&&!n.nichtPruefbar);
 }
 const gespeichert=await zeilen();pruefe('Alle vier Rundreise-Nachrichten nur als Chiffre gespeichert',gespeichert.length===4&&gespeichert.every(n=>n.krypto===1&&n.text===''&&n.chiffre));
 for(const s of konten){
  const kuverts=await ergebnis(s.client.from('message_keys').select('message_id,schluessel_id').in('message_id',gespeichert.map(n=>n.id)),'Kuverts lesen');
  const eigene=manifest.schluessel.filter(k=>k.konto===s.id).map(k=>k.id);
  pruefe('Jedes eigene Gerät erhält vier Kuverts '+s.email,eigene.every(id=>kuverts.filter(k=>k.schluessel_id===id).length===4));
 }
 const alt=await a.page.evaluate(async id=>{const r=await fetch('/api/messages/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Kein Klartext-Rückfall'})});return r.json();},chatId);
 pruefe('Alter Website-Aufrufer mit Klartext ausdrücklich abgewiesen',alt.ok===false&&/nicht verschlüsseln/.test(alt.error));
 pruefe('Klartext-Abweisung schreibt keine zusätzliche Zeile',(await zeilen()).length===4);
 await a.page.route('**/api/krypto/empfaenger/*',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
 const fehler=await a.page.evaluate(async id=>{try{await sendeKoerper(id,'nicht offen');return false;}catch(e){return /nicht verschlüsseln/.test(e.message);}},chatId);
 pruefe('Simulierter Faktenausfall im echten Websiteweg fällt nicht auf Klartext',fehler);await a.page.unroute('**/api/krypto/empfaenger/*');
 const fakten=await a.runtime.K.kontoSchluessel(a.client,b.id);const nr=a.runtime.K.sicherheitsnummer(fakten.map(k=>k.oeffentlich));
 const webNr=await a.page.evaluate(({id,b})=>kryptoZustand(b,{id,isGroup:false}),{id:chatId,b:b.id});
 pruefe('Sicherheitsnummer App/Website umfasst dieselben Geräte',webNr.fingerabdruck===nr.nummer&&webNr.geraete===nr.geraete);
 const extra=Krypto.schluesselpaarErzeugen();const ex=await ergebnis(b.client.from('krypto_schluessel').insert({user_id:b.id,geraet:'paket6-'+lauf,art:'app',oeffentlich:extra.oeffentlich}).select('id').single(),'Zusätzliches Gerät');merken(b,ex.id);
 const nr2=await a.page.evaluate(({id,b})=>kryptoZustand(b,{id,isGroup:false}),{id:chatId,b:b.id});pruefe('Zusätzliches reales Gerät ändert die Sicherheitsnummer',nr2.geraete===nr.geraete+1&&nr2.fingerabdruck!==nr.nummer);
 await ergebnis(b.client.from('krypto_schluessel').delete().eq('id',ex.id).select('id'),'Zusätzliches Gerät entfernen');
 const nr3=await a.page.evaluate(({id,b})=>kryptoZustand(b,{id,isGroup:false}),{id:chatId,b:b.id});pruefe('Entferntes Gerät stellt die ursprüngliche Nummer wieder her',nr3.fingerabdruck===nr.nummer);
 const altKey=await a.page.evaluate(()=>({id:KryptoWeb.meinSchluessel().id,oeffentlich:KryptoWeb.meinSchluessel().oeffentlich}));
 const wechsel=await a.page.evaluate(async({email,pass})=>Anmeldung.anmelden(email,pass),{email:b.email,pass:b.pass});assert.ok(wechsel.ok);
 const bkey=await a.page.evaluate(async()=>{const k=await KryptoWeb.anmelden();return {id:k.id,oeffentlich:k.oeffentlich,kontoId:k.kontoId};});merken(b,bkey.id);pruefe('Kontowechsel hat eigenes Gerätepaar',bkey.kontoId===b.id&&bkey.oeffentlich!==altKey.oeffentlich);
 const zurueck=await a.page.evaluate(async id=>Anmeldung.wechseln(id),a.id);if(zurueck?.ok===false)throw new Error('Zurückwechseln gescheitert');
 const akey=await a.page.evaluate(async()=>{const k=await KryptoWeb.anmelden();return {id:k.id,oeffentlich:k.oeffentlich,kontoId:k.kontoId};});pruefe('Zurückwechseln verwendet wieder genau das erste Gerät',akey.id===altKey.id&&akey.oeffentlich===altKey.oeffentlich);

 for(const s of konten){
  const vorher=await s.page.evaluate(()=>({id:KryptoWeb.meinSchluessel().id,oeffentlich:KryptoWeb.meinSchluessel().oeffentlich}));
  await s.page.reload({waitUntil:'domcontentloaded'});await s.page.waitForFunction(()=>Boolean(window.Anmeldung));
  const nachher=await s.page.evaluate(async()=>{await Anmeldung.bereit;const k=await KryptoWeb.anmelden();return {id:k?.id,oeffentlich:k?.oeffentlich};});if(nachher.id)merken(s,nachher.id);
  pruefe('Browser-Neustart behält das eigene Konto-Gerätepaar '+s.email,nachher.id===vorher.id&&nachher.oeffentlich===vorher.oeffentlich);
  const gelesen=await s.page.evaluate(id=>nachrichtenHolen(id),chatId);
  pruefe('Browser-Neustart liest frühere Rundreise-Chiffren '+s.email,gelesen.filter(n=>n.text?.startsWith('Paket6 ')).length===4);
 }
 const fake=Krypto.schluesselpaarErzeugen();const emp=await a.runtime.K.empfaengerSchluessel(a.client,chatId);const pk=Krypto.verschluesseln('Paket6 unregistrierter Absender '+lauf,fake.geheim,emp);
 const f=await a.client.from('messages').insert({chat_id:chatId,sender_id:a.id,text:'',krypto:1,chiffre:pk.chiffre,krypto_nonce:pk.nonce,absender_schluessel:pk.absender}).select('id').single();
 if(f.error){pruefe('Unregistrierter Absenderschlüssel serverseitig abgewiesen',true);}
 else{
  await ergebnis(a.client.from('message_keys').insert(pk.kuverts.map(k=>({message_id:f.data.id,schluessel_id:k.schluesselId,nonce:k.nonce,chiffre:k.chiffre}))),'Fälschungs-Kuverts');
  const appN=await appLesen(b,'Paket6 unregistrierter Absender '+lauf);pruefe('App-Logik warnt vor unregistriertem Absenderschlüssel',appN?.nichtPruefbar===true);
  const webN=await b.page.evaluate(id=>nachrichtenHolen(id),chatId);pruefe('Website warnt vor unregistriertem Absenderschlüssel',webN.find(n=>n.id===f.data.id)?.nichtPruefbar===true);
  const reg=await ergebnis(a.client.from('krypto_schluessel').insert({user_id:a.id,geraet:'cache-'+lauf,art:'app',oeffentlich:fake.oeffentlich}).select('id').single(),'Absenderschlüssel testweise registrieren');merken(a,reg.id);
  log('Cache-Probe: reale Neuregistrierung; reguläre 60-Sekunden-Frist abwarten');await new Promise(r=>setTimeout(r,61000));
  const gutApp=await appLesen(b,'Paket6 unregistrierter Absender '+lauf);const gutWeb=await b.page.evaluate(id=>nachrichtenHolen(id),chatId);
  pruefe('App-Logik bestätigt nach Cacheablauf neu registrierten Absender',gutApp?.nichtPruefbar===false);
  pruefe('Website entfernt Warnung nach regulärem Cacheablauf',gutWeb.find(n=>n.id===f.data.id)?.nichtPruefbar===false);
  await ergebnis(a.client.from('krypto_schluessel').delete().eq('id',reg.id).select('id'),'Registrierung zurücknehmen');
  log('Cache-Probe: reale Entfernung; reguläre 60-Sekunden-Frist abwarten');await new Promise(r=>setTimeout(r,61000));
  const wegApp=await appLesen(b,'Paket6 unregistrierter Absender '+lauf);const wegWeb=await b.page.evaluate(id=>nachrichtenHolen(id),chatId);
  pruefe('App-Logik entzieht entferntem Absender nach Cacheablauf das Vertrauen',wegApp?.nichtPruefbar===true);
  pruefe('Website warnt nach tatsächlicher Geräteentfernung erneut',wegWeb.find(n=>n.id===f.data.id)?.nichtPruefbar===true);

 }
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
 log(`${ok}/${ok+fehl} Live-Prüfungen; Rest ${rest}. App-Logik mit simuliertem Schlüsselbund; Browser mit echter Anmeldung und Supabase.`);
 if(fehl)process.exitCode=1;
 for(const s of konten.filter(s=>s.client))await s.client.auth.signOut({scope:'local'}).catch(()=>{});
});
