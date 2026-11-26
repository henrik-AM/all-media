/** Echte Website-Routen + echte Browserfunktionen, Konto-/Tabellenattrappen.
 * Kein server/lokal.js, keine .env-Datei, kein Supabase-Client, kein Login.
 * Start aus app/: node test/_paket6_browser_offline.cjs (freier Port 3300).
 */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const ts = require('typescript');
const {client,basis,A,B,Krypto} = require('./_paket6_hilfe.cjs');
const W = path.resolve(__dirname,'../..'), PORT = Number(process.env.AM_OFFLINE_PORT || (Number(process.env.AM_PLATZ) > 1 ? 3350 + Number(process.env.AM_PLATZ) : 3300)), ORIGIN = `http://127.0.0.1:${PORT}`;
const out = process.env.AM_OFFLINE_BILDER || path.join(W,'pruefbelege/paket-6');
fs.mkdirSync(out,{recursive:true});
const db = basis(), postId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
db.posts=[{id:postId,user_id:B,text:'Beitrag'}];
db.stories=[{id:'story',user_id:B}]; db.profiles=[{id:A,name:'Offline A'},{id:B,name:'Offline B',privat:false}];
let stoerung=null;
const c = client(db,t=>t===stoerung?new Error('simuliert offline'):null);
c.auth = {getUser: async()=>({data:{user:{id:A}},error:null})};
const zwischenspeicher=(name,exports)=>{const id=path.join(W,'web/server',name+'.js');require.cache[id]={id,filename:id,loaded:true,exports};};
zwischenspeicher('supabase',{clientFuer:()=>c,tokenAus:()=> 'offline-attrappe',isConfigured:()=>true,supabaseUrl:ORIGIN,supabaseKey:'offline-attrappe'});
zwischenspeicher('medien',{signiereMedien:async(_c,x)=>x,ohneFremdeMedien:x=>x,mitBunny:()=>false});
const apiQuelle=fs.readFileSync(path.join(W,'web/server/supabase-api.js'),'utf8'),apiAst=ts.createSourceFile('supabase-api.js',apiQuelle,ts.ScriptTarget.Latest,true);
const anfrageZustand=Function('return ('+apiAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='anfrageZustand').getText(apiAst)+')')();
const alsNachricht=m=>({...m,krypto:m.krypto||0,chatId:m.chat_id,senderId:m.sender_id,from:m.sender_id===A?'me':B,
  kryptoNonce:m.krypto_nonce,absenderSchluessel:m.absender_schluessel,time:'18:00',
  kuvert:db.message_keys.find(k=>k.message_id===m.id&&k.schluessel_id===db.krypto_schluessel.find(s=>s.user_id===A&&s.art==='web')?.id)});
