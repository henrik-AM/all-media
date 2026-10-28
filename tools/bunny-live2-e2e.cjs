/** Website-Formular und App-Uploadweg, echte Prüfbeiträge mit vollständiger Bereinigung. */
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),assert=require('assert/strict');
const {createRequire}=require('module'),{execFileSync}=require('child_process');
require('../app/test/_ki_belegung').pruefeBelegung();
const {TESTKONTO_PASS}=require('../app/test/_testpasswoerter');
const {supabase}=require('../web/server/supabase');
const Bunny=require('../web/server/bunny');
const {chromium}=require('../app/node_modules/playwright-core');
const ts=require('../app/node_modules/typescript');
const aus=path.resolve('pruefbelege/bunny-live2');fs.mkdirSync(aus,{recursive:true});
const prefix='Bunny-Runde2-'+Date.now();
const jpg=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=320x240','-frames:v','1','-f','image2pipe','-vcodec','mjpeg','pipe:1']);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bunny2-'));
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=320x240:r=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(tmp,'probe.mp4')]);
const mp4=fs.readFileSync(path.join(tmp,'probe.mp4'));
let token,client,uid,browser;
const angelegt=new Set(),pfade=new Set(),ergebnis=[];
let pruefungen=0;
const appIds=new Set();let appAktionen;
// Nur die unveränderten Produktfunktionen übersetzen, ohne native Kryptospeicher zu laden.
function aktionenLaden(medien){
 const quelle=fs.readFileSync('app/lib/aktionen.ts','utf8');
 const ast=ts.createSourceFile('aktionen.ts',quelle,ts.ScriptTarget.Latest,true);
 const namen=['beitragAnlegen','beitragLoeschen'];
 const funktionen=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&namen.includes(n.name?.text));
 assert.equal(funktionen.length,2);
 const js=ts.transpileModule(funktionen.map(n=>n.getText(ast)).join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const m={exports:{}};vm.runInThisContext('(function(module,exports,medienAnfrage){'+js+'\n})')(m,m.exports,medien.medienAnfrage);return m.exports;
}
const check=(name,wert)=>{assert.ok(wert,name);pruefungen++;console.log('PASS '+name);};
const pfad=url=>url.split('/storage/v1/object/public/media/')[1];
async function api(route,body){const r=await fetch('http://127.0.0.1:3300'+route,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json();}
async function bestaetige(id,weg){
 angelegt.add(id);
 const {data:post,error}=await client.from('posts').select('media_url').eq('id',id).single();assert.ifError(error);
 const p=pfad(post.media_url);pfade.add(p);check(weg+' dauerhafte Referenz',!!p);
 const sig=await api('/api/medien/unterschreiben',{pfade:[p]});assert.equal(sig.ok,true);
 const z=sig.dateien[0];check(weg+' Bunny signiert',new URL(z.url).hostname===new URL(Bunny.konfigurationAus().auslieferung).hostname);
 check(weg+' Ablauf maximal eine Stunde',z.ablauf-Date.now()<=3600000 && z.ablauf>Date.now());
 const r=await fetch(z.url,{headers:p.endsWith('.mp4')?{Range:'bytes=0-31'}:{}});
 check(weg+' Anzeige HTTP '+r.status,r.status===(p.endsWith('.mp4')?206:200));await r.arrayBuffer();
 ergebnis.push({weg,id,pfad:p,status:r.status,signaturSekunden:Math.ceil((z.ablauf-Date.now())/1000)});
 return z.url;
}
async function cleanup(){
 for(const id of angelegt){
  if(appIds.has(id))check('App beitragLoeschen erfolgreich',await appAktionen.beitragLoeschen(client,uid,id));
  else {const w=await api(`/api/eigene/${id}/loeschen`,{});check('Website Löschroute erfolgreich',w.ok);}
 }
 for(const p of pfade){
  const {data,error}=await client.rpc('medium_loeschrecht',{p_pfad:p});assert.ifError(error);check('Medienbeleg nach Löschung weg',data===null);
  const liste=await Bunny.erstelleBunny(Bunny.konfigurationAus()).auflisten('posts');check('Datei weg '+p.split('/').pop(),liste.ok&&!liste.dateien.some(z=>z.name===p.split('/')[1]));
 }
 const {data,error}=await client.from('posts').select('id').eq('user_id',uid).like('description',prefix+'%');assert.ifError(error);check('Testbeiträge nachher 0',data.length===0);
}
(async()=>{
 const login=await supabase.auth.signInWithPassword({email:'test@all-media.app',password:TESTKONTO_PASS});assert.ifError(login.error);
 token=login.data.session.access_token;uid=login.data.user.id;client=supabase;
 const {data:vor}=await client.from('posts').select('id').eq('user_id',uid).like('description',prefix+'%');check('Testbeiträge vorher 0',vor.length===0);
 browser=await chromium.launch({channel:'chromium-headless-shell'});
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 try{
  await page.goto('http://127.0.0.1:3300',{waitUntil:'load'});await page.waitForFunction(()=>!!window.Anmeldung);
  const an=await page.evaluate(pass=>window.Anmeldung.anmelden('test@all-media.app',pass),TESTKONTO_PASS);assert.equal(an.ok,true);
  await page.reload({waitUntil:'load'});await page.waitForSelector('[data-area]',{timeout:45000});await page.evaluate(()=>{state.area='videos';state.sub.videos='home';render();});await page.waitForSelector('.post',{timeout:45000});
  for(const [art,bytes,mime] of [['post',jpg,'image/jpeg'],['reels',mp4,'video/mp4']]){
   const chooser=page.waitForEvent('filechooser');await page.evaluate(art=>{void erstelle(art);},art);
   await (await chooser).setFiles({name:art==='post'?'probe.jpg':'probe.mp4',mimeType:mime,buffer:bytes});
   await page.locator('#f_beschreibung').fill(prefix+'-Website-'+art,{timeout:20000});
   const antwort=page.waitForResponse(r=>r.url().includes(art==='post'?'/api/eigene/beitrag':'/api/eigene/video')&&r.request().method()==='POST');
   await page.locator('#formOk').click();const wert=await (await antwort).json();check('Website Formular '+art,wert.ok);
   const id=(wert.beitrag||wert.video||wert.clip).id;
   await bestaetige(id,'Website-'+art);
   await page.waitForTimeout(800);await page.reload({waitUntil:'load'});
   await page.waitForSelector('[data-area]',{timeout:45000});await page.evaluate(()=>{state.area='videos';state.sub.videos='home';render();});await page.waitForSelector('.post',{timeout:45000});
   if(art==='post'){
    await page.locator(`#post-${id}`).scrollIntoViewIfNeeded();
   } else {
    await page.evaluate(()=>{state.sub.videos='portrait';render();});
    await page.locator(`#slide-${id}`).scrollIntoViewIfNeeded();
    await page.waitForFunction(id=>document.querySelector(`#slide-${id} video`)?.videoWidth>0,id);
    check('Website Videoplayer decodiert echte MP4',true);
   }
   await page.waitForTimeout(1000);
   await page.screenshot({path:path.join(aus,`Website-${art}.png`),fullPage:false});
  }
  const cache=new Map();
  function lade(datei){datei=path.resolve(datei);if(cache.has(datei))return cache.get(datei).exports;const m={exports:{}};cache.set(datei,m);const req=createRequire(datei);const js=ts.transpileModule(fs.readFileSync(datei,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext('(function(require,module,exports){'+js+'\n})',{filename:datei})(p=>p.startsWith('./')?lade(path.resolve(path.dirname(datei),p+'.ts')):req(p),m,m.exports);return m.exports;}
  process.env.EXPO_PUBLIC_WEB_URL='http://127.0.0.1:3300';const upload=lade('app/lib/supabaseStorage.ts');
  appAktionen=aktionenLaden(lade('app/lib/medien.ts'));
  for(const [name,bytes,typ] of [['bild.jpg',jpg,'image/jpeg'],['video.mp4',mp4,'video/mp4']]){
   const hoch=await upload.ladeHoch(client,`data:${typ};base64,${bytes.toString('base64')}`,'posts',name);check('App Upload '+name,hoch.success);pfade.add(pfad(hoch.url));
   const data={id:await appAktionen.beitragAnlegen(client,uid,{art:typ.startsWith('video/')?'reel':'post',mediaUrl:hoch.url,beschreibung:prefix+'-App-'+name})};appIds.add(data.id);check('App beitragAnlegen '+name,!!data.id);
   await bestaetige(data.id,'App-'+name);
   await page.reload({waitUntil:'load'});await page.waitForSelector('[data-area]',{timeout:45000});
   await page.evaluate(video=>{state.area='videos';state.sub.videos=video?'portrait':'home';render();},typ.startsWith('video/'));
   await page.locator(`#${typ.startsWith('video/')?'slide':'post'}-${data.id}`).scrollIntoViewIfNeeded();
   if(typ.startsWith('video/'))await page.waitForFunction(id=>document.querySelector(`#slide-${id} video`)?.videoWidth>0,data.id);
   await page.waitForTimeout(700);
   await page.screenshot({path:path.join(aus,`App-${name}.png`),fullPage:false});
  }
  await page.reload({waitUntil:'load'});await page.waitForSelector('[data-area]',{timeout:45000});await page.evaluate(()=>{state.area='videos';state.sub.videos='home';render();});await page.waitForSelector('.post',{timeout:45000});
  await page.waitForTimeout(1500);
  const alt=await page.evaluate(()=>({bilder:[...document.images].filter(i=>i.src.includes('.supabase.co/storage/v1/')&&i.complete&&i.naturalWidth>0).length,hintergruende:[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).backgroundImage.includes('.supabase.co/storage/v1/')).length}));
  console.log('Mischbetrieb '+JSON.stringify(alt));check('Alte Supabase-Medien eingebunden',alt.bilder+alt.hintergruende>0);
  await page.screenshot({path:path.join(aus,'Mischbetrieb.png'),fullPage:false});
  console.log(JSON.stringify(ergebnis,null,2));
 }finally{await cleanup();console.log(`${pruefungen}/${pruefungen} Prüfungen bestanden`);}
})().catch(e=>{console.error('FEHL '+e.message);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();fs.rmSync(tmp,{recursive:true,force:true});});
