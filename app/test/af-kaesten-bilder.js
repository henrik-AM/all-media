/* Nur lokale Prüfattrappe, keine Cloud-Anmeldung und keine Cloud-Medien. */
const {chromium}=require('playwright-core');
const {attrappe,bestand}=require('./_attrappe');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try {
  const page=await browser.newPage({viewport:{width:430,height:932}});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://localhost:3300'?route.continue():route.abort());
  await page.context().grantPermissions(['camera'],{origin:'http://localhost:3300'});
  const R=require('../../gemeinsam/rang');
  let v={id:'af-video',userId:'u-anna',description:'Lokales Prüfvideo',music:'',likes:8,comments:0,shares:0,liked:false,saved:false,reposted:false,notify:false,tags:[],mediaUrl:'http://localhost:3300/af-pruefvideo.mp4'};
  const daten=bestand({videos:[v]});
  let analyseAufrufe=0,freundListe=[],gesehen=0,sendungen=0,aufnahmeBytes=0,zurueck=0,listenAufrufe=0,viele=false;
  const anna={id:'u-anna',name:'Anna Schmidt',handle:'anna'};
  const pixel='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'_testbild.png')).toString('base64');
  const instant={id:'i-empfang',absender:'u-anna',name:'Anna Schmidt',text:'Lokales Kamera-Instant',expires_at:'2099-01-01T00:00:00Z'};
  const analyseFenster=tage=>({tage,reichweite:20,aufrufe:40,followerAufrufe:15,nichtFollowerAufrufe:25,sichtzeitMs:120000,interaktionen:3,laender:[{land:'Deutschland',ab:10}],beitraege:[{titel:'Lokales Prüfvideo',aufrufe:40,reichweite:20}]});
  await attrappe(page,daten,{
   '/api/enge-freunde':req=>{
    if(req.method()==='POST'){const body=JSON.parse(req.postData());freundListe=body.an?[anna]:[];return {ok:true};}
    return {empfaengerzahl:freundListe.length,freunde:freundListe,vorschlaege:new URL(req.url()).searchParams.get('suche')?.includes('Anna')?[anna]:[]};
   },
   '/api/instants/stand':()=>({ungeoeffnet:gesehen?0:1}),
   '/api/instants':req=>{if(req.method()==='POST'){sendungen++;return {ok:true,id:'i-eigen'};}listenAufrufe++;if(viele){const ab=Number(new URL(req.url()).searchParams.get('postfachAb')||0);return {postfach:Array.from({length:55},(_,i)=>({...instant,id:'i-'+i})).slice(ab,ab+50),eigene:[]};}return {postfach:gesehen?[]:[instant],eigene:sendungen&&!zurueck?[{id:'i-eigen',text:'Prüffoto'}]:[]};},
   '/api/instants/i-empfang/bild':{bild:pixel,text:'Lokales Kamera-Instant'},
   '/api/instants/i-empfang/gesehen':()=>{gesehen++;return{ok:true}},
   '/api/instants/i-eigen/zurueckziehen':()=>{zurueck++;return{ok:true}},
   '/api/hochladen':req=>{const body=JSON.parse(req.postData());assert.equal(body.ordner,'instants');assert.ok(body.aufnahme.startsWith('data:image/jpeg;base64,'));aufnahmeBytes=Buffer.from(body.aufnahme.split(',')[1],'base64').length;return {ok:true,pfad:'instants/me/prueffoto.jpg'};},
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
  await page.keyboard.press('Escape');
  await page.locator('[data-setting="Enge Freunde"]').click();
  await page.getByRole('searchbox',{name:'Enge Freunde suchen'}).fill('Anna');
  await page.getByRole('button',{name:'Anna Schmidt Hinzufügen'}).click();
  await page.getByRole('button',{name:'Anna Schmidt Entfernen'}).waitFor();
  assert.equal(freundListe.length,1);
  await page.screenshot({animations:'disabled',path:path.join(dir,'af6-enge-freunde.png')});
  await page.keyboard.press('Escape');
  await page.locator('[data-setting="Enge Freunde"]').click();
  await page.getByRole('button',{name:'Anna Schmidt Entfernen'}).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('[data-area="messenger"]').click();
  const vorher=listenAufrufe;
  await page.evaluate(()=>instantBadgeLaden());
  assert.equal(listenAufrufe,vorher);
  await page.locator('#instantPostfach').click();
  await page.getByRole('button',{name:'Instant aufnehmen',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('instantLive')?.videoWidth>0);
  await page.getByRole('button',{name:'Foto aufnehmen',exact:true}).click();
  await page.getByPlaceholder('Bildunterschrift (freiwillig)').fill('Prüffoto');
  await page.screenshot({animations:'disabled',path:path.join(dir,'af6-kamera-vorschau.png')});
  await page.getByRole('button',{name:'Instant senden',exact:true}).click();
  await page.getByRole('button',{name:'Gesendet: Prüffoto · Zurückziehen',exact:true}).waitFor();
  assert.equal(sendungen,1);assert.ok(aufnahmeBytes>0&&aufnahmeBytes<=250*1024);
  await page.getByRole('button',{name:'Anna Schmidt · Einmal ansehen',exact:true}).click();
  await page.locator('#instantBild').waitFor();
  await page.waitForFunction(()=>document.getElementById('instantPostfach')?.textContent.includes('0 ungeöffnet'));
  assert.equal(gesehen,1);
  await page.screenshot({animations:'disabled',path:path.join(dir,'af6-instant-geoeffnet.png')});
  await page.getByRole('button',{name:'Bild schließen',exact:true}).click();
  await page.getByText('Keine ungeöffneten Instants.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Gesendet: Prüffoto · Zurückziehen',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-instantzurueck]'));
  assert.equal(zurueck,1);
  console.log(`AF6 Browser 8/8: Freund hinzufügen/erneut laden, virtuelle Kamera/Vorschau, ${aufnahmeBytes} Bytes, Senden, Öffnen einmal, leerer Stapel, Zurückziehen`);
  await page.keyboard.press('Escape');
  viele=true;await page.evaluate(()=>openInstants());
  await page.waitForFunction(()=>document.querySelectorAll('[data-instant]').length===50);
  await page.getByRole('button',{name:'Weitere Instants laden',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-instant]').length===55);
  assert.equal(await page.locator('[data-instant="i-54"]').count(),1);
  assert.equal(await page.locator('#instantMehr').count(),0);
  console.log('AF-Nachprüfung Browser 4/4: Badge ohne Listenabruf, Seite 50, Nachladen 55 ohne Duplikate, Ende ohne Mehrknopf');
  assert.deepEqual(fehler,[]);
  console.log('AF3 Browser 4/4: Knopf, gesetzt, Like schließt aus, keine Seitenfehler');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
