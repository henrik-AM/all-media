/*
 * B5 (App), auf main-Stand (Paket 9): Uploads laufen über lib/beitragSpeichern.
 * Abgelehnter Beitrag → nur die NEU hochgeladenen Dateien werden entfernt,
 * Bestandsmedien bleiben; ein zu langes Video wird vor dem Upload abgewiesen.
 */
const assert=require('node:assert/strict'),{modul}=require('./_af_fix_ui');
function speicher({db='fehler'}={}){const weg=[];let uploads=0;
 const ex=modul('app/lib/beitragSpeichern.ts',name=>{
  if(name.endsWith('/supabaseStorage'))return {ladeHoch:async()=>{uploads++;return {success:true,url:'https://lokal/storage/v1/object/public/media/posts/neu.mp4'};},
   ladeMedienlisteHoch:async(_c,_u,l)=>{uploads++;return l.map(m=>m.url.startsWith('https:')?m:{...m,url:'https://lokal/storage/v1/object/public/media/posts/neu.jpg'});},
   loesche:async(_c,p)=>{weg.push(p);return {success:true};}};
  if(name.endsWith('/aktionen'))return {beitragAnlegen:async()=>{if(db==='fehler')throw Error('DB abgelehnt');return 'echt';}};
  if(name.startsWith('../../gemeinsam/'))return require(name);throw Error(name);
 });return {f:ex.beitragSpeichern,weg,get uploads(){return uploads;}};}
(async()=>{
 let p=speicher();await assert.rejects(p.f({}, 'a', {art:'reel',beschreibung:'Probe',mediaUrl:'file:///neu.mp4',sekunden:10}),/DB abgelehnt/);
 assert.deepEqual(p.weg,['posts/neu.mp4']);console.log('OK 1 App entfernt neuen Video-Upload nach abgelehntem Beitrag');
 p=speicher();await assert.rejects(p.f({}, 'a', {art:'post',beschreibung:'Probe',medien:[{url:'file:///neu.jpg',typ:'image'},{url:'https://lokal/bestand.jpg',typ:'image'}]}));
 assert.deepEqual(p.weg,['posts/neu.jpg']);console.log('OK 2 App entfernt nur neue Karussellmedien, bewahrt bereits bestehende');
 p=speicher();await assert.rejects(p.f({}, 'a', {art:'reel',beschreibung:'Probe',mediaUrl:'file:///neu.mp4',sekunden:1201}),/20 Minuten/);
 assert.equal(p.uploads,0);console.log('OK 3 App weist zu langes Video vor dem Upload ab');
 p=speicher({db:'ok'});const r=await p.f({}, 'a', {art:'reel',beschreibung:'Probe',mediaUrl:'file:///neu.mp4',sekunden:1200});
 assert.equal(r.id,'echt');assert.deepEqual(p.weg,[]);console.log('OK 4 20:00 wird veröffentlicht, nichts gelöscht');
 console.log('4/4 Prüfungen bestanden');
})().catch(e=>{console.error(e);process.exitCode=1;});
