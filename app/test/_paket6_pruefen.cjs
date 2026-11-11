/** Reproduzierbare reine Offline-Abnahme. Browser separat (eigener Port 3300). */
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const wurzel=path.resolve(__dirname,'../..'),aus=path.join(wurzel,'pruefbelege/paket-6');
fs.mkdirSync(aus,{recursive:true});
let fehler=0;
const laeufe=[
  ['_krypto_einheit.js',/36 von 36/],['_krypto_app_einheit.js',/18 von 18/],
  ['_krypto_web_einheit.js',/16 von 16/],['_krypto_server_einheit.js',/18 von 18/],
  ['_paket6_offline.js',/pass 22/],['_melden_einheit.js',/105\/105/],['_schema.js',/Schema und Code passen zusammen/],
];
for(const [name,erwartung] of laeufe){
  const r=spawnSync(process.execPath,['--require','./app/test/_offline_sperre.cjs',...(name==='_paket6_offline.js'?['--test']:[]),'app/test/'+name],{cwd:wurzel,encoding:'utf8',timeout:30000});
  const text=(r.stdout||'')+(r.stderr||'');const gut=r.status===0&&erwartung.test(text);
  fs.writeFileSync(path.join(aus,name.replace('.js','.log')),text+`\nExit: ${r.status}\n`);
  if(!gut)fehler++;console.log(`${gut?'OK':'FEHL'} ${name}: Exit ${r.status}, erwarteter Nenner ${erwartung}`);
}
const tsc=spawnSync(process.execPath,['app/node_modules/typescript/bin/tsc','--noEmit','-p','app/tsconfig.json'],{cwd:wurzel,encoding:'utf8',timeout:30000});
fs.writeFileSync(path.join(aus,'typescript.log'),(tsc.stdout||'')+(tsc.stderr||'')+`\nExit: ${tsc.status}\n`);
if(tsc.status!==0)fehler++;console.log(`${tsc.status===0?'OK':'FEHL'} TypeScript: Exit ${tsc.status}`);
const dateien=['gemeinsam/krypto.js','gemeinsam/kryptodaten.js','gemeinsam/chatabgleich.js','web/public/krypto.js','web/public/app.js','web/server/app.js','web/server/sync-handlers.js','app/test/_modulquelle.js'];
let syntaxFehler=0;for(const p of dateien){const r=spawnSync(process.execPath,['--check',p],{cwd:wurzel,encoding:'utf8'});if(r.status!==0){syntaxFehler++;console.error(r.stderr);}}
fs.writeFileSync(path.join(aus,'syntax.log'),`${dateien.length-syntaxFehler}/${dateien.length} Dateien syntaktisch gültig\n`);
if(syntaxFehler)fehler++;console.log(`${syntaxFehler?'FEHL':'OK'} Syntax: ${dateien.length-syntaxFehler}/${dateien.length}`);
console.log(`${9-fehler}/9 Offline-Prüfgruppen erfolgreich; keine Live-Abnahme.`);process.exitCode=fehler?1:0;
