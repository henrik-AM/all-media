// Echte Testkonten, echte Website/RLS. Start nur ohne bestehende Paarbeziehung.
// Bei Unterbrechung: node diese-datei.cjs --cleanup (mit eigener Belegung).
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'app');
require(path.join(app,'test/_ki_belegung')).pruefeBelegung('testbestand');
process.loadEnvFile(path.join(app,'.env.local'));
process.env.SUPABASE_TOKEN=fs.readFileSync('/Users/henrik.dikta/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/2.Gehirn.md/04 Ressourcen/Zugangsdaten/Supabase.md','utf8').match(/sbp_[A-Za-z0-9_-]{20,}/)[0];
const {frage}=require(path.join(app,'test/_aufraeumen')),{createClient}=require(path.join(app,'node_modules/@supabase/supabase-js')),{chromium}=require(path.join(app,'node_modules/playwright-core'));
const {medienEgressSchuetzen}=require(path.join(app,'test/_medien_egressschutz')),{TESTKONTO_PASS,PRUEFKONTO_PASS}=require(path.join(app,'test/_testpasswoerter'));
const K=require(path.join(root,'gemeinsam/krypto')),Telefon=require(path.join(root,'gemeinsam/telefon'));
K.zufallsquelleSetzen((a,n)=>a.set(crypto.randomBytes(n)));
const A='3baafacd-bbdb-40fb-8ef4-a4e365ae00c4',B='62616c1d-82e2-4ee4-aab9-950e40e438a4';
const paar=`(user_id='${A}' and contact_id='${B}') or (user_id='${B}' and contact_id='${A}')`,beteiligt=`(actor_id in('${A}','${B}') or user_id in('${A}','${B}'))`;
const chatSql=`select c.id from chats c join chat_members a on a.chat_id=c.id and a.user_id='${A}' join chat_members b on b.chat_id=c.id and b.user_id='${B}' where not c.is_group`;
const datei=path.join(__dirname,'kontakt-live-fixtures.json'),beleg=path.join(__dirname,'kontakt-live-ergebnis.json');
let m={lauf:crypto.randomUUID(),pid:process.pid,basisLeer:false,vorherKeys:[],vorherMitteilungen:[],rest:null},browser,clients=[],gut=0,fehler;
function sichern(){fs.writeFileSync(datei,JSON.stringify(m,null,2));}
const zahlen=xs=>xs.length?xs.map(x=>{const n=Number(x);if(!Number.isSafeInteger(n)||n<1)throw Error('Ungültige Taktkennung');return n;}).join(','):'0';
const ids=xs=>xs.length?xs.map(x=>{if(!/^[0-9a-f-]{36}$/.test(x))throw Error('Ungültige Fixturekennung');return "'"+x+"'";}).join(','):"'00000000-0000-0000-0000-000000000000'";
async function daten(q){const r=await q;if(r.error)throw Error(r.error.message);return r.data;}
function check(name,b){if(!b)throw Error(name);gut++;console.log('OK',name);}
let bereinigt=false;
async function cleanup(){if(bereinigt)return;bereinigt=true;if(browser)await browser.close().catch(()=>{});if(!m.basisLeer)return;
 if(!Array.isArray(m.vorherTreffer)||!Array.isArray(m.vorherTakt))throw Error('Historischer Beleg ohne Nummern-Baseline: gezielte Altbereinigung erforderlich');
 const baseline=JSON.stringify(m.vorherTreffer).replaceAll("'","''"),nummerPaar=`nutzer='${A}' and ziel='${B}'`;
 const differenz=`select count(*) from ((select nutzer,ziel,zeit from nummer_treffer where ${nummerPaar} except select nutzer,ziel,zeit from jsonb_populate_recordset(null::nummer_treffer,'${baseline}'::jsonb)) union all (select nutzer,ziel,zeit from jsonb_populate_recordset(null::nummer_treffer,'${baseline}'::jsonb) except select nutzer,ziel,zeit from nummer_treffer where ${nummerPaar})) d`;

 const chats=(await frage(chatSql)).map(x=>x.id);const neuKeys=(await frage(`select id from krypto_schluessel where user_id in('${A}','${B}') and id not in(${ids(m.vorherKeys)})`)).map(x=>x.id);
 m.chats=chats;m.schluessel=neuKeys;sichern();
 await frage(`begin;delete from nummer_treffer where ${nummerPaar};insert into nummer_treffer select * from jsonb_populate_recordset(null::nummer_treffer,'${baseline}'::jsonb);delete from nummer_suche_takt where nutzer='${A}' and id not in(${zahlen(m.vorherTakt)});delete from messages where chat_id in(${ids(chats)});delete from chat_members where chat_id in(${ids(chats)});delete from chats where id in(${ids(chats)}) and created_by='${A}';delete from contacts where ${paar};delete from krypto_schluessel where id in(${ids(neuKeys)}) and user_id in('${A}','${B}');update profiles set privat=${m.privatVorher?'true':'false'} where id='${B}';delete from notifications where ${beteiligt} and id not in(${ids(m.vorherMitteilungen)});commit;select 1 ok`);
 const rest=await frage(`select (${differenz})+(select count(*) from nummer_suche_takt where nutzer='${A}' and id not in(${zahlen(m.vorherTakt)}))+(select count(*) from contacts where ${paar})+(select count(*) from chats where id in(${ids(chats)}))+(select count(*) from chat_members where chat_id in(${ids(chats)}))+(select count(*) from messages where chat_id in(${ids(chats)}))+(select count(*) from krypto_schluessel where id in(${ids(neuKeys)}))+(select count(*) from notifications where ${beteiligt} and id not in(${ids(m.vorherMitteilungen)})) rest,(select privat from profiles where id='${B}') privat`);
 m.rest=Number(rest[0].rest);m.profilWiederhergestellt=rest[0].privat===m.privatVorher;sichern();console.log('Fixture-Rest',m.rest,'Profil wiederhergestellt',m.profilWiederhergestellt);
 for(const c of clients){c.auth.stopAutoRefresh();await c.removeAllChannels();}
}
if(process.argv.includes('--cleanup')){
 m=JSON.parse(fs.readFileSync(datei));if(m.pid!==process.pid){let aktiv=false;try{process.kill(m.pid,0);aktiv=true;}catch{}if(aktiv)throw Error('Prüfprozess noch aktiv');}
 cleanup().then(()=>{if(m.rest!==0||!m.profilWiederhergestellt)process.exitCode=1;}).catch(e=>{console.error(e.message);process.exitCode=1});
}else{
 (async()=>{
  const alte=fs.existsSync(datei)?JSON.parse(fs.readFileSync(datei)):null;if(alte&&alte.rest!==0)throw Error('Vorige Kontaktprobe nicht bereinigt');
  const grund=await frage(`select count(*) anzahl from contacts where ${paar}`);if(Number(grund[0].anzahl)!==0||(await frage(chatSql)).length)throw Error('Testpaar hat bereits Kontakte oder Zweierchats; nichts geändert');
  for(const [mail,pass,id]of[['test@all-media.app',TESTKONTO_PASS,A],['all.media.prueflauf@web.de',PRUEFKONTO_PASS,B]]){const c=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const s=await c.auth.signInWithPassword({email:mail,password:pass});if(s.error)throw s.error;if(s.data.user.id!==id)throw Error('Falsches Testkonto');clients.push(c);}
  check('Beide erlaubten Testkonten tatsächlich angemeldet',clients.length===2);
  const profil=await daten(clients[1].rpc('mein_profil'));if(Telefon.pruefe(profil.phone||''))throw Error('Testempfänger hat keine gültige eigene Nummer');
  m.vorherTreffer=await frage(`select nutzer,ziel,zeit from nummer_treffer where nutzer='${A}' and ziel='${B}'`);m.vorherTakt=(await frage(`select id from nummer_suche_takt where nutzer='${A}'`)).map(x=>x.id);m.privatVorher=Boolean(profil.privat);m.vorherKeys=(await frage(`select id from krypto_schluessel where user_id in('${A}','${B}')`)).map(x=>x.id);m.vorherMitteilungen=(await frage(`select id from notifications where ${beteiligt}`)).map(x=>x.id);m.basisLeer=true;sichern();
  await daten(clients[1].from('profiles').update({privat:true}).eq('id',B).select('id').single());
  const peer=K.schluesselpaarErzeugen();await daten(clients[1].from('krypto_schluessel').insert({user_id:B,geraet:'kontakt-live-'+m.lauf,art:'app',oeffentlich:peer.oeffentlich}).select('id').single());
  const peerId=(await daten(clients[1].from('krypto_schluessel').select('id').eq('user_id',B).eq('geraet','kontakt-live-'+m.lauf).single())).id;
  browser=await chromium.launch();const p=await browser.newPage({viewport:{width:430,height:920}});await medienEgressSchuetzen(p);p.setDefaultTimeout(20000);
  await p.goto('http://127.0.0.1:3300',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>Boolean(window.Anmeldung));
  const an=await p.evaluate(async pass=>Anmeldung.anmelden('test@all-media.app',pass),TESTKONTO_PASS);if(!an.ok)throw Error('Browseranmeldung fehlgeschlagen');await p.evaluate(()=>bootstrap());
  await p.evaluate(async()=>{await KryptoWeb.anmelden();overlay.hidden=true;overlay.innerHTML='';state.openChatId=null;chatNachsehenStoppen();openAddContact();});
  await p.locator('#contactHandle').fill(profil.phone);const text='Kontaktprobe '+m.lauf;await p.locator('#contactMsg').fill(text);
  const ausfall=async route=>{if(route.request().method()==='POST'&&/^\/api\/messages\/[^/]+$/.test(new URL(route.request().url()).pathname))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Prüfbedingte Verbindungsunterbrechung'})});return route.continue();};
  await p.route('**/api/messages/*',ausfall);await p.locator('#contactAdd').click();await p.waitForFunction(()=>document.querySelector('#contactFehler')?.textContent.includes('Kontakt angelegt.'));
  check('Echte Kontaktmaske erhält nach Sendeausfall Entwurf, Empfängerbindung und Wiederholung',await p.locator('#contactMsg').inputValue()===text&&await p.locator('#contactHandle').isDisabled()&&await p.locator('#contactAdd').isEnabled());
  const privatBild='/Users/henrik.dikta/allmedia-wt-codex/rohbelege-paket67-2026-11-17/kontakt-live';fs.mkdirSync(privatBild,{recursive:true,mode:0o700});await p.screenshot({path:path.join(privatBild,'entwurf-mit-testnummer.png')});await p.unroute('**/api/messages/*',ausfall);
  const warten=p.waitForResponse(r=>r.request().method()==='POST'&&/^\/api\/messages\/[^/]+$/.test(new URL(r.url()).pathname),{timeout:20000}).catch(e=>({fehler:e.message}));await p.locator('#contactAdd').click();const antwort=await warten;if(antwort.fehler)throw Error('Erstnachricht kam nicht beim Schreibweg an');const gesendet=await antwort.json();if(!gesendet.id)throw Error(gesendet.error||'Keine Nachrichtenkennung');
  const nachricht=await daten(clients[0].from('messages').select(require(path.join(root,'gemeinsam/spalten')).NACHRICHT_SPALTEN).eq('id',gesendet.id).single());
  m.nachricht=nachricht.id;m.chat=nachricht.chat_id;sichern();check('Echte Erstnachricht als Format2 ohne Klartext gespeichert',nachricht.krypto===2&&nachricht.text==='');
  const chat=await daten(clients[0].from('chats').select('bereich,anfrage_zustand,anfrage_von').eq('id',nachricht.chat_id).single());check('Endgültiger Messenger-Kontext bleibt eine eigene ausgehende Anfrage',chat.bereich==='messenger'&&chat.anfrage_zustand==='wartet'&&chat.anfrage_von===A);
  const kuvert=await daten(clients[1].from('message_keys').select('nonce,chiffre').eq('message_id',nachricht.id).eq('schluessel_id',peerId).single());check('Tatsächliches Gegenüber öffnet seine Format2-Erstnachricht',K.entschluesseln({version:2,kontext:K.kontextAusZeile(nachricht),chiffre:nachricht.chiffre,nonce:nachricht.krypto_nonce,absender:nachricht.absender_schluessel},kuvert,peer.geheim)===text);
  await p.waitForSelector('.anfrage');check('Originalchat zeigt Anfrage und gesperrte weitere Eingabe',await p.locator('#msgInput').isDisabled());await p.screenshot({path:path.join(__dirname,'kontakt-live-anfrage.png')});
  const zweite=await p.evaluate(async id=>api('/api/messages/'+id,await sendeKoerper(id,'Zweite Nachricht muss gesperrt bleiben')),nachricht.chat_id);const zeilen=await daten(clients[0].from('messages').select('id').eq('chat_id',nachricht.chat_id));check('Direkter zweiter API-Versuch bleibt auch jenseits der Oberfläche gesperrt',zweite.ok===false&&zeilen.length===1);
  await daten(clients[1].from('chats').update({anfrage_zustand:'angenommen'}).eq('id',nachricht.chat_id).select('id').single());
  const angenommen=await p.evaluate(async id=>api('/api/messages/'+id,await sendeKoerper(id,'Nach echter Annahme erlaubt')),nachricht.chat_id);
  const nachAnnahme=await daten(clients[0].from('messages').select('id,krypto,text').eq('chat_id',nachricht.chat_id));check('Nach tatsächlicher Annahme ist weiterer verschlüsselter Text erlaubt',Boolean(angenommen.id)&&nachAnnahme.length===2&&nachAnnahme.every(m=>m.krypto===2&&m.text===''));
  check('Kein zusätzlicher Community-Chat aus einer Vorbereitung',((await frage(chatSql)).map(x=>x.id)).length===1);
 })().catch(e=>{fehler=e.message;console.error('FEHL',fehler);process.exitCode=1;}).finally(async()=>{
  try{await cleanup();check('Eigene Daten entfernt und Empfängerprofil wiederhergestellt',m.rest===0&&m.profilWiederhergestellt);}catch(e){fehler=(fehler?fehler+'; ':'')+e.message;process.exitCode=1;console.error('BEREINIGUNG',e.message);}
  fs.writeFileSync(beleg,JSON.stringify({gut,gesamt:10,fehler:fehler||null,rest:m.rest,profilWiederhergestellt:m.profilWiederhergestellt,lauf:m.lauf},null,2));console.log(gut+'/10 Kontakt-Liveprüfungen');
 });
 process.on('SIGTERM',async()=>{await cleanup();process.exit(143);});
}
