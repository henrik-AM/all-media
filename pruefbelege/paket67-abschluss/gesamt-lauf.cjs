// Gemeinsamer Paket6/7-Nachweis: alle103Suiten, unveränderte Quellen, Originaljournal/Bereinigung.
const fs=require('node:fs'),path=require('node:path');
const vault='/Users/henrik.dikta/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/2.Gehirn.md/04 Ressourcen/Zugangsdaten/Supabase.md';
const token=fs.readFileSync(vault,'utf8').match(/sbp_[A-Za-z0-9_-]{20,}/)?.[0];
if(!token)throw Error('Verwaltungstoken fehlt');process.env.SUPABASE_TOKEN=token;
process.env.ZIEL='http://localhost:3300/';
process.env.AM_OFFLINE_PORT='3304';
process.env.AM_OFFLINE_BILDER=path.join(__dirname,'browser-vollnachweis');
for(const k of ['AM_URL','BASE','BASIS','AM_BASIS'])process.env[k]='http://localhost:3300';
const suite=require('../../app/test/alles');
const zuerst=['feedback','paket6-browser','kontaktinfo','krypto','paket6-migration','paket6-kontenliste','paket6-webkonten','explorer','fremdprofil','k28-erstellen','uebernacht','sync','kamera','smoke','einstellungen','henrik','insel','optionen','kasten8'];
suite.LAEUFE.sort((a,b)=>(zuerst.includes(a[0])?zuerst.indexOf(a[0]):100)-(zuerst.includes(b[0])?zuerst.indexOf(b[0]):100));
(async()=>{
 require('../../app/test/_ki_belegung').pruefeBelegung('testbestand');
 const {frage}=require('../../app/test/_aufraeumen');
 const {TESTKONTEN}=require('../../app/test/_nur_testkonten');
 const mails=TESTKONTEN.map(k=>"'"+k.replaceAll("'","''")+"'").join(',');
 const beteiligt=`(actor_id in(select id from auth.users where email in(${mails})) or user_id in(select id from auth.users where email in(${mails})))`;
 // Eigene exklusiv vorangegangene Plattform-/Paket6-Läufe; Originalfilter aus _lauf_mitteilungen.
 const vorher=await frage(`select count(*) anzahl from notifications where ${beteiligt}`);
 const weg=await frage(`with weg as(delete from notifications where ${beteiligt} returning 1) select count(*) geloescht from weg`);
 const nachher=await frage(`select count(*) rest from notifications where ${beteiligt}`);
 fs.writeFileSync(path.join(__dirname,'vorlauf-mitteilungen.json'),JSON.stringify({vorher,weg,nachher},null,2));
 if(Number(nachher[0].rest)!==0)throw Error('Vorlauf-Mitteilungen nicht vollständig bereinigt');
 process.exitCode=await suite.haupt();
})().catch(e=>{console.error(e.message);process.exitCode=1;});
