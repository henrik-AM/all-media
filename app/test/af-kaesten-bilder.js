/* Nur lokale Prüfattrappe, keine Cloud-Anmeldung und keine Cloud-Medien. */
const {chromium}=require('playwright-core');
const {attrappe,bestand}=require('./_attrappe');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:430,height:932}});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
  const R=require('../../gemeinsam/rang');
  let v={id:'af-video',userId:'u-anna',description:'Lokales Prüfvideo',music:'',likes:8,comments:0,shares:0,liked:false,saved:false,reposted:false,notify:false,tags:[],mediaUrl:'http://localhost:3300/af-pruefvideo.mp4'};
  const daten=bestand({videos:[v]});
  let analyseAufrufe=0;
  const analyseFenster=tage=>({tage,reichweite:20,aufrufe:40,followerAufrufe:15,nichtFollowerAufrufe:25,sichtzeitMs:120000,interaktionen:3,laender:[{land:'Deutschland',ab:10}],beitraege:[{titel:'Lokales Prüfvideo',aufrufe:40,reichweite:20}]});
  await attrappe(page,daten,{
   '/api/kontoanalysen':()=>{analyseAufrufe++;return {seit:'2026-10-26T00:00:00Z',zeitraeume:[analyseFenster(7),analyseFenster(30)]};},
   '/api/statistik':{statistik:{beitraege:0}},
   '/api/gelikt':[], '/api/kommentiert':[],
   '/api/einstellungen':{einstellungen:{}},
   '/api/videos/af-video/dislike':()=>{v=R.reaktion(v,'dislike');return v;},
   '/api/videos/af-video/like':()=>{v=R.reaktion(v,'like');return v;},
  });
  const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
  await page.goto('http://localhost:3300/');
  await page.locator('[data-area="videos"]').click();
  await page.locator('[data-sub="portrait"]').click();
  await page.getByRole('button',{name:'Gefällt mir nicht',exact:true}).click();
  await page.waitForSelector('[data-vaction="dislike"][aria-pressed="true"]');
  assert.equal(v.disliked,true);
  const dir=path.join(__dirname,'ergebnisse-af');fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({animations:'disabled',path:path.join(dir,'af3-negativ.png')});
  await page.getByRole('button',{name:'Gefällt mir',exact:true}).click();
  await page.waitForSelector('[data-vaction="dislike"][aria-pressed="false"]');
  assert.equal(v.liked,true);assert.equal(v.disliked,false);
  await page.evaluate(()=>{
    const video=document.querySelector('.slide__stage video');
    Object.defineProperty(video,'duration',{configurable:true,value:1200});
    video.dispatchEvent(new Event('loadedmetadata'));
    const feld=document.querySelector('[data-reelposition]');feld.value='500';feld.dispatchEvent(new Event('input'));
  });
  assert.equal(await page.locator('.slide__stage video').evaluate(v=>v.currentTime),600);
  assert.equal(await page.locator('[data-reelzeit]').textContent(),'10:00 / 20:00');
  await page.screenshot({animations:'disabled',path:path.join(dir,'af5-sprungleiste.png')});
  console.log('AF5 Browser 2/2: Sprung 600 Sekunden, Zeitanzeige 10:00 / 20:00 (Metadatenattrappe)');
  await page.locator('[data-area="settings"]').click();
  await page.locator('[data-setting="Konto-Analysen"]').click();
  await page.getByText('Reichweite · erreichte Konten',{exact:true}).first().waitFor();
  assert.equal(analyseAufrufe,1);
  assert.equal(await page.getByText('10–19 Konten',{exact:true}).count(),2);
  await page.locator('.sheet').waitFor();
  await page.screenshot({animations:'disabled',path:path.join(dir,'af7-kontoanalysen.png')});
  console.log('AF7 Browser 3/3: eigener Menüweg, beide Zeiträume/Länderband, eine Abfrage');
  assert.deepEqual(fehler,[]);
  console.log('AF3 Browser 4/4: Knopf, gesetzt, Like schließt aus, keine Seitenfehler');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
