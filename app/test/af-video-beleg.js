/** Ausschließlich lokale Byte-/Uploadprüfungen; erzeugte Videos ohne Cloud. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const V=require('../../web/server/videopruefung'),M=require('../../web/server/medien');
let n=0;async function test(name,f){await f();console.log(`OK ${++n} ${name}`);}
(async()=>{
 await test('Containerangabe allein reicht nicht',()=>assert.throws(()=>V.auswerten({streams:[{codec_type:'video',duration:'60'}]}),/zeitachse/));
 await test('Paketzeitachse entlarvt gelogene kurze Containerdauer',()=>assert.throws(()=>V.auswerten({format:{duration:'1'},streams:[{codec_type:'video'}],packets:[{pts_time:'0',duration_time:'1'},{pts_time:'1200',duration_time:'1'}]}),/20 Minuten/));
 await test('Kein Videostream abgewiesen',()=>assert.throws(()=>V.auswerten({streams:[{codec_type:'audio',duration:'60'}]}),/kein lesbares Video/));
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'af-video-test-'));let kurz,lang;
 try{
  for(const [name,dauer] of [['kurz',1200],['lang',1201]]){
   const p=path.join(temp,name+'.mp4');
   execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=black:s=16x16:r=1','-t',String(dauer),'-c:v','libx264','-preset','ultrafast',p],{timeout:30000});
   if(name==='kurz')kurz=await fs.readFile(p);else lang=await fs.readFile(p);
  }
  await test('Echte 20-Minuten-Datei lokal geprüft',async()=>assert.equal(await V.pruefen(kurz),1200));
  await test('Echte 20:01-Datei lokal abgewiesen',async()=>assert.rejects(V.pruefen(lang),/20 Minuten/));
  await test('Beschädigte Bytes abgewiesen',async()=>assert.rejects(V.pruefen(Buffer.from('kein Video'))));
  const alt=V.dienstclient;let uploads=0,belege=[],entfernt=0,belegFehler=false;
  V.dienstclient=()=>({from:t=>({insert:async b=>{assert.equal(t,'video_upload_belege');belege.push(b);return {error:belegFehler?Error('DB nicht bereit'):null};}})});
  const client={storage:{from:t=>({upload:async(p,b)=>{uploads++;assert.equal(t,'media');assert.deepEqual(b,kurz);return {data:{id:'objekt'}};},getPublicUrl:p=>({data:{publicUrl:'https://lokal/'+p}}),createSignedUrl:async()=>({data:{signedUrl:'lokal'}}),remove:async()=>{entfernt++;return {error:null};}})}};
  try{
   await test('Zulässige Bytes → Upload → gebundener SHA256-Beleg',async()=>{const r=await M.hochladenVideo(client,'konto','posts','video/mp4',kurz);assert.equal(r.sekunden,1200);assert.equal(uploads,1);assert.equal(belege.length,1);assert.equal(belege[0].objekt_id,'objekt');assert.match(belege[0].sha256,/^[a-f0-9]{64}$/);assert.equal(belege[0].bytes,kurz.length);});
   await test('Überlanges Video erreicht Speicher nicht',async()=>{const r=await M.hochladenVideo(client,'konto','posts','video/mp4',lang);assert.equal(r.ok,false);assert.match(r.error,/20 Minuten/);assert.equal(uploads,1);});
   await test('Datenadresse durchläuft dieselbe Byteprüfung',async()=>{const r=await M.hochladen(client,'konto','posts','data:video/mp4;base64,'+lang.toString('base64'));assert.equal(r.ok,false);assert.match(r.error,/20 Minuten/);assert.equal(uploads,1);});
   await test('Fehlender DB-Beleg: Datei entfernt, kein Upload-Erfolg',async()=>{belegFehler=true;const r=await M.hochladenVideo(client,'konto','posts','video/mp4',kurz);assert.equal(r.ok,false);assert.match(r.error,/bestätigt/);assert.equal(entfernt,1);});
  }finally{V.dienstclient=alt;}
  await test('Ohne Dienstschlüssel vor Upload geschlossen',async()=>{const key=process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;try{const r=await M.hochladenVideo(client,'konto','posts','video/mp4',kurz);assert.equal(r.ok,false);assert.match(r.error,/nicht verfügbar/);assert.equal(uploads,2);}finally{if(key)process.env.SUPABASE_SERVICE_ROLE_KEY=key;}});
 }finally{await fs.rm(temp,{recursive:true,force:true});}
 console.log(`${n}/${n} Prüfungen bestanden`);
})().catch(e=>{console.error(e);process.exitCode=1;});
