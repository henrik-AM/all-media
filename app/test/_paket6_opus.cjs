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
