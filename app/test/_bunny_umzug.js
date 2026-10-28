/** Offline: Dreierpilot, Fortsetzung, Altbeispiele und historische PTT-Bilder. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
test('Pilot begrenzt auf drei, Rest registriert nur fehlende Medien und behält SHA256',async()=>{
 const {umziehen}=await import('../../tools/medien-umzug-bunny.mjs');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'umzug-116-'));
 try{
  for(const o of ['posts','beispiel','ptt'])fs.mkdirSync(path.join(tmp,o));
  const bild=Buffer.from([255,216,255,1]);
  for(const p of ['posts/a.jpg','posts/b.jpg','posts/c.jpg','beispiel/d.jpg','ptt/e.jpg'])fs.writeFileSync(path.join(tmp,p),bild);
  const kopien=new Map(),registriert=[];
  const bunny={bereit:true,hochladen:async(p,b)=>{kopien.set(p,Buffer.from(b));return {ok:true};},auflisten:async v=>({ok:true,dateien:[...kopien].filter(([p])=>p.startsWith(v+'/')).map(([p,b])=>({name:p.split('/')[1],bytes:b.length}))})};
  const option={nurPfade:new Set(['posts/a.jpg','posts/b.jpg','posts/c.jpg','beispiel/d.jpg','ptt/e.jpg']),quelle:{art:'ordner',wurzel:tmp},bunny,ordner:['posts','beispiel','ptt'],ausfuehren:true,zustand:path.join(tmp,'journal'),pruefen:true,umschalten:async e=>{registriert.push(e);return {ok:true};},melde:()=>{}};
  const pilot=await umziehen({...option,maxDateien:3});assert.equal(pilot.hochgeladen,3);assert.equal(pilot.umgeschaltet,3);
  fs.writeFileSync(path.join(tmp,'posts/spaeter-hochgeladen.jpg'),bild);
  const rest=await umziehen(option);assert.equal(rest.schonFertig,3);assert.equal(rest.hochgeladen,2);assert.equal(rest.umgeschaltet,2);assert.equal(rest.umschaltAusgelassen,0);assert.equal(registriert.length,5);assert.equal(kopien.has('posts/spaeter-hochgeladen.jpg'),false);assert.ok(registriert.every(e=>/^[a-f0-9]{64}$/.test(e.sha256)));
  const erneut=await umziehen(option);assert.equal(erneut.hochgeladen,0);assert.equal(erneut.umgeschaltet,0);
  await assert.rejects(umziehen({...option,maxDateien:0}),/positive ganze Zahl/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('Historische M4A mit JPEG-Quellmetadaten wird bytegeprüft als Audio registriert',async()=>{
 const {umziehen}=await import('../../tools/medien-umzug-bunny.mjs');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'umzug-m4a-'));
 try{
  const bytes=Buffer.alloc(24);bytes.write('ftypM4A ',4,'latin1');let hochTyp,beleg;
  const bunny={bereit:true,hochladen:async(p,b,typ)=>{hochTyp=typ;assert.deepEqual(b,bytes);return {ok:true};},auflisten:async()=>({ok:true,dateien:[{name:'alt.m4a',bytes:24}]})};
  const abruf=async url=>url.endsWith('/list/media')?new Response(JSON.stringify([{id:'alt',name:'alt.m4a',metadata:{size:24,mimetype:'image/jpeg'}}])):new Response(bytes);
  const z=await umziehen({quelle:{art:'supabase',basis:'https://nur-lokal.invalid',schluessel:'attrappe'},bunny,ordner:['ptt'],ausfuehren:true,budgetBytes:1024,zustand:path.join(tmp,'journal'),pruefen:true,umschalten:async e=>{beleg=e;return {ok:true};},abruf,melde:()=>{}});
  assert.equal(hochTyp,'audio/mp4');assert.equal(beleg.typ,'audio/mp4');assert.equal(z.umgeschaltet,1);assert.equal(z.umschaltAusgelassen,0);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
