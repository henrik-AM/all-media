/** Ausschließlich lokal: der echte Medienadapter, Nutzer- und Dienstspeicher getrennt. */
const assert=require('node:assert/strict'),{laden}=require('./_af_fix_quelle');
const M=laden('web/server/medien.js'),V=require('../../web/server/videopruefung');
let n=0;async function test(name,f){await f();console.log(`OK ${++n} ${name}`);}
(async()=>{delete process.env.MEDIEN_ANBIETER;delete process.env.BUNNY_BESTAND_LESEN;
 const alt=V.dienstclient;let dienstLoeschungen=0,nutzerLoeschungen=0,frei=false;
 const client={rpc:async(name)=>{assert.equal(name,'medium_loeschrecht');return {data:frei?'supabase':null};},storage:{from:()=>({remove:async()=>{nutzerLoeschungen++;return {error:null};}})}};
 V.dienstclient=()=>({storage:{from:()=>({remove:async()=>{dienstLoeschungen++;return {error:null};}})}});
 try{
 await test('Referenziertes Video wird auch ohne Bunny-Schalter nicht gelöscht',async()=>{assert.equal((await M.loeschen(client,'a','posts/a-video.mp4')).ok,false);assert.equal(nutzerLoeschungen+dienstLoeschungen,0);});
 await test('Eigener unreferenzierter Post-Upload wird ausschließlich vom Dienst entfernt',async()=>{frei=true;assert.equal((await M.loeschen(client,'a','posts/a-video.mp4')).ok,true);assert.equal(dienstLoeschungen,1);assert.equal(nutzerLoeschungen,0);});
 await test('Fehler der Besitzprüfung bleibt geschlossen',async()=>{client.rpc=async()=>({error:Error('DB')});assert.equal((await M.loeschen(client,'a','posts/a-bild.jpg')).ok,false);assert.equal(dienstLoeschungen,1);});
 }finally{V.dienstclient=alt;}
 console.log(`${n}/${n} Prüfungen bestanden`);
})().catch(e=>{console.error(e);process.exitCode=1;});