zwischenspeicher('supabase-api',{anfrageZustand,
  ladeNachrichten:async(_c,id)=>db.messages.filter(m=>m.chat_id===id).map(alsNachricht),
  ladeBeitraege:async()=>db.posts.map(p=>({...p,kind:'post'})),
  ladeChats:async()=>[],ladeStandorte:async()=>[],ladeProfil:async(_c,id)=>db.profiles.find(p=>p.id===id),
  ladeStorys:async()=>({messenger:[],videos:[]}),chatZeit:()=> '18:00',
});
const produkt = require('../../web/server/app');
const source=ts.createSourceFile('app.js',fs.readFileSync(path.join(W,'web/public/app.js'),'utf8'),ts.ScriptTarget.Latest,true);
const funktionen=source.statements.filter(ts.isFunctionDeclaration).map(n=>n.getText(source)).join('\n');
const variablen=source.statements.filter(ts.isVariableStatement).filter(n=>n.declarationList.declarations.some(d=>['esc','$'].includes(d.name.getText(source)))).map(n=>n.getText(source)).join('\n');
const harness=`${variablen}
const state={users:{},messages:[],chats:[],openChatId:'zwei'};
let msgBezug=null,msgBearbeitet=null;
const ziel={id:'zwei',userId:'${B}',isGroup:false,name:'Offline B'};
state.users['${B}']={name:'Offline B',initials:'B',color:'#888'};
${funktionen}
// Nur der Rahmen des Komponentenprüfstands: Produktfunktionen oben unverändert.
paintMessages = () => {document.querySelector('#messages').innerHTML=state.messages.map(m=>messageBubble(m,ziel)).join('');};
verschluesseltMarkieren = async()=>{};
nachrichtTon = ()=>{};
chatGesperrt = ()=>false;
toast = text=>{document.querySelector('#hinweis').textContent=text;};
document.querySelector('#sendBtn').onclick=()=>sendMessage(ziel);
`;
const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head>
<body><main style="max-width:420px;margin:24px auto;padding:16px"><p>OFFLINE · Paket 6 · Komponentenprüfung</p><h2>Verschlüsselter Chat</h2><p id="nummer"></p><div id="messages"></div><div class="composer"><input id="msgInput" aria-label="Nachricht"><button id="sendBtn">Senden</button></div><p id="hinweis" role="status"></p></main>
<script src="/gemeinsam/tweetnacl.js"></script><script src="/gemeinsam/krypto.js"></script><script src="/gemeinsam/story.js"></script><script src="/icons.js"></script><script src="/krypto.js"></script><script src="/paket6-funktionen.js"></script></body></html>`;
const server=http.createServer((req,res)=>{
  if(req.url==='/paket6'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
  if(req.url==='/paket6-funktionen.js'){res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end(harness);}
  if(req.url.startsWith('/api/reset')){res.statusCode=403;return res.end('OFFLINE: kein Reset');}
  produkt(req,res);
});
let browser,ok=0;
const pruefe=(titel,b)=>{assert.ok(b,titel);ok++;console.log(`OK ${titel}`);};
(async()=>{
  await new Promise((res,rej)=>{server.once('error',rej);server.listen(PORT,'127.0.0.1',res);});
  // Node-Verbindungen (außer dem lokalen Prüfport) auch unabhängig vom Browser sperren.
  const socket=require('net').Socket.prototype.connect;
  require('net').Socket.prototype.connect=function(...args){
    const v=Array.isArray(args[0])?args[0][0]:args[0];
    if(typeof v==='object'&&Number(v.port)===PORT&&['127.0.0.1','localhost'].includes(v.host))return socket.apply(this,args);
    throw new Error('OFFLINE: Node-Netzwerk verweigert');
  };
  global.fetch=()=>{throw new Error('OFFLINE: Node-fetch verweigert');};
  browser=await chromium.launch({args:['--disable-background-networking','--disable-component-update','--disable-domain-reliability']});
  const ctx=await browser.newContext({viewport:{width:430,height:880},serviceWorkers:'block'});
  const extern=[]; await ctx.route('**/*',r=>{if(new URL(r.request().url()).origin!==ORIGIN){extern.push(r.request().url());return r.abort();}return r.continue();});
  await ctx.addInitScript(({A})=>{window.Anmeldung={nutzer:()=>({id:A}),konten:()=>[{id:A}]};}, {A});
  const page=await ctx.newPage();const fehler=[];page.on('pageerror',e=>{fehler.push(e.message);console.error('Browserfehler:',e.message);});
  page.on('console',m=>{if(m.type()==='error')console.error('Browserkonsole:',m.text());});
  await page.goto(ORIGIN+'/paket6');await page.evaluate(()=>KryptoWeb.anmelden());
  await page.locator('#msgInput').fill('Offline geheim 🔒');await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Offline geheim'),null,{timeout:5000}).catch(async e=>{console.error(await page.locator('body').innerText());console.error('Tabellen:',db.messages.length,db.krypto_schluessel.length);throw e;});
  pruefe('Browser sendet verschlüsselt, Speichertabelle enthält keinen Klartext',db.messages.length===1&&db.messages[0].krypto===2&&db.messages[0].text==='');
  pruefe('Kuverts auch für das Browsergerät und Gegenüber vorhanden',db.message_keys.length===3);
  const peer=db.krypto_schluessel.find(s=>s.id==='b'),nachricht=db.messages[0],kuvert=db.message_keys.find(k=>k.message_id===nachricht.id&&k.schluessel_id===peer.id);
  pruefe('Gegenüber kann das echte Browserpaket lesen',Krypto.entschluesseln({version:nachricht.krypto,kontext:Krypto.kontextAusZeile(nachricht),chiffre:nachricht.chiffre,nonce:nachricht.krypto_nonce,absender:nachricht.absender_schluessel},kuvert,db.pb.geheim)==='Offline geheim 🔒');

  // Fehler im echten Composer: nicht nur die Kryptofunktion isoliert prüfen.
  const entwurfStatus=()=>page.evaluate(()=>({text:$('#msgInput').value,edit:!!msgBearbeitet,bezug:!!msgBezug,leiste:!!document.querySelector('.msgbezug'),frei:!$('#sendBtn').disabled}));
  for(const wirft of [false,true]){
    await page.evaluate(async wirft=>{
      const original=KryptoWeb.umschliessen;KryptoWeb.umschliessen=()=>{if(wirft)throw Error('Schlüsselbund nicht lesbar');return null;};
      msgBearbeitet=state.messages[0];msgBezug=null;zeigeBezugLeiste(ziel);$('#msgInput').value='Bearbeiteter geheimer Entwurf';
      try{await sendMessage(ziel);}finally{KryptoWeb.umschliessen=original;}
    },wirft);
    const st=await entwurfStatus();pruefe('Bearbeiten: '+(wirft?'geworfener Kryptofehler':'fehlendes Umschlüsselpaket')+' erhält Entwurf/Bezug und ermöglicht Wiederholung',st.text==='Bearbeiteter geheimer Entwurf'&&st.edit&&st.leiste&&st.frei&&db.messages.length===1);
  }
  await page.route('**/api/messages/zwei/*/bearbeiten',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:false,error:'Simulierte Bearbeitungsabsage'})}));
  await page.evaluate(()=>sendMessage(ziel));
  let st=await entwurfStatus();pruefe('Bearbeiten: Serverabsage erhält Text und Bearbeitenbezug',st.edit&&st.leiste&&st.frei&&st.text==='Bearbeiteter geheimer Entwurf');
  await page.unroute('**/api/messages/zwei/*/bearbeiten');
  await page.evaluate(()=>sendMessage(ziel));
  st=await entwurfStatus();pruefe('Bearbeiten: Wiederholung gelingt verschlüsselt und schließt Entwurf erst bei Erfolg',st.text===''&&!st.edit&&!st.leiste&&stateNichtOffen());
  function stateNichtOffen(){return db.messages.length===1&&db.messages[0].text===''&&db.messages[0].krypto===2;}
  for(const art of ['absage','netz','json']){
    await page.route('**/api/messages/zwei',r=>art==='netz'?r.abort():r.fulfill({contentType:'application/json',body:art==='json'?'keine JSON-Antwort':JSON.stringify({ok:false,error:'Simulierte Sendeabsage'})}));
    await page.evaluate(async()=>{msgBearbeitet=null;msgBezug={art:'antwort',nachricht:state.messages[0]};zeigeBezugLeiste(ziel);$('#msgInput').value='Antwortentwurf bleibt';await sendMessage(ziel);});
    st=await entwurfStatus();pruefe('Senden: '+art+' erhält Entwurf/Antwortbezug, Knopf und Bestand',st.text==='Antwortentwurf bleibt'&&st.bezug&&st.leiste&&st.frei&&db.messages.length===1);
    await page.unroute('**/api/messages/zwei');
  }
  await page.evaluate(()=>sendMessage(ziel));st=await entwurfStatus();
  pruefe('Antwort nach Fehlversuch erfolgreich, verschlüsselt mit richtigem Bezug',st.text===''&&!st.bezug&&!st.leiste&&db.messages.length===2&&db.messages[1].reply_to===db.messages[0].id&&db.messages[1].text==='');
  // Gleichzeitig erneut ausgelöste Eingabe darf keinen zweiten Auftrag anlegen.
  const doppelVorher=db.messages.length;
  await page.evaluate(async()=>{$('#msgInput').value='Genau einmal';await Promise.all([sendMessage(ziel),sendMessage(ziel)]);});
  pruefe('Doppeltes Auslösen während der Anfrage erzeugt nur eine Nachricht',db.messages.length===doppelVorher+1);

  let freigeben,angefordert;const halten=new Promise(r=>freigeben=r),anfrage=new Promise(r=>angefordert=r);
  await page.route('**/api/messages/zwei',async r=>{angefordert();await halten;await r.continue();});
  await page.evaluate(()=>{$('#msgInput').value='Erster Entwurf';window.__sendend=sendMessage(ziel);});await anfrage;
  await page.locator('#msgInput').fill('Neuer Entwurf während Anfrage');freigeben();await page.evaluate(()=>window.__sendend);
  pruefe('Neue Eingabe während Anfrage bleibt nach Bestätigung erhalten',await page.locator('#msgInput').inputValue()==='Neuer Entwurf während Anfrage'&&!await page.locator('#sendBtn').isDisabled());
  await page.unroute('**/api/messages/zwei');
  const vorher=db.messages.length;
  stoerung='krypto_schluessel';await page.locator('#msgInput').fill('Nicht offen senden');await page.locator('#sendBtn').evaluate(b=>{b.disabled=false;});await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>document.querySelector('#hinweis').textContent.includes('nicht verschlüsseln'));
  pruefe('Fehler sichtbar und Entwurf erhalten',await page.locator('#msgInput').inputValue()==='Nicht offen senden');
  pruefe('Netz-/Schlüsselstörung schreibt nichts',db.messages.length===vorher);
  await page.screenshot({path:path.join(out,'browser-sendesperre.png')});stoerung=null;
  let nr=await page.evaluate(async B=>kryptoZustand(B,ziel),B);pruefe('Kontakt-Sicherheitsnummer entspricht Rechenschicht',nr.fingerabdruck===Krypto.paarSicherheitsnummer(A,db.krypto_schluessel.filter(k=>k.user_id===A).map(k=>k.oeffentlich),B,db.krypto_schluessel.filter(k=>k.user_id===B).map(k=>k.oeffentlich)).nummer&&nr.geraete>=2);
  const zweit=Krypto.schluesselpaarErzeugen();db.krypto_schluessel.push({id:'altes-geraet',user_id:B,oeffentlich:zweit.oeffentlich,created_at:'2000-01-01'});
  const nr2=await page.evaluate(async B=>kryptoZustand(B,ziel),B);pruefe('Altes zusätzliches Gerät ändert sichtbare Nummer',nr2.geraete===nr.geraete+1&&nr2.fingerabdruck!==nr.fingerabdruck);
  db.chat_members.push({chat_id:'zwei',user_id:'dritter-ohne-schluessel'});
  const unsicher=await page.evaluate(async B=>kryptoZustand(B,ziel),B);
  pruefe('Drittes Mitglied ohne Schlüssel erhält keine aktive Schlossanzeige',unsicher.an===false);
  db.chat_members.pop();
  const faelscher=Krypto.schluesselpaarErzeugen();const mein=db.krypto_schluessel.find(s=>s.art==='web');
  const f=Krypto.verschluesseln('Gefälschter Absender',faelscher.geheim,[mein]);
  const n={id:'falsch',chatId:'zwei',senderId:B,from:B,krypto:1,chiffre:f.chiffre,kryptoNonce:f.nonce,absenderSchluessel:f.absender,kuvert:f.kuverts[0],time:'18:00'};
  await page.evaluate(async({n,nr2})=>{KryptoWeb.oeffnen(n);await KryptoWeb.absenderPruefen([n]);state.messages.push(n);paintMessages();document.querySelector('#nummer').textContent=`Sicherheitsnummer (${nr2.geraete} Geräte): ${nr2.fingerabdruck}`;},{n,nr2});
  pruefe('Echte Blase zeigt Absenderwarnung',await page.locator('.msg__nichtPruefbar').innerText()==='⚠ Absender nicht prüfbar ·');
  await page.screenshot({path:path.join(out,'browser-absenderwarnung.png')});
  const post=await page.evaluate(async id=>{const paket=await sendeKoerper('zwei','Beitrag geteilt');return api('/api/teilen',{id,art:'post',empfaenger:[ziel.userId],ziele:[{chatId:'zwei',...paket}]});},postId);
  pruefe('Echte Teilen-Route schreibt verschlüsselt samt Beitragsbezug',post.ok&&db.messages.at(-1).shared_post_id===postId&&db.messages.at(-1).text==='');
  const a=await page.evaluate(async()=>{const vorab=await api('/api/messages/zwei/anhang/vorbereiten',{art:'gif'});return api('/api/messages/zwei/anhang',{art:'gif',paket:await sendeKoerper('zwei',vorab.text)});});
  pruefe('Echte Anhangroute verschließt die Beschriftung',a.ok&&db.messages.at(-1).krypto===2&&db.messages.at(-1).text==='');
  const sticker=await page.evaluate(async()=>{
    let message;await anhangSenden({pfad:'/api/messages/zwei/anhang',chatId:'zwei',bezug:()=>({antwortAuf:state.messages[0].id}),fertig:m=>{message=m;}},'stickerZeichen',null,'🙂');return message;
  });
  pruefe('Echte Anhangaktion erhält den verschlossenen Antwortbezug',sticker?.text==='🙂'&&db.messages.at(-1).reply_to===db.messages[0].id);
  const story=await page.evaluate(()=>storyAntwortSenden('story','Schöne Story'));
  pruefe('Echte Storyroute verschließt Antwort mit Storybezug',story.ok&&db.messages.at(-1).reply_to_story==='story'&&db.messages.at(-1).text==='');
  const raw=await page.evaluate(()=>api('/api/messages/zwei/anhang',{art:'gif'}));
  pruefe('Alter Anhang-Aufrufer wird ausdrücklich abgewiesen',raw.ok===false&&/nicht verschlüsseln/.test(raw.error));
  const fehlt=await page.evaluate(async()=>{const alt=window.KryptoWeb;window.KryptoWeb=null;try{await sendeKoerper('zwei','geheim');return false;}catch{return true;}finally{window.KryptoWeb=alt;}});
  pruefe('Fehlendes Kryptoskript sendet keinen Klartext',fehlt);
  const dialog=await page.evaluate(async B=>{
    const original=openEinstellung;
    try {let info;openEinstellung=x=>{info=x.info;};await kontaktZeile('Verschlüsselung',B,ziel,{});return info;}
    finally {openEinstellung=original;}
  },B);
  pruefe('Echter Kontaktinfotext erklärt den gemeinsamen Vergleich',dialog.includes('Gemeinsame Sicherheitsnummer')&&dialog.includes('auf beiden Geräten gleich')&&dialog.includes('Lokaler Fingerabdruck dieses Geräts')&&dialog.includes('Deine registrierten Geräteschlüssel')&&dialog.includes('beim bloßen Nummernvergleich nicht auf'));
  await page.evaluate(dialog=>{document.querySelector('#messages').textContent=dialog;document.querySelector('#messages').style.whiteSpace='pre-wrap';document.querySelector('.composer').remove();document.querySelector('#hinweis').textContent='';},dialog);
  await page.screenshot({path:path.join(out,'browser-paarvergleich.png'),fullPage:true});
  // Frischer Kontakt: vor dem Kontakt gehört das Paar zu Communitys,
  // nach dem Kontakt zum Messenger. Unterschiedliche IDs dürfen keinen
  // verschlüsselten Ersttext an den falschen Kontext binden.
  db.chats=[];db.chat_members=[];db.contacts=[];db.messages=[];db.message_keys=[];
  c.rpc=async(name,args)=>{
    if(name==='finde_per_nummer')return {data:{...db.profiles.find(p=>p.id===B),privat:true},error:null};
    if(name==='messenger_erlaubt')return {data:db.contacts.some(k=>k.user_id===A&&k.contact_id===B),error:null};
    if(name==='zweierchat_anlegen'){
      let chat=db.chats.find(c=>c.bereich===args.p_bereich);
      if(!chat){chat={id:require('crypto').randomUUID(),bereich:args.p_bereich,is_group:false,created_by:A,anfrage_zustand:'wartet',anfrage_von:A};db.chats.push(chat);db.chat_members.push({chat_id:chat.id,user_id:A},{chat_id:chat.id,user_id:B});}
      return {data:chat.id,error:null};
    }
    return {data:true,error:null};
  };
  await page.addScriptTag({content:fs.readFileSync(path.join(W,'gemeinsam/telefon.js'),'utf8')});
  await page.evaluate(()=>{
    state.contacts=[];state.chats=[];window.overlay=document.createElement('section');document.body.append(overlay);
    openSheet=(_titel,html,fn)=>{const sheet=document.createElement('section');sheet.id='kontaktProbe';sheet.innerHTML=html;document.body.append(sheet);fn(sheet,()=>sheet.remove());};
    openChat=id=>{window.kontaktGeoeffnet=id;};window.kontaktGeoeffnet=null;openAddContact();
  });
  await page.locator('#contactHandle').fill('+49 170 1234567');await page.locator('#contactMsg').fill('Erster verschlüsselter Kontakttext');await page.locator('#contactAdd').click();
  await page.waitForFunction(()=>window.kontaktGeoeffnet||!document.querySelector('#contactFehler')?.hidden);
  const kontaktStand=await page.evaluate(()=>({id:window.kontaktGeoeffnet,fehler:document.querySelector('#contactFehler')?.textContent}));
  console.log('Kontaktkontext',JSON.stringify({kontaktStand,chats:db.chats.map(c=>({id:c.id,bereich:c.bereich})),nachrichten:db.messages.length}));
  pruefe('Neuer Kontakt sendet Format2 im endgültigen Messenger-Kontext',Boolean(kontaktStand.id)&&db.chats.length===1&&db.messages.length===1&&db.messages[0].chat_id===kontaktStand.id&&db.chats.find(c=>c.id===kontaktStand.id)?.bereich==='messenger'&&db.messages[0].krypto===2&&db.messages[0].text==='');
  const erste=db.messages[0],kontaktKuvert=db.message_keys.find(k=>k.message_id===erste.id&&k.schluessel_id==='b');
  pruefe('Gegenüber öffnet die verschlüsselte Kontakt-Erstnachricht',Krypto.entschluesseln({version:erste.krypto,kontext:Krypto.kontextAusZeile(erste),chiffre:erste.chiffre,nonce:erste.krypto_nonce,absender:erste.absender_schluessel},kontaktKuvert,db.pb.geheim)==='Erster verschlüsselter Kontakttext');
  const zweite=await page.evaluate(async id=>api('/api/messages/'+id,await sendeKoerper(id,'Zweite Nachricht vor Annahme')),kontaktStand.id);
  pruefe('Zweite Nachricht vor Annahme bleibt gesperrt',zweite.ok===false&&/Anfrage/.test(zweite.error)&&db.messages.length===1);
  db.chats[0].anfrage_zustand='angenommen';
  const angenommen=await page.evaluate(async id=>api('/api/messages/'+id,await sendeKoerper(id,'Nach angenommener Chatanfrage')),kontaktStand.id);
  pruefe('Angenommener Chat ist trotz altem Kontaktstatus wieder beschreibbar',Boolean(angenommen.id)&&db.messages.length===2);
  // Fehler nach Kontaktanlage: keine unlesbare Nachricht stehenlassen und
  // beim Wiederholen weder Kontakt noch Chat duplizieren.
  db.chats=[];db.chat_members=[];db.contacts=[];db.messages=[];db.message_keys=[];stoerung='message_keys';
  await page.evaluate(()=>{window.kontaktGeoeffnet=null;state.contacts=[];state.chats=[];openAddContact();});
  await page.locator('#contactHandle').fill('+49 170 1234567');await page.locator('#contactMsg').fill('Entwurf nach Kontaktanlage');
  await page.locator('#contactAdd').evaluate(b=>{b.click();b.click();});
  await page.waitForFunction(()=>document.querySelector('#contactFehler')?.textContent.includes('Kontakt angelegt.'));
  pruefe('Kuvertfehler lässt Entwurf und erneutes Senden im Kontaktblatt',await page.locator('#contactMsg').inputValue()==='Entwurf nach Kontaktanlage'&&await page.locator('#contactAdd').isEnabled());
  pruefe('Angelegter Empfänger bleibt fest; Doppeltipp erzeugt genau einen Kontakt',await page.locator('#contactHandle').isDisabled()&&db.contacts.length===1&&db.chats.length===1);
  pruefe('Fehlendes Kuvert hinterlässt keine Nachricht und keinen Klartext',db.messages.length===0&&db.message_keys.length===0);
  await page.screenshot({path:path.join(out,'browser-kontakt-entwurf.png')});
  stoerung=null;const kontaktId=db.chats[0].id;
  const versuch=await page.evaluate(async id=>sendeKoerper(id,'Nicht vom Anfragenden'),kontaktId);
  db.chats[0].anfrage_von=B;
  const fremd=await page.evaluate(({id,body})=>api('/api/messages/'+id,body),{id:kontaktId,body:versuch});
  pruefe('Widersprüchliche Anfragezuordnung öffnet keine Erstnachricht',fremd.ok===false&&db.messages.length===0);db.chats[0].anfrage_von=A;
  stoerung='messages';const unklar=await page.evaluate(({id,body})=>api('/api/messages/'+id,body),{id:kontaktId,body:versuch});
  pruefe('Nicht ladbare Nachrichtenanzahl öffnet die Anfragesperre nicht',unklar.ok===false&&/Anfrage/.test(unklar.error)&&db.messages.length===0);stoerung=null;
  await page.locator('#contactAdd').click();await page.waitForFunction(()=>Boolean(window.kontaktGeoeffnet));
  pruefe('Wiederholung sendet verschlüsselt ohne zweite Kontakt- oder Chatanlage',db.contacts.length===1&&db.chats.length===1&&db.messages.length===1&&db.messages[0].krypto===2&&db.messages[0].text==='');
  pruefe('Keine externen Browseranfragen',extern.length===0);
  pruefe('Keine Browser-Skriptfehler',fehler.length===0);
  console.log(`${ok}/${ok} Offline-Browserprüfungen; Port ${PORT}, keine Supabase-Verbindung.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
