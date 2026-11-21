/** Wiederholbarer Rotnachweis am festen Vorgänger, ohne Dateien zurückzusetzen. */
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),// Paket 9: b5-app prüft lib/beitragSpeichern (main), am Vorgänger a5eccc5 gibt es das nicht.
faelle=['b1','b3','b4','b5','b7'];let log='';
for(const fall of faelle){const r=spawnSync(process.execPath,[`app/test/af-fix-${fall}.js`],{cwd:root,env:{...process.env,AF_FIX_BASIS:'1'},encoding:'utf8',timeout:30000});const ausgabe=r.stdout+r.stderr;assert.equal(r.status,1,fall+': erwartete rote Prüfung fehlt');assert.match(ausgabe,/AssertionError/,fall+': kein fachlicher Rotnachweis');log+=`${fall}: erwartetes ROT\n${ausgabe}\n`;console.log(`OK ${fall}: Vorgänger a5eccc5 erwartungsgemäß rot`);}
fs.mkdirSync(path.join(__dirname,'ergebnisse-af-fix'),{recursive:true});fs.writeFileSync(path.join(__dirname,'ergebnisse-af-fix/vorher.txt'),log);console.log(`${faelle.length}/${faelle.length} Rotnachweise reproduziert; SQL-Vorherfälle stehen in schema.txt.`);
