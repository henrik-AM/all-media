/** Rechteprüfung und unveränderter Rückweg ohne Netz. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../web/server/medien'),B=require('../web/server/bunny');
const variablen=Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith('BUNNY_')));
const leeren=()=>{for(const k of Object.keys(process.env))if(k.startsWith('BUNNY_'))delete process.env[k];};
const basis='https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/';
async function main(){
 await test('Ohne Bunny unveränderter Supabase-Upload und zwei Adressen',async()=>{
  leeren();let anzahl=0;
  const c={storage:{from:()=>({upload:async(p,bytes,o)=>{anzahl++;assert.equal(o.contentType,'image/jpeg');assert.equal(bytes.length,4);return {};},getPublicUrl:p=>({data:{publicUrl:basis+p}}),createSignedUrl:async()=>({data:{signedUrl:'https://alt/signiert'}})})}};
  const r=await M.hochladenDatei(c,'eigentum','posts','image/jpeg',Buffer.from([255,216,255,1]));assert.equal(r.ok,true);assert.equal(anzahl,1);assert.ok(r.url.startsWith(basis));assert.equal(r.anzeige,'https://alt/signiert');
 });
 await test('Signier-Endpunkt prüft Supabase-Rechte pro Konto auch nach Cachefüllung',async()=>{
  leeren();const pfad='posts/cache-grenze.jpg';
  const a={storage:{from:()=>({createSignedUrls:async()=>({data:[{path:pfad,signedUrl:'https://alt/nur-a'}]})})}};
  await M.signiereMedien(a,[basis+pfad]);
  let gefragt=0;const b={storage:{from:()=>({createSignedUrls:async()=>{gefragt++;return {data:[{path:pfad,error:'verboten'}]};}})}};
  const r=await M.unterschreiben(b,[pfad]);assert.equal(gefragt,1);assert.equal(r.dateien[0].url,null);
 });
 await test('Teilkonfiguration schaltet ein und fällt nicht still zurück',async()=>{
  process.env.BUNNY_STORAGE_ZONE='probe';assert.equal(M.mitBunny(),true);let storage=false;
  const r=await M.hochladenDatei({rpc:async()=>({error:{code:'PGRST202'}}),storage:{from:()=>{storage=true;throw Error('verboten');}}},'nutzer','posts','image/jpeg',Buffer.from([255,216,255,1]));
  assert.equal(r.ok,false);assert.match(r.error,/nicht freigeschaltet/);assert.equal(storage,false);
 });
 await test('Fehlende Leseliste lässt nur Supabase selbst unter RLS signieren',async()=>{
  let pfade;const r=await M.signiereMedien({rpc:async()=>({error:{code:'PGRST202'}}),storage:{from:()=>({createSignedUrls:async p=>{pfade=p;return {data:[{path:p[0],signedUrl:'https://alt/erlaubt'}]};}})}},[basis+'posts/alt.jpg']);assert.deepEqual(pfade,['posts/alt.jpg']);assert.deepEqual(r,['https://alt/erlaubt']);
 });
 await test('Andere Rechtefehler erzeugen weder Bunny- noch Supabase-Signaturen',async()=>{
  const daten=[basis+'posts/privat.jpg'];const r=await M.signiereMedien({rpc:async()=>({error:{code:'42501'}}),storage:{from:()=>{throw Error('verboten');}}},daten);assert.deepEqual(r,daten);
 });
 await test('Verweigertes Uploadrecht erreicht Bunny nicht',async()=>{
  const alt=B.ablegen;let aufrufe=0;B.ablegen=()=>{aufrufe++;throw Error('verboten');};
  try{assert.equal((await M.hochladenDatei({rpc:async()=>({data:false})},'nutzer','posts','image/jpeg',Buffer.alloc(4))).ok,false);assert.equal(aufrufe,0);}finally{B.ablegen=alt;}
 });
 await test('Bunny-Leserecht wird für jeden Aufruf neu geprüft',async()=>{
  let erlaubt=true,aufrufe=0;const alt=B.signierteAdresse;B.signierteAdresse=()=>{aufrufe++;return 'https://bunny/signiert';};
  const c={rpc:async()=>({data:erlaubt?[{pfad:'posts/a.jpg',anbieter:'bunny'}]:[]})};
  try{assert.equal((await M.signiereMedien(c,[basis+'posts/a.jpg']))[0],'https://bunny/signiert');erlaubt=false;assert.equal((await M.signiereMedien(c,[basis+'posts/a.jpg']))[0],basis+'posts/a.jpg');assert.equal(aufrufe,1);}finally{B.signierteAdresse=alt;}
 });
 await test('Löschrecht verweigert: kein Bunny-Aufruf',async()=>{
  const alt=B.loeschen;let aufrufe=0;B.loeschen=()=>{aufrufe++;};try{assert.equal((await M.loeschen({rpc:async()=>({data:null})},'n','posts/a.jpg')).ok,false);assert.equal(aufrufe,0);}finally{B.loeschen=alt;}
 });
 await test('Nicht angemeldet und ungültige Medienliste werden abgewiesen',async()=>{
  assert.equal((await M.hochladenDatei(null,null,'posts','image/jpeg',Buffer.alloc(4))).ok,false);
  assert.equal((await M.unterschreiben({},Array(501).fill('posts/a.jpg'))).ok,false);
 });
 await test('Präfix _probe bleibt ausschließlich im Adapter, kein Nutzer-Uploadordner',async()=>{
  assert.ok(B.pfadPruefen('_probe/a.jpg',B.ORDNER_LESEN));assert.equal((await M.hochladenDatei({},'n','_probe','image/jpeg',Buffer.alloc(4))).ok,false);
 });
}
main().finally(()=>{leeren();Object.assign(process.env,variablen);});
