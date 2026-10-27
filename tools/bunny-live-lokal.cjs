/** Lokale Website-/App-Prüfung, nur eigenes Testkonto, kein Reset. */
const path=require('path'),fs=require('fs'),vm=require('vm');
const {createRequire}=require('module');
const root=path.resolve(__dirname,'..');
require('../app/test/_ki_belegung').pruefeBelegung();
const {TESTKONTO_PASS}=require('../app/test/_testpasswoerter');
const {supabase}=require('../web/server/supabase');
const ts=require('../app/node_modules/typescript');
const {chromium}=require('../app/node_modules/playwright-core');
const aus=path.join(root,'pruefbelege/bunny-live');
const {execFileSync}=require('child_process');
const jpeg=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=96x64','-frames:v','1','-f','image2pipe','-vcodec','mjpeg','pipe:1']);
const mp4=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=96x64:r=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1']);
async function main(){
 const {data,error}=await supabase.auth.signInWithPassword({email:'test@all-media.app',password:TESTKONTO_PASS});
 if(error)throw Error('Testkonto-Anmeldung fehlgeschlagen: '+error.code);
 const token=data.session.access_token;
 async function weg(url){
  if(!url)return null;const pfad=decodeURIComponent(new URL(url).pathname.split(/\/storage\/v1\/object\/(?:public|sign)\/media\//)[1]);if(!pfad)throw Error('Uploadpfad fehlt');
  const r=await fetch('http://127.0.0.1:3300/api/medien/loeschen',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({pfad})});
  const w=await r.json();const {data:rest,error}=await supabase.storage.from('media').list('posts',{search:pfad.split('/')[1]});
  return {ok:w.ok,verschwunden:!error&&rest.length===0};
 }
 const ergebnis={konto:'test@all-media.app',website:[],app:[]};
 for(const [typ,bytes] of [['image/jpeg',jpeg],['video/mp4',mp4]]){
  const istBild=typ.startsWith('image/');
  const r=await fetch('http://127.0.0.1:3300'+(istBild?'/api/hochladen':'/api/hochladen/video?ordner=posts'),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':istBild?'application/json':typ},body:istBild?JSON.stringify({ordner:'posts',aufnahme:`data:${typ};base64,${bytes.toString('base64')}`}):bytes,signal:AbortSignal.timeout(20000)});
  const wert=await r.json();ergebnis.website.push({typ,status:r.status,ok:wert.ok,error:wert.error,anbieter:wert.anzeige?(new URL(wert.anzeige).hostname.endsWith('.supabase.co')?'supabase':'bunny'):null,bereinigt:await weg(wert.url)});
 }
 // Echte TS-Funktionen ausführen, kein Simulator und keine nachgebaute Uploadfunktion.
 const cache=new Map();
 function lade(datei){datei=path.resolve(datei);if(cache.has(datei))return cache.get(datei).exports;
  const mod={exports:{}};cache.set(datei,mod);const req=createRequire(datei);
  const custom=p=>p.startsWith('./')?lade(path.resolve(path.dirname(datei),p+'.ts')):req(p);
  const js=ts.transpileModule(fs.readFileSync(datei,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInThisContext('(function(require,module,exports){'+js+'\n})',{filename:datei})(custom,mod,mod.exports);return mod.exports;
 }
 process.env.EXPO_PUBLIC_WEB_URL='http://127.0.0.1:3300';
 const upload=lade(path.join(root,'app/lib/supabaseStorage.ts'));
 for(const [name,bytes,typ] of [['probe.jpg',jpeg,'image/jpeg'],['probe.mp4',mp4,'video/mp4']]){
  const r=await upload.ladeHoch(supabase,`data:${typ};base64,${bytes.toString('base64')}`,'posts',name);ergebnis.app.push({name,success:r.success,error:r.error,anbieter:r.anzeige?(new URL(r.anzeige).hostname.endsWith('.supabase.co')?'supabase':'bunny'):null,bereinigt:await weg(r.url)});
 }
 if(process.env.BUNNY_LIVE_OHNE_BROWSER){console.log(JSON.stringify(ergebnis,null,2));return;}
 console.log(JSON.stringify({vorBrowser:ergebnis},null,2));
 const b=await chromium.launch({channel:'chromium-headless-shell'});
 try{
  const p=await b.newPage({viewport:{width:1200,height:900}});
  await p.goto('http://127.0.0.1:3300',{waitUntil:'load'});
  await p.waitForFunction(()=>Boolean(window.Anmeldung));
  const an=await p.evaluate(async pass=>window.Anmeldung.anmelden('test@all-media.app',pass),TESTKONTO_PASS);
  if(!an.ok)throw Error('Website-Anmeldung fehlgeschlagen');
  await p.reload({waitUntil:'load'});
  await p.waitForFunction(()=>typeof state!=='undefined'&&state.users?.me,{timeout:45000}).catch(()=>{});
  await p.locator('[data-area="videos"]').first().click({timeout:5000}).catch(()=>{});
  await p.waitForTimeout(2500);
  const foto=p.locator('.post').nth(1);if(await foto.count())await foto.scrollIntoViewIfNeeded();
  await p.waitForTimeout(1500);
  ergebnis.altmedien=await p.evaluate(()=>({bilder:[...document.images].filter(i=>i.src.includes('/storage/v1/')&&i.complete&&i.naturalWidth>0).length,hintergruende:[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).backgroundImage.includes('/storage/v1/')).length,beitraege:typeof state!=='undefined'?state.posts?.length||0:0}));
  await p.screenshot({path:path.join(aus,'C-altmedien.png'),fullPage:true});
  ergebnis.bild='pruefbelege/bunny-live/C-altmedien.png';
 }finally{await b.close();}
 console.log(JSON.stringify(ergebnis,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
