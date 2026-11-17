// Bewusste einmalige Gegenprüfung ausschließlich roter Gruppen eines beendeten Volllaufs.
// Kein automatischer Retry und keine Umdeutung des ursprünglichen Gesamtergebnisses.
const fs=require('node:fs'),path=require('node:path');
const quelle=process.argv[2];
if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(quelle||''))throw Error('Beendete Vollnachweis-ID als Argument erforderlich');
const stand=JSON.parse(fs.readFileSync(path.join(__dirname,'../../app/test/.gesamtlauf-belege',quelle,'status.json'),'utf8'));
const suite=require('../../app/test/alles');
if(stand.phase==='laeuft'||stand.ergebnisse.length!==103||!stand.quellenUnveraendert||stand.bereinigung!=='erfolgreich')throw Error('Vollnachweis oder Bereinigung noch nicht abgeschlossen');
if(suite.stempel()!==stand.stempelVorher)throw Error('Quellen seit Vollnachweis verändert; unveränderte Gegenprüfung nicht zulässig');
const namen=stand.ergebnisse.filter(e=>e.code!==0||!e.zahlen||e.zahlen.gut!==e.zahlen.gesamt).map(e=>e.name);
if(!namen.length)throw Error('Keine roten Gruppen zur Gegenprüfung');
const auswahl=suite.LAEUFE.filter(([n])=>namen.includes(n));
if(auswahl.length!==namen.length)throw Error('Gruppenauswahl passt nicht zum Vollnachweis');
suite.LAEUFE.splice(0,suite.LAEUFE.length,...auswahl);
fs.writeFileSync(path.join(__dirname,'gezielt-auswahl.json'),JSON.stringify({aus:quelle,namen,quellstempel:stand.stempelVorher,zeit:new Date().toISOString()},null,2));
require('./gesamt-lauf.cjs');
