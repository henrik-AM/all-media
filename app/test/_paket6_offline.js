require('./_offline_sperre.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { client, app, browser, antwort, basis, A, B, Krypto, schluesselHolen, S } = require('./_paket6_hilfe.cjs');
test('Alle 1201 Geräte: App und Server lesen auch den ältesten Schlüssel', async()=>{
  const db=basis(); db.krypto_schluessel=Array.from({length:1201},(_,i)=>({id:String(i).padStart(5,'0'),user_id:B,oeffentlich:crypto.randomBytes(32).toString('base64')}));
  const c=client(db),{K}=app();
  const appListe=await K.kontoSchluessel(c,B),serverListe=await schluesselHolen(c,[B]);
  assert.equal(appListe.length,1201);assert.deepEqual(appListe,serverListe);
  const nr=K.sicherheitsnummer(appListe.map(k=>k.oeffentlich));assert.equal(nr.geraete,1201);
  assert.notEqual(nr.nummer,K.sicherheitsnummer(appListe.slice(1).map(k=>k.oeffentlich)).nummer);
  assert.equal((await S.kryptoFakten(c,'zwei',A)).schluessel.length,1201);
});
test('Verkürzte Seite, Fehler in Seite 2, wechselnde Anzahl: kein Teilergebnis',async()=>{
  const db=basis();db.krypto_schluessel=Array.from({length:220},(_,i)=>({id:''+i,user_id:B,oeffentlich:db.pb.oeffentlich}));
  await assert.rejects(schluesselHolen(client(db,(_t,_a,r)=>r?.[0]===200?new Error('offline'):null),[B]));
  const c=client(db),base=c.from;c.from=t=>{const q=base(t),then=q.then;q.then=(res,rej)=>then.call(q,r=>res({...r,count:r.count+1}),rej);return q;};
  await assert.rejects(schluesselHolen(c,[B]),/verkürzt/);
});
test('Unvollständige Fakten und fehlende Mitgliedschaft werden abgelehnt',()=>{
  for(const f of [{},{istGruppe:false},{istGruppe:'true'},{istGruppe:false,ichId:A,mitglieder:[B],schluessel:[],schonVerschluesselt:false}]) assert.equal(Krypto.sendeweg(f).art,'ablehnen');
});
test('Absender: 251 verschiedene Paare werden vollständig geprüft',async()=>{
  let fragen=0;const paare=Array.from({length:251},(_,i)=>({userId:A,schluessel:'s'+i}));
  const p=Krypto.absenderPruefer(async l=>{fragen++;assert.ok(l.length<=100);return l.map(x=>({user_id:x.userId,oeffentlich:x.schluessel}));});
  assert.ok((await p.pruefen(paare)).every(Boolean));assert.equal(fragen,3);
});
test('Absender: entfernter Schlüssel wird nach Ablauf erneut geprüft',async()=>{
  let bekannt=true;const p=Krypto.absenderPruefer(async()=>bekannt?[{user_id:A,oeffentlich:'x'}]:[],{nachladenMs:-1});
  assert.deepEqual(await p.pruefen([{userId:A,schluessel:'x'}]),[true]);bekannt=false;
  assert.deepEqual(await p.pruefen([{userId:A,schluessel:'x'}]),[false]);
});
test('App: Altbestand ohne Gerätekennung bleibt lesbar; neue Konten sind getrennt',async()=>{
  const alt=Krypto.schluesselpaarErzeugen(),speicher={'allmedia.krypto.geheim':alt.geheim};
  const {K}=app(speicher),c=client(basis());
  const [a,b]=await Promise.all([K.meinSchluessel(c,A),K.meinSchluessel(c,B)]);
  assert.equal(a.geheim,alt.geheim);assert.equal(b.geheim,alt.geheim);assert.ok(a.geraet);assert.ok(b.geraet);
  const neu=await K.meinSchluessel(c,'neu');assert.notEqual(neu.geheim,alt.geheim);
});
test('App: unterbrochene Fachschreibung verliert vorhandenen Schlüssel nicht',async()=>{
  const alt=Krypto.schluesselpaarErzeugen(),speicher={['allmedia.krypto.geheim.'+A]:alt.geheim};
  const {K}=app(speicher);const m=await K.meinSchluessel(client(basis()),A);assert.equal(m.geheim,alt.geheim);assert.ok(m.geraet);
});
test('App: frische Konten bekommen auch bei parallelem Start getrennte Schlüssel',async()=>{
  const {K}=app(),c=client(basis()); const [a,b]=await Promise.all([K.meinSchluessel(c,A),K.meinSchluessel(c,B)]);
  assert.notEqual(a.geheim,b.geheim);assert.notEqual(a.geraet,b.geraet);
  assert.equal((await K.meinSchluessel(c,A)).geheim,a.geheim);
});
test('App: unzulässige Fachkennung wird abgewiesen statt mit anderer zu kollidieren',async()=>{
  const {K}=app(),c=client(basis());assert.equal(await K.meinSchluessel(c,'a/b'),null);
});
test('App: Chat-/Verlauf-/Mitgliederfehler verhindern Senden einschließlich Anhang',async()=>{
  for(const table of ['chats','chat_members','messages']) {
    const {K}=app(),c=client(basis(),t=>t===table?new Error('offline'):null);
    for(const text of ['Hallo','']) await assert.rejects(K.fuerChatVerschliessen(c,'zwei',A,text),/nicht verschlüsseln/);
  }
});
test('Browser: zwei parallele Kontoanmeldungen verwechseln ihre Ergebnisse nicht',async()=>{
  const konto={id:A};const offen=[];const ctx=browser(konto,async(url,opt)=>{
    if(url==='/api/krypto/schluessel')return new Promise(res=>offen.push(()=>res(antwort({id:JSON.parse(opt.body).geraet}))));
    throw new Error('unerwartete Route');
  });
  const a=ctx.KryptoWeb.anmelden();konto.id=B;const b=ctx.KryptoWeb.anmelden();assert.equal(offen.length,2);
  offen[0]();assert.equal(await a,null);offen[1]();assert.equal((await b).kontoId,B);assert.equal(ctx.KryptoWeb.meinSchluessel().kontoId,B);
});
test('Browser: vergessen widerruft auch eine noch laufende Anmeldung',async()=>{
  const konto={id:A};let fertig;const ctx=browser(konto,()=>new Promise(res=>{fertig=()=>res(antwort({id:'alt'}));}));
  const p=ctx.KryptoWeb.anmelden();ctx.KryptoWeb.vergessen();fertig();assert.equal(await p,null);assert.equal(ctx.KryptoWeb.bereit(),false);
});
test('Browser: fehlende/alte Fakten und Kontowechsel beim Senden sperren Klartext',async()=>{
  for(const fakten of [{},{verschluesselbar:false,schluessel:[]},{istGruppe:false,ichId:B,mitglieder:[A,B],schluessel:[],schonVerschluesselt:false}]) {
    const ctx=browser({id:A},url=>antwort(url==='/api/krypto/schluessel'?{id:'a'}:fakten));
    await assert.rejects(ctx.KryptoWeb.verschliessen('zwei','geheim'),/nicht verschlüsseln/);
  }
});
test('Browser: nicht ladbarer Absender wird sichtbar gewarnt; späterer Erfolg löscht Warnung',async()=>{
  const konto={id:A};let online=false;const ctx=browser(konto,url=>url==='/api/krypto/schluessel'?antwort({id:'a'}):online?antwort({gefunden:[{user_id:B,oeffentlich:'b'}]}):Promise.reject(new Error('offline')));
  await ctx.KryptoWeb.anmelden();const n={_geoeffnet:true,senderId:B,absenderSchluessel:'b'};
  await ctx.KryptoWeb.absenderPruefen([n]);assert.equal(n.nichtPruefbar,true);online=true;await ctx.KryptoWeb.absenderPruefen([n]);assert.equal(n.nichtPruefbar,false);
});
test('Server: Kontakttext und Beitrag-Teilen können nicht mehr offen am Wächter vorbei',async()=>{
  const db=basis(),c=client(db);let e=await S.handleAddContact(c,A,B,false,'geheimer Kontakttext');
  assert.equal(e.ok,false);assert.equal(db.messages.length,0);
  e=await S.handleShareToChats(c,A,'post',[B],'geheime Vorschau');assert.equal(e.gesendet.length,0);assert.equal(db.messages.length,0);
});
test('Server: verschlüsselte Kontakt-/Beitragsnachricht erreicht alle Kuverts',async()=>{
  for(const art of ['kontakt','teilen']) {
    const db=basis(),c=client(db),p=Krypto.verschluesseln('geheim',db.pa.geheim,db.krypto_schluessel);
    const paket={chatId:'zwei',krypto:1,chiffre:p.chiffre,kryptoNonce:p.nonce,absenderSchluessel:p.absender,kuverts:p.kuverts};
    const e=art==='kontakt'?await S.handleAddContact(c,A,B,false,'',paket):await S.handleShareToChats(c,A,'post',[B],'geheim','messenger',[paket]);
    assert.equal(e.ok,true);assert.equal(db.messages.length,1);assert.equal(db.messages[0].text,'');assert.equal(db.message_keys.length,2);
    if(art==='teilen')assert.equal(db.messages[0].shared_post_id,'post');
  }
});
test('App: Kontakt und Beitrag-Teilen benutzen die echte Verschlüsselung',async()=>{
  for(const art of ['kontakt','teilen']) {
    const db=basis(),c=client(db),a=app();
    if(art==='kontakt')await a.aktionen().kontaktHinzufuegen(c,A,B,false,'geheim');
    else {const e=await a.aktionen().teilen(c,A,'post',[B],'geheim');assert.deepEqual(e.gesendet,[B]);}
    assert.equal(db.messages.length,1);assert.equal(db.messages[0].krypto,1);assert.equal(db.messages[0].text,'');assert.ok(db.message_keys.length>=2);
  }
});
test('Server: fehlende Chiffre/Kuverts und unlesbarer Chat führen zu null Schreibvorgängen',async()=>{
  const db=basis(),c=client(db);
  assert.equal((await S.handleSendMessage(c,A,'zwei','',{krypto:1,chiffre:'x'})).ok,false);
  assert.equal((await S.handleSendMessage(c,A,'unbekannt','klar',{})).ok,false);assert.equal(db.messages.length,0);
});

test('Absender: abgelaufene positive Prüfung bei Netzfehler ohne Vertrauen',async()=>{
  let online=true;const p=Krypto.absenderPruefer(async()=>{if(!online)throw new Error('offline');return [{user_id:A,oeffentlich:'x'}];},{nachladenMs:-1});
  assert.deepEqual(await p.pruefen([{userId:A,schluessel:'x'}]),[true]);online=false;
  assert.deepEqual(await p.pruefen([{userId:A,schluessel:'x'}]),[null]);
});
test('Sicherheitsnummer: kaputter Schlüssel darf keine gültige Nummer vortäuschen',()=>{
  assert.throws(()=>Krypto.sicherheitsnummer(['kaputt']),/Ungültiger/);
});

test('App: drittes Mitglied ohne eigenes Gerät bekommt kein Verschlüsselungsschloss',async()=>{
  const db=basis();db.chat_members.push({chat_id:'zwei',user_id:'dritter-ohne-schluessel'});
  const {K}=app();assert.equal(await K.chatVerschluesselbar(client(db),'zwei',A),false);
});
test('Kontakt-/Teilen-Kryptopaket kann keine fremden Medien-/Storybezüge einschleusen',async()=>{
  for(const art of ['kontakt','teilen']) {
    const db=basis(),c=client(db),p=Krypto.verschluesseln('geheim',db.pa.geheim,db.krypto_schluessel);
    const paket={chatId:'zwei',krypto:1,chiffre:p.chiffre,kryptoNonce:p.nonce,absenderSchluessel:p.absender,kuverts:p.kuverts,
      url:'fremde-datei',storyId:'fremde-story',geteilterBeitragId:'fremder-beitrag'};
    const e=art==='kontakt'?await S.handleAddContact(c,A,B,false,'',paket):await S.handleShareToChats(c,A,'echter-post',[B],'','messenger',[paket]);
    assert.equal(e.ok,true);assert.equal(db.messages[0].media_url,null);assert.equal(db.messages[0].reply_to_story,null);
    assert.equal(db.messages[0].shared_post_id,art==='teilen'?'echter-post':null);
  }
});
