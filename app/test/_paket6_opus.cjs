require('./_offline_sperre.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {client,app,browser,antwort,basis,A,B,Krypto,S}=require('./_paket6_hilfe.cjs');
test('Gemeinsame Nummer stimmt auf beiden Seiten und bindet Kontozuordnung',()=>{
 const a=Krypto.schluesselpaarErzeugen(),b=Krypto.schluesselpaarErzeugen(),c=Krypto.schluesselpaarErzeugen();
 const n=Krypto.paarSicherheitsnummer(A,[a.oeffentlich],B,[b.oeffentlich]);
 assert.deepEqual(n,Krypto.paarSicherheitsnummer(B,[b.oeffentlich],A,[a.oeffentlich]));
 assert.equal(n.geraete,2);
 assert.notEqual(n.nummer,Krypto.paarSicherheitsnummer(A,[a.oeffentlich],B,[b.oeffentlich,c.oeffentlich]).nummer);
 assert.notEqual(n.nummer,Krypto.paarSicherheitsnummer(A,[b.oeffentlich],B,[a.oeffentlich]).nummer);
 assert.equal(Krypto.paarSicherheitsnummer(A,[],B,[b.oeffentlich]),null);
});
test('Server: alte Klartextnachricht im inzwischen verschlüsselten Chat nicht bearbeiten',async()=>{
 const db=basis();db.messages.push({id:'alt',chat_id:'zwei',sender_id:A,krypto:0,text:'vorher'});
 const e=await S.handleNachrichtBearbeiten(client(db),A,'alt','sensibel',{});
 assert.equal(e.ok,false);assert.equal(db.messages.find(m=>m.id==='alt').text,'vorher');
});
test('App: alte Klartextnachricht im inzwischen verschlüsselten Chat nicht bearbeiten',async()=>{
 const db=basis();db.messages.push({id:'alt',chat_id:'zwei',sender_id:A,krypto:0,text:'vorher'});
 const Ak=app().aktionen();
 await assert.rejects(Ak.nachrichtBearbeiten(client(db),A,'alt','sensibel'),/nicht mehr bearbeitet/);
 assert.equal(db.messages.find(m=>m.id==='alt').text,'vorher');
});
test('App: abgemeldetes historisches Konto bekommt Altpaar, neues Konto niemals',async()=>{
 const alt=Krypto.schluesselpaarErzeugen(),db=basis();
 db.krypto_schluessel=[{id:'a-alt',user_id:A,oeffentlich:alt.oeffentlich,geraet:'alt-a'},{id:'b-alt',user_id:B,oeffentlich:alt.oeffentlich,geraet:'alt-b'}];
 const speicher={'allmedia.krypto.geheim':alt.geheim},erste=app(speicher,[A]);
 const a=await erste.K.meinSchluessel(client(db),A);assert.equal(a.geheim,alt.geheim);
 assert.equal(speicher['allmedia.krypto.geheim'],alt.geheim);
 const zweite=app(speicher,[B]);const b=await zweite.K.meinSchluessel(client(db),B);
 assert.equal(b.geheim,alt.geheim);assert.equal(b.id,'b-alt');
 const n=await zweite.K.meinSchluessel(client(db),'neu');assert.notEqual(n.geheim,alt.geheim);
});
test('App: nach altem Löschen erhaltene kontogebundene Kopie wiederfinden',async()=>{
 const alt=Krypto.schluesselpaarErzeugen(),db=basis();
 db.krypto_schluessel=[{id:'b-alt',user_id:B,oeffentlich:alt.oeffentlich,geraet:'alt-b'}];
 const {K}=app({['allmedia.krypto.geheim.'+A]:alt.geheim},[A,B]);
 assert.equal((await K.meinSchluessel(client(db),B)).geheim,alt.geheim);
});
test('App: fehlender Kontonachweis verändert den Altbestand nicht',async()=>{
 const alt=Krypto.schluesselpaarErzeugen(),speicher={'allmedia.krypto.geheim':alt.geheim};const {K}=app(speicher,[A]);
 assert.equal(await K.meinSchluessel(client(basis(),(t,art)=>t==='krypto_schluessel'&&art==='select'?new Error('offline'):null),A),null);
 assert.equal(speicher['allmedia.krypto.geheim'],alt.geheim);assert.equal(speicher['allmedia.krypto.geheim.'+A],undefined);
});
test('Browser: spät angemeldetes Altkonto erhält nur bestätigtes Altpaar',async()=>{
 const alt=Krypto.schluesselpaarErzeugen(),speicher={'allmedia.krypto.geheim':alt.geheim},konto={id:A};
 const ctx=browser(konto,(url,opt)=>{
  if(url.startsWith('/api/krypto/altbestand'))return antwort({kontoId:konto.id,id:konto.id==='neu'?null:'alt-'+konto.id,geraet:'alt-'+konto.id});
  if(url==='/api/krypto/schluessel')return antwort({id:JSON.parse(opt.body).geraet});
  throw new Error(url);
 },speicher);
 assert.equal((await ctx.KryptoWeb.anmelden()).geheim,alt.geheim);
 ctx.KryptoWeb.vergessen();konto.id=B;assert.equal((await ctx.KryptoWeb.anmelden()).geheim,alt.geheim);
 ctx.KryptoWeb.vergessen();konto.id='neu';assert.notEqual((await ctx.KryptoWeb.anmelden()).geheim,alt.geheim);
 assert.equal(speicher['allmedia.krypto.geheim'],alt.geheim);
});
test('Format2: Kopie, anderer Chat/Absender/Bezug/Zeit und Downgrade bleiben unlesbar',()=>{
 const a=Krypto.schluesselpaarErzeugen(),b=Krypto.schluesselpaarErzeugen();
 const kontext={id:'original',chatId:'chat',senderId:A,antwortAuf:'frage',zitatVon:null,zeit:'2026-11-15T20:00:00.000Z'};
 const p=Krypto.verschluesseln('Ja, mach das.',a.geheim,[{id:'b',oeffentlich:b.oeffentlich}],kontext);
 const kopf={version:p.version,chiffre:p.chiffre,nonce:p.nonce,absender:p.absender,kontext};
 assert.equal(p.version,2);assert.equal(Krypto.entschluesseln(kopf,p.kuverts[0],b.geheim),'Ja, mach das.');
 for(const [k,v] of Object.entries({id:'kopie',chatId:'fremd',senderId:B,antwortAuf:'andere-frage',zitatVon:'fremdes-zitat',zeit:'2026-11-16T20:00:00.000Z'}))
  assert.equal(Krypto.entschluesseln({...kopf,kontext:{...kontext,[k]:v}},p.kuverts[0],b.geheim),null,k);
 assert.equal(Krypto.entschluesseln({...kopf,kontext:undefined},p.kuverts[0],b.geheim),null);
 assert.equal(Krypto.entschluesseln({...kopf,version:1},p.kuverts[0],b.geheim),null);
 const neu=Krypto.umschliessen('Bearbeitet',kopf,p.kuverts[0],b.geheim);
 assert.ok(neu);assert.equal(Krypto.entschluesseln({...kopf,...neu},p.kuverts[0],b.geheim),'Bearbeitet');
 const beleg=Krypto.meldebeleg({...kopf,...neu},p.kuverts[0],b.geheim);
 assert.equal(beleg.text,'Bearbeitet');assert.equal(Krypto.belegPruefen(neu,beleg.sitzung,beleg.text),true);
});
test('App: Format2 senden, antworten, öffnen und bearbeiten mit echtem Kryptomodul',async()=>{
 const db=basis(),c=client(db),h=app(),Ak=h.aktionen();
 const n=await Ak.nachrichtSenden(c,A,'zwei','sensibel',{antwortAuf:'frage'});
 const row=db.messages.find(m=>m.id===n.id);assert.equal(row.krypto,2);assert.equal(row.text,'');
 const me=await h.K.meinSchluessel(c,A),[offen]=await h.K.aufschliessen(c,[{...row}],me,{absenderPruefen:true});
 assert.equal(offen.text,'sensibel');assert.equal(offen.nichtPruefbar,false);
 await Ak.nachrichtBearbeiten(c,A,n.id,'bearbeitet');
 const [neu]=await h.K.aufschliessen(c,[{...row}],me);assert.equal(neu.text,'bearbeitet');
 const [falsch]=await h.K.aufschliessen(c,[{...row,reply_to:'andereFrage'}],me);assert.equal(falsch.text,h.K.NICHT_LESBAR);
});
test('Browser → Server → App: Format2 Identität und Zeit bleiben unverändert',async()=>{
 const db=basis(),c=client(db),konto={id:A};
 const ctx=browser(konto,(url,opt)=>{
  if(url==='/api/krypto/schluessel')return antwort({id:'web-a'});
  if(url.startsWith('/api/krypto/empfaenger/'))return S.kryptoFakten(c,'zwei',A).then(antwort);
  throw new Error(url);
 });
 const paket=await ctx.KryptoWeb.verschliessen('zwei','Browsertext',{antwortAuf:'frage'});
 assert.equal(paket.krypto,2);
 const e=await S.handleSendMessage(c,A,'zwei','',{...paket,antwortAuf:'frage'});
 assert.equal(e.ok,true);assert.equal(e.nachricht.id,paket.nachrichtId);assert.equal(e.nachricht.krypto_gesendet_am,paket.gesendetAm);
 const b={id:'b',geheim:db.pb.geheim,oeffentlich:db.pb.oeffentlich};
 const [g]=await app().K.aufschliessen(c,[{...e.nachricht}],b);assert.equal(g.text,'Browsertext');
 const p={id:e.nachricht.id,chatId:'zwei',senderId:A,gesendetAm:paket.gesendetAm,antwortAufId:'frage',krypto:2,chiffre:paket.chiffre,kryptoNonce:paket.kryptoNonce,absenderSchluessel:paket.absenderSchluessel,kuvert:paket.kuverts.find(k=>k.schluesselId==='web-a')};
 // Own browser key is added even when the server list lacks the just registered device.
 assert.equal(ctx.KryptoWeb.oeffnen({...p}).text,'Browsertext');
 assert.equal(ctx.KryptoWeb.oeffnen({...p,id:'kopie'}).text,ctx.KryptoWeb.NICHT_LESBAR);
});
test('App: echte Format2-Quelle wird mit vollem Kontext geöffnet und neu weitergeleitet',async()=>{
 const db=basis(),base=client(db),h=app(),Ak=h.aktionen();
 const quelle=await Ak.nachrichtSenden(base,A,'zwei','Geheime Quelle',{antwortAuf:'frage'});
 // Supabase liefert nur ausdrücklich ausgewählte Felder; der allgemeine
 // Speicherclient allein hätte eine fehlende Kontextspalte verdeckt.
 const c={...base,from(t){const q=base.from(t),select=q.select,then=q.then;let spalten='';
  q.select=s=>{spalten=s;return select(s);};
  q.then=(res,rej)=>then.call(q,r=>{
    if(t==='messages'&&r.data&&!Array.isArray(r.data)&&spalten&&spalten!=='*')return res({...r,data:Object.fromEntries(spalten.split(',').map(s=>s.trim()).filter(Boolean).map(k=>[k,r.data[k]]))});
    return res(r);
  },rej);return q;
 }};
 assert.equal(await Ak.nachrichtWeiterleiten(c,A,quelle.id,['zwei']),1);
 const row=db.messages.at(-1);assert.notEqual(row.id,quelle.id);
 const [n]=await h.K.aufschliessen(base,[{...row}],await h.K.meinSchluessel(base,A));assert.equal(n.text,'Geheime Quelle');
});
test('Server: Senderzeit darf weder alte Nachrichten vortäuschen noch Serverzeit ersetzen',async()=>{
 const db=basis(),c=client(db),a=Krypto.schluesselpaarErzeugen();
 for(const zeit of ['2020-01-01T00:00:00Z','2099-01-01T00:00:00Z','kaputt']) {
  const p=Krypto.verschluesseln('falsch datiert',a.geheim,db.krypto_schluessel,{id:require('crypto').randomUUID(),chatId:'zwei',senderId:A,zeit:new Date().toISOString()});
  const e=await S.handleSendMessage(c,A,'zwei','',{nachrichtId:require('crypto').randomUUID(),gesendetAm:zeit,krypto:2,chiffre:p.chiffre,kryptoNonce:p.nonce,absenderSchluessel:p.absender,kuverts:p.kuverts});
  assert.equal(e.ok,false);assert.equal(db.messages.length,0);
 }
});
test('Eigener lokaler Fingerabdruck und getrennte Listen bleiben unabhängige Vergleichsreferenz',()=>{
 const a=Krypto.schluesselpaarErzeugen(),b=Krypto.schluesselpaarErzeugen(),x=Krypto.schluesselpaarErzeugen();
 const nr=Krypto.paarSicherheitsnummer(A,[a.oeffentlich],B,[b.oeffentlich,x.oeffentlich]);
 const text=Krypto.vergleichstext(nr,a.oeffentlich,[a.oeffentlich],[b.oeffentlich,x.oeffentlich]);
 assert.ok(text.includes('Lokaler Fingerabdruck dieses Geräts:\n'+Krypto.fingerabdruck(a.oeffentlich)));
 assert.ok(text.includes('Deine registrierten Geräteschlüssel (1)'));
 assert.ok(text.includes('Geräteschlüssel des Gegenübers (2)'));
 assert.ok(text.includes(Krypto.fingerabdruck(x.oeffentlich)));
 assert.ok(text.includes('beim bloßen Nummernvergleich nicht auf'));
 assert.throws(()=>Krypto.vergleichstext(nr,a.oeffentlich,[x.oeffentlich],[b.oeffentlich]),/lokale Gerät fehlt/);
});
test('Abweichende Empfangszeit öffnet Format2 nicht als unverändert geprüfte Nachricht',()=>{
 const db=basis(),zeit=new Date().toISOString(),kontext={id:'m',chatId:'zwei',senderId:A,zeit};
 const p=Krypto.verschluesseln('echt',db.pa.geheim,[{id:'b',oeffentlich:db.pb.oeffentlich}],kontext);
 const kopf={version:2,chiffre:p.chiffre,nonce:p.nonce,absender:p.absender,kontext:{...kontext,empfangenAm:zeit}};
 assert.equal(Krypto.entschluesseln(kopf,p.kuverts[0],db.pb.geheim),'echt');
 assert.equal(Krypto.entschluesseln({...kopf,kontext:{...kontext,empfangenAm:'2020-01-01T00:00:00Z'}},p.kuverts[0],db.pb.geheim),null);
});
test('App: Zeitconstraint wird zur Geräteuhr-Meldung, Entwurf kann erneut gesendet werden',async()=>{
 const db=basis(),c=client(db,(t,a)=>t==='messages'&&a==='insert'?{code:'23514',message:'new row violates check constraint "messages_krypto_stimmig"'}:null);
 await assert.rejects(app().aktionen().nachrichtSenden(c,A,'zwei','Uhr prüfen'),/Die Sendezeit stimmt nicht.*Geräteuhr/);
 assert.equal(db.messages.length,0);assert.equal(db.message_keys.length,0);
});
test('Server: Zeitconstraint verständlich, andere Datenbankfehler bleiben erkennbar',async()=>{
 const db=basis(),zeit=new Date().toISOString(),id=require('crypto').randomUUID();
 const p=Krypto.verschluesseln('Uhr prüfen',db.pa.geheim,db.krypto_schluessel,{id,chatId:'zwei',senderId:A,zeit});
 const paket={krypto:2,nachrichtId:id,gesendetAm:zeit,chiffre:p.chiffre,kryptoNonce:p.nonce,absenderSchluessel:p.absender,kuverts:p.kuverts};
 for(const e of [{code:'23514',message:'new row violates check constraint "messages_krypto_stimmig"'},{code:'42501',message:'Rechtesperre'},{code:'23514',message:'andere_pruefung'}]){
  const r=await S.handleSendMessage(client(db,(t,a)=>t==='messages'&&a==='insert'?e:null),A,'zwei','',paket);
  assert.equal(r.ok,false);assert.match(r.fehler,e.message.includes('messages_krypto_stimmig')?/Die Sendezeit stimmt nicht.*Geräteuhr/:new RegExp(e.message));
 }
 assert.equal(db.messages.length,0);
});
