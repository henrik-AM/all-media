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
