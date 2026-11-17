// Anonymer Live-Nachweis: tatsächlicher Releasecommit und unveränderte Produktdateien.
// node diese-datei.cjs <veröffentlichter Commit>
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),ref=process.argv[2];if(!/^[0-9a-f]{7,40}$/.test(ref||''))throw Error('Veröffentlichte Commitkennung erforderlich');
const erwartet=cp.execFileSync('git',['rev-parse',ref],{cwd:root,encoding:'utf8'}).trim(),basis='https://all-media-website.onrender.com';
const dateien=[['/app.js','web/public/app.js'],['/anmeldung.js','web/public/anmeldung.js'],['/krypto.js','web/public/krypto.js'],['/gemeinsam/krypto.js','gemeinsam/krypto.js']];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 const [v,html,...files]=await Promise.all([
  fetch(basis+'/api/version',{signal:AbortSignal.timeout(60000)}).then(async r=>({status:r.status,inhalt:await r.json()})),
  fetch(basis+'/',{signal:AbortSignal.timeout(60000)}).then(async r=>({status:r.status,appEnthalten:(await r.text()).includes('app.js')})),
  ...dateien.map(async([url,rel])=>{const r=await fetch(basis+url,{signal:AbortSignal.timeout(60000)}),live=sha(Buffer.from(await r.arrayBuffer())),lokal=sha(fs.readFileSync(path.join(root,rel)));return{url,status:r.status,sha256Live:live,sha256Getestet:lokal,gleich:live===lokal};}),
 ]);
 const live=v.inhalt.commit,commitStimmt=v.status===200&&/^[0-9a-f]{7,40}$/.test(live||'')&&erwartet.startsWith(live);
 const ergebnis={zeit:new Date().toISOString(),basis,releaseErwartet:erwartet,version:v,commitStimmt,startseite:html,dateien:files,erfolgreich:Boolean(commitStimmt&&html.status===200&&html.appEnthalten&&files.every(x=>x.status===200&&x.gleich)),grenze:'Anonyme HTTP-/Versions-/Dateiprüfung; keine neue Anmeldung oder Testdatenmutation auf Render.'};
 fs.writeFileSync(path.join(__dirname,'render-live-b55003e.json'),JSON.stringify(ergebnis,null,2));console.log(JSON.stringify({live,commitStimmt,dateien:files.map(x=>({url:x.url,status:x.status,gleich:x.gleich})),erfolgreich:ergebnis.erfolgreich}));
 if(!ergebnis.erfolgreich)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
