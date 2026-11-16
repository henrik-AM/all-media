/** Paket 7: Originalwebsite + native Original-Chatkomponenten, echte Testkonten.
 * Nur eigener Server3300 und exklusiver Testbestand. Keine Schemas/Resets.
 */
require('./_ki_belegung').pruefeBelegung('testbestand');
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),http=require('http');
const {createClient}=require('@supabase/supabase-js'),{chromium}=require('playwright-core');
const {TESTKONTO_PASS,PRUEFKONTO_PASS}=require('./_testpasswoerter');
const {frage}=require('./_aufraeumen'),{medienEgressSchuetzen}=require('./_medien_egressschutz');
process.loadEnvFile(path.join(__dirname,'../.env.local'));
const URL=process.env.EXPO_PUBLIC_SUPABASE_URL,KEY=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,OUT=process.env.P7_PLATTFORM_OUT||path.resolve(__dirname,'../../pruefbelege/paket-7');
const lauf=crypto.randomUUID(),chats=[{id:crypto.randomUUID(),isGroup:false,bereich:'community'},{id:crypto.randomUUID(),isGroup:true,bereich:'community'}];
const konten=[{id:'3baafacd-bbdb-40fb-8ef4-a4e365ae00c4',email:'test@all-media.app',pass:TESTKONTO_PASS,name:'A'},{id:'62616c1d-82e2-4ee4-aab9-950e40e438a4',email:'all.media.prueflauf@web.de',pass:PRUEFKONTO_PASS,name:'B'}];
let browser,bridge,ende,fehler=0,gut=0,begonnen=false;const keys=[],messungen=[],nativeTexte=[];let spaet;
const manifest={lauf,chats:chats.map(c=>c.id),keys,rest:null};
const sichern=()=>fs.writeFileSync(path.join(OUT,'plattform-fixtures.json'),JSON.stringify(manifest,null,2));
const log=t=>console.log(new Date().toISOString(),t);
const check=(t,b,extra='')=>{b?gut++:fehler++;log(`${b?'OK':'FEHL'} ${t} ${extra}`);};
async function daten(q){const r=await q;if(r.error)throw Error(r.error.message);return r.data;}
async function offen(i,g){const p=konten[i].page;await p.evaluate(async id=>{const r=await(await fetch('/api/chats')).json();state.chats=r.chats;state.communityChats=r.communityChats;const c=[...r.chats,...r.communityChats].find(c=>c.id===id);if(!c)throw Error('Fixturechat fehlt');await openChat(c.id);},chats[g?1:0].id);await p.waitForSelector('#messages');}
async function websend(i,g,text){await offen(i,g);const ab=Date.now();const r=await konten[i].page.evaluate(async({id,text})=>{const body=await sendeKoerper(id,text);return(await fetch('/api/messages/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();},{id:chats[g?1:0].id,text});assert.ok(r.id,'Web-Senden fehlgeschlagen');return Date.parse(r.zeitpunkt)||ab;}
async function gesehen(i,text,ab=Date.now()){
 const p=konten[i].page;await p.waitForFunction(t=>document.querySelector('#messages')?.textContent.includes(t),text,{timeout:6000});const zeit=await p.evaluate(t=>window.__p7Eintritte.find(z=>z.text.includes(t))?.at||Date.now(),text);
 const ms=zeit-ab;check('Website liest '+text,ms>=0&&ms<2500,ms+' ms seit DB-Schreiben');return ms;
}
(async()=>{
 assert.ok(process.env.SUPABASE_TOKEN,'Managementtoken fehlt');fs.mkdirSync(OUT,{recursive:true});sichern();
 for(const s of konten){s.client=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(15000)})}});const r=await s.client.auth.signInWithPassword({email:s.email,password:s.pass});if(r.error)throw r.error;assert.equal(r.data.user.id,s.id);s.session=r.data.session;s.vorher=(await daten(s.client.from('krypto_schluessel').select('id').eq('user_id',s.id))).map(z=>z.id);}
 const [a,b]=konten;
 await frage(`begin;insert into chats(id,name,is_group,bereich,created_by,anfrage_zustand) values ${chats.map(c=>`('${c.id}','P7 Plattform ${lauf}',${c.isGroup},'community','${a.id}','angenommen')`).join(',')};insert into chat_members(chat_id,user_id) values ${chats.flatMap(c=>konten.map(s=>`('${c.id}','${s.id}')`)).join(',')};commit;select 1 ok`);
 browser=await chromium.launch();
 for(const s of konten){const ctx=await browser.newContext({viewport:{width:430,height:920},serviceWorkers:'block'});const p=await ctx.newPage();s.page=p;s.ctx=ctx;s.req=[];s.responses=[];await medienEgressSchuetzen(p);p.setDefaultTimeout(20000);p.on('response',async r=>{if(/\/api\/(chatstand|chats|messages)/.test(r.url()))s.responses.push({url:new globalThis.URL(r.url()).pathname,status:r.status(),at:Date.now(),timing:r.request().timing()});});p.on('request',r=>{if(/\/api\/(chatstand|messages\/[^/]+\/stand)/.test(r.url()))s.req.push({at:Date.now(),url:new globalThis.URL(r.url()).pathname});});
  await p.goto('http://127.0.0.1:3300',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.Anmeldung);const r=await p.evaluate(async({email,pass})=>Anmeldung.anmelden(email,pass),{email:s.email,pass:s.pass});assert.ok(r.ok,'Testanmeldung Browser');await p.waitForFunction(id=>Anmeldung.nutzer()?.id===id,s.id);
  p.on('console',m=>{if(m.text().startsWith('P7-'))log(s.name+' '+m.text());});
  await p.evaluate(()=>{const c=Anmeldung.client(),channel=c.channel.bind(c);c.channel=(...args)=>{const k=channel(...args),subscribe=k.subscribe.bind(k);k.subscribe=(fn)=>subscribe((status,error)=>{console.log('P7-STATUS',k.topic,status,error?.message||'');fn?.(status,error);});return k;};});
  await p.evaluate(()=>{
   window.__p7Eintritte=[];
   new MutationObserver(()=>{for(const el of document.querySelectorAll('#messages [data-msgid]')){const id=el.dataset.msgid,text=el.textContent;if(!window.__p7Eintritte.some(z=>z.id===id&&z.text===text))window.__p7Eintritte.push({id,text,at:Date.now()});}}).observe(document.body,{childList:true,subtree:true,characterData:true});
   return bootstrap();
  });
  await p.waitForFunction(()=>Anmeldung.client().getChannels().some(k=>k.topic.includes('nutzer:')&&k.state==='joined'),null,{timeout:12000});
  const k=await p.evaluate(async()=>{const k=await KryptoWeb.anmelden();return {id:k?.id};});assert.ok(k.id);if(!keys.includes(k.id))keys.push(k.id);sichern();
 }
 for(const g of [false,true]){for(let i=0;i<2;i++)await offen(i,g);await new Promise(r=>setTimeout(r,1500));for(const s of konten)log('KANALE '+s.name+' '+JSON.stringify(await s.page.evaluate(()=>Anmeldung.client().getChannels().map(k=>({topic:k.topic,state:k.state,joined:k.joinedOnce})))));
  for(let i=0;i<2;i++){const text=`Web ${i?'B an A':'A an B'} ${g?'Gruppe':'Chiffre'}`,ab=await websend(i,g,text);await gesehen(1-i,text,ab);}
  await konten[1].page.screenshot({path:path.join(OUT,g?'web-gruppe.png':'web-chiffre.png')});
 }
 // Listenklingel bei geschlossenem Chat: kein manueller Reload im Empfänger.
 await konten[1].page.evaluate(()=>{state.openChatId=null;chatNachsehenStoppen();});
 const listenAb=await websend(0,true,'P7 Listenklingel');await konten[1].page.waitForFunction(id=>JSON.stringify(state.communityChats.find(c=>c.id===id)).includes('P7 Listenklingel'),chats[1].id,{timeout:6000});check('Echte Website-Chatliste sofort aktuell',Date.now()-listenAb<2500,(Date.now()-listenAb)+' ms');
 for(let i=0;i<2;i++)await offen(i,false);
 await new Promise(r=>setTimeout(r,1200));const start=Date.now();
 log('Egress-Ruhemessung 65 s begonnen');await new Promise(r=>setTimeout(r,65000));
 for(const s of konten){const requests=s.req.filter(r=>r.at>=start);const chat=requests.filter(r=>r.url.includes('/messages/')).length,liste=requests.filter(r=>r.url==='/api/chatstand').length;check('Website '+s.name+' gedrosselt 65 s',chat<=3&&liste<=2,`${chat} Chatstand + ${liste} Listenstand statt etwa16+6`);messungen.push({konto:s.name,sekunden:65,chat,liste});}
 await offen(0,false);await offen(1,false);
 bridge=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');try{let raw='';for await(const x of req){raw+=x;if(raw.length>20000)throw Error('Zu groß');}const d=raw?JSON.parse(raw):{};const route=req.url;let result={ok:true};
  if(route==='/start'){if(begonnen)throw Error('Native Start bereits benutzt');begonnen=true;result={lauf,url:URL,anon:KEY,chats,konten:konten.map(s=>({id:s.id,name:s.name,sitzung:{access_token:s.session.access_token,refresh_token:s.session.refresh_token}}))};}
  else if(route==='/key'){assert.ok(konten.some(s=>s.id===d.konto));const k=await daten(konten[0].client.from('krypto_schluessel').select('id').eq('id',d.id).single());assert.ok(k.id);if(!keys.includes(k.id))keys.push(k.id);sichern();}
  else if(route==='/bereit'){log('NATIVE BEREIT');}
  else if(route==='/mode'){for(let i=0;i<2;i++)await offen(i,!!d.gruppe);}
  else if(route==='/websend'){const ab=await websend(d.index,!!d.gruppe,d.text);result={ok:true,ab};}
  else if(route==='/spaet'){
   await offen(1,false);
   const paket=await konten[1].page.evaluate(()=>sendeKoerper(state.openChatId,'Kuvert nach Klingel angekommen'));
   assert.equal(paket.krypto,2);
   const z=await daten(konten[1].client.from('messages').insert({id:paket.nachrichtId,krypto_gesendet_am:paket.gesendetAm,chat_id:chats[0].id,sender_id:konten[1].id,text:'',krypto:2,chiffre:paket.chiffre,krypto_nonce:paket.kryptoNonce,absender_schluessel:paket.absenderSchluessel}).select('id').single());
   spaet={id:z.id,kuverts:paket.kuverts};result={ok:true,id:z.id};
  }
  else if(route==='/nachreichen'){
   assert.ok(spaet);const ab=Date.now();await daten(konten[1].client.from('message_keys').insert(spaet.kuverts.map(k=>({message_id:spaet.id,schluessel_id:k.schluesselId,nonce:k.nonce,chiffre:k.chiffre}))));result={ok:true,ab};
  }
  else if(route==='/seen'){const zeilen=await daten(konten[0].client.from('messages').select('id,created_at').eq('chat_id',chats[d.gruppe?1:0].id).order('created_at',{ascending:false}).limit(1));assert.equal(zeilen.length,1);const ms=await gesehen(d.index,d.text,Date.parse(zeilen[0].created_at));nativeTexte.push(d.text);result={ok:ms<2500,ms};}
  else if(route==='/zahl'){const r=await daten(a.client.from('messages').select('id').in('chat_id',chats.map(c=>c.id)));result={anzahl:r.length};}
  else if(route==='/kopie'){await offen(1,false);const p=await konten[1].page.evaluate(()=>sendeKoerper(state.openChatId,'Kontextkopie darf nicht lesbar sein'));assert.equal(p.krypto,2);const id=crypto.randomUUID();await daten(konten[1].client.from('messages').insert({id,chat_id:chats[0].id,sender_id:konten[1].id,text:'',krypto:2,krypto_gesendet_am:p.gesendetAm,chiffre:p.chiffre,krypto_nonce:p.kryptoNonce,absender_schluessel:p.absenderSchluessel}));await daten(konten[1].client.from('message_keys').insert(p.kuverts.map(k=>({message_id:id,schluessel_id:k.schluesselId,nonce:k.nonce,chiffre:k.chiffre}))));result={ok:true,id};}
  else if(route==='/fertig'){const rows=await daten(a.client.from('messages').select('chat_id,text,krypto,krypto_gesendet_am').in('chat_id',chats.map(c=>c.id)));check('Echte Zweierchat-Zeilen ausschließlich Chiffren',rows.filter(z=>z.chat_id===chats[0].id).every(z=>z.krypto===2&&z.text===''&&Boolean(z.krypto_gesendet_am)));check('Gruppenchat bleibt lesbarer Klartext',rows.some(z=>z.chat_id===chats[1].id&&z.krypto===0&&z.text));fs.writeFileSync(path.join(OUT,'plattform-messungen.json'),JSON.stringify({messungen,gut,fehler,nativeTexte},null,2));res.end(JSON.stringify({ok:fehler===0}));ende();return;}
  else throw Error('Unbekannte Steuerung');res.end(JSON.stringify(result));
 }catch(e){fehler++;log('BRIDGE FEHLER '+e.message);res.statusCode=500;res.end(JSON.stringify({fehler:e.message}));}});
 await new Promise((r,j)=>{bridge.once('error',j);bridge.listen(3302,'127.0.0.1',r);});log('BRIDGE BEREIT 3302; Native starten');
 let timer;try{await Promise.race([new Promise(r=>ende=r),new Promise((_,j)=>timer=setTimeout(()=>j(Error('Native Abnahme 30 Minuten unvollständig')),1800000))]);}finally{clearTimeout(timer);}
})().catch(e=>{fehler++;log('FEHLER '+e.message);process.exitCode=1;}).finally(async()=>{
 try{if(browser){for(const s of konten)if(s.page){log('DEBUG KANALE '+s.name+' '+JSON.stringify(await s.page.evaluate(()=>Anmeldung.client()?.getChannels().map(k=>({topic:k.topic,state:k.state}))).catch(()=>[])));}fs.writeFileSync(path.join(OUT,'plattform-netz.json'),JSON.stringify(konten.map(s=>({konto:s.name,requests:s.req,responses:s.responses})),null,2));await browser.close();}if(bridge)await new Promise(r=>bridge.close(r));
  // Eigene bekannte Fixture-IDs; Schlüssel-Grundstand wurde vor jedem Browserstart gesichert.

  const ids=chats.map(c=>"'"+c.id+"'").join(','),ks=keys.map(k=>"'"+k+"'").join(',');const r=await frage(`begin;delete from messages where chat_id in (${ids});delete from chat_members where chat_id in (${ids});delete from chats where id in (${ids}) and name='P7 Plattform ${lauf}';${ks?`delete from krypto_schluessel where id in (${ks});`:''}commit;select (select count(*) from chats where id in (${ids}))+(select count(*) from messages where chat_id in (${ids}))${ks?`+(select count(*) from krypto_schluessel where id in (${ks}))`:''} rest`);manifest.rest=r[0].rest;sichern();check('Plattformfixtures und Geräte entfernt',Number(r[0].rest)===0);
 }catch(e){fehler++;log('BEREINIGUNG FEHLER '+e.message);}
 for(const s of konten)if(s.client){await s.client.removeAllChannels();s.client.auth.stopAutoRefresh();}
 log(`${gut}/${gut+fehler} Plattformprüfungen bestanden`);process.exit(fehler?1:0);
});
