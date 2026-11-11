const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const root = process.env.AM_PAKET6_QUELLE || path.resolve(__dirname, '../..');
require(path.join(root,'app/test/_offline_sperre.cjs'));
const {client,app,basis,A,B,Krypto}=require(path.join(root,'app/test/_paket6_hilfe.cjs'));
function bestand(){
 const db=basis();
 db.messages.push({id:'quelle',text:'Weiterleitung',sender_id:B,krypto:0});
 db.chats.push({id:'zweites',is_group:false,bereich:'messenger'});
 db.chat_members.push({chat_id:'zweites',user_id:A},{chat_id:'zweites',user_id:B});
 return db;
}
test('Später nicht lesbares Ziel: kein vorheriger Nachrichten-/Kuvertschreibvorgang',async()=>{
 const db=bestand();
 await assert.rejects(app().aktionen().nachrichtWeiterleiten(client(db),A,'quelle',['zwei','unbekannt']));
 assert.equal(db.messages.length,1);
 assert.equal(db.message_keys.length,0);
});
test('Späterer Zweierchat mit drittem Mitglied: kein Teilversand',async()=>{
 const db=bestand();db.chat_members.push({chat_id:'zweites',user_id:'dritter'});
 await assert.rejects(app().aktionen().nachrichtWeiterleiten(client(db),A,'quelle',['zwei','zweites']));
 assert.equal(db.messages.length,1);
 assert.equal(db.message_keys.length,0);
});
test('Zwei gültige Ziele: getrennte Chiffren, jedes Ziel mit passendem lesbarem Kuvert',async()=>{
 const db=bestand();
 assert.equal(await app().aktionen().nachrichtWeiterleiten(client(db),A,'quelle',['zwei','zweites']),2);
 const neu=db.messages.filter(m=>m.id!=='quelle');
 assert.equal(neu.length,2);assert.notEqual(neu[0].chiffre,neu[1].chiffre);
 for(const n of neu){
  assert.equal(n.text,'');assert.equal(n.krypto,1);
  const kuvert=db.message_keys.find(k=>k.message_id===n.id&&k.schluessel_id==='b');
  assert.ok(kuvert);
  assert.equal(Krypto.entschluesseln({version:n.krypto,chiffre:n.chiffre,nonce:n.krypto_nonce,absender:n.absender_schluessel},kuvert,db.pb.geheim),'Weiterleitung');
 }
});
