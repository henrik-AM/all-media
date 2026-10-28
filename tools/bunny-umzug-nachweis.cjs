/** Produktions-Signierweg: Testkonto, keine Rücksetzung und keine echten Konten. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {testumgebung}=require('./bunny-umzug-helfer.cjs');
require('../app/test/_ki_belegung').pruefeBelegung();testumgebung();
const {supabase}=require('../web/server/supabase');
const root=path.resolve(__dirname,'../../bunny-umzug-zustand');
const aus=path.resolve('pruefbelege/bunny-umzug');
const web='https://all-media-website.onrender.com';
(async()=>{
 const {data,error}=await supabase.auth.signInWithPassword({email:'test@all-media.app',password:process.env.AM_TESTKONTO_PASS});assert.ifError(error);
 const token=data.session.access_token;
 const modus=process.argv[2];
 const journal=fs.readFileSync(path.join(root,'zustand.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(e=>e.sha256);
 let sample;
 if(modus==='pilot')sample=[journal[0]];
 else {const bilder=journal.filter(e=>e.pfad.startsWith('beispiel/')&&e.typ.startsWith('image/'));const videos=journal.filter(e=>e.pfad.startsWith('beispiel/')&&e.typ==='video/mp4');sample=[...bilder.slice(0,5),...videos.slice(0,5)];assert.equal(sample.length,10);}
 const r=await fetch(web+'/api/medien/unterschreiben',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({pfade:sample.map(e=>e.pfad)}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const wert=await r.json();assert.equal(wert.ok,true);
 const ergebnisse=[];
 for(const e of sample){const url=wert.dateien.find(d=>d.pfad===e.pfad)?.url;assert.ok(url,'Signatur fehlt '+e.pfad);assert.equal(new URL(url).hostname,process.env.BUNNY_PULL_HOST.replace(/^https?:\/\//,'').replace(/\/$/,''));const a=await fetch(url,{signal:AbortSignal.timeout(60000)});assert.equal(a.status,200);const bytes=Buffer.from(await a.arrayBuffer());const hash=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(hash,e.sha256);assert.equal(bytes.length,e.bytes);ergebnisse.push({pfad:e.pfad,typ:e.typ,host:new URL(url).hostname,status:a.status,bytes:bytes.length,sha256:hash});console.log('PASS Produktion Bunny 200 SHA256 '+e.pfad);}
 fs.writeFileSync(path.join(aus,'05-'+modus+'-produktion.json'),JSON.stringify(ergebnisse,null,2)+'\n');
 console.log(`${ergebnisse.length}/${sample.length} Produktionsmedien: Bunny, 200, SHA256 identisch`);
 if(modus==='pilot')return;
 const {chromium}=require('../app/node_modules/playwright-core');const browser=await chromium.launch({channel:'chromium-headless-shell'});
 try{const page=await browser.newPage({viewport:{width:1200,height:900}});await page.goto(web,{waitUntil:'load'});await page.waitForFunction(()=>!!window.Anmeldung);
 const login=await page.evaluate(pass=>window.Anmeldung.anmelden('test@all-media.app',pass),process.env.AM_TESTKONTO_PASS);assert.equal(login.ok,true);await page.reload({waitUntil:'load'});await page.waitForSelector('[data-area]',{timeout:60000});
 await page.evaluate(()=>{state.area='videos';state.sub.videos='home';render();});await page.waitForSelector('.post',{timeout:60000});
 await page.waitForFunction(()=>[...document.images].some(i=>i.src.includes('allmedia-cdn.b-cdn.net')&&i.complete&&i.naturalWidth>0),{timeout:60000});
 await page.locator('.post').nth(1).scrollIntoViewIfNeeded();await page.waitForTimeout(1200);
 const sichtbar=await page.evaluate(()=>({beitraege:document.querySelectorAll('.post').length,bunnyBilder:[...document.images].filter(i=>i.src.includes('allmedia-cdn.b-cdn.net')&&i.complete&&i.naturalWidth>0).length,bunnyHintergruende:[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).backgroundImage.includes('allmedia-cdn.b-cdn.net')).length}));assert.ok(sichtbar.bunnyBilder>0);fs.writeFileSync(path.join(aus,'07-website.json'),JSON.stringify(sichtbar,null,2)+'\n');
 await page.screenshot({path:path.join(aus,'07-altbeitraege-produktion.png'),fullPage:false});console.log('PASS Produktionswebsite '+JSON.stringify(sichtbar));
 }finally{await browser.close();}
})().catch(e=>{console.error('FEHL '+e.message);process.exitCode=1;});
