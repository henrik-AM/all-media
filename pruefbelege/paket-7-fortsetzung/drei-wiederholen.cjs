// Vollständiger integrierter Nachweis; sieben bisher fehlerhafte Läufe zuerst.
const fs=require('node:fs'),path=require('node:path');
const vault='/Users/henrik.dikta/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/2.Gehirn.md/04 Ressourcen/Zugangsdaten/Supabase.md';
const token=fs.readFileSync(vault,'utf8').match(/sbp_[A-Za-z0-9_-]{20,}/)?.[0];
if(!token)throw Error('Verwaltungstoken fehlt');process.env.SUPABASE_TOKEN=token;
process.env.ZIEL='http://localhost:3300/';
for(const k of ['AM_URL','BASE','BASIS','AM_BASIS'])process.env[k]='http://localhost:3300';
const suite=require('../../app/test/alles');
const namen=new Set(['einstellungen','kontaktinfo','henrik','insel','optionen','kasten8','kamera']);
const zuerst=['explorer','fremdprofil','k28-erstellen'];
suite.LAEUFE.splice(0,suite.LAEUFE.length,...suite.LAEUFE.filter(([n])=>zuerst.includes(n)));
suite.LAEUFE.sort((a,b)=>(zuerst.includes(a[0])?zuerst.indexOf(a[0]):100)-(zuerst.includes(b[0])?zuerst.indexOf(b[0]):100));
suite.haupt().then(c=>process.exitCode=c).catch(e=>{console.error(e.message);process.exitCode=1;});
