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
  let v={id:'af-video',userId:'u-anna',description:'Lokales Prüfvideo',music:'',likes:8,comments:0,shares:0,liked:false,saved:false,reposted:false,notify:false,tags:[]};
  const daten=bestand({videos:[v]});
  await attrappe(page,daten,{
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
  await page.screenshot({path:path.join(dir,'af3-negativ.png')});
  await page.getByRole('button',{name:'Gefällt mir',exact:true}).click();
  await page.waitForSelector('[data-vaction="dislike"][aria-pressed="false"]');
  assert.equal(v.liked,true);assert.equal(v.disliked,false);
  assert.deepEqual(fehler,[]);
  console.log('AF3 Browser 4/4: Knopf, gesetzt, Like schließt aus, keine Seitenfehler');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
