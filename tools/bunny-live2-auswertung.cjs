/** Vergleich ausschließlich aus den abgeschlossenen Originalübersichten ableiten. */
const fs=require('fs'),path=require('path');
const dir=path.resolve(__dirname,'../pruefbelege/bunny-live2');
function lesen(name){
 const text=fs.readFileSync(path.join(dir,`05-${name}-alles.txt`),'utf8');
 const ende=text.split('  Übersicht\n').at(-1);
 const zeilen=[...ende.matchAll(/^  (OK|FEHL|ZEIT)\s+([a-z][a-z0-9-]*)\s+(?:(\d+)\/(\d+)|(—))\s*$/gm)];
 if(zeilen.length!==71||!text.includes('71 Läufe.'))throw Error(name+' Übersicht nicht vollständig');
 const laeufe=zeilen.map(z=>({name:z[2],status:z[1],gut:z[3]?Number(z[3]):null,gesamt:z[4]?Number(z[4]):null}));
 const sum=text.match(/(\d+) von (\d+) Prüfungen bestanden, (\d+) Läufe\./);
 const teile=text.split(/={30,}\n  ([a-z][a-z0-9-]*)\n={30,}/);
 const fehler={};
 for(let i=1;i<teile.length;i+=2){fehler[teile[i]]=teile[i+1].split('\n').filter(z=>/^\s*(?:FEHL|FAIL)\b/.test(z)&&!/^\s*(?:FEHL|FAIL)\s+[a-z][a-z0-9-]*\s+(?:\d+\/\d+|—)\s*$/.test(z)).map(z=>z.trim());}
 return {name,laeufe,gut:Number(sum[1]),gesamt:Number(sum[2]),fehler,quellstandGeaendert:text.includes('während des Laufs hat sich Code oder eine Prüfdatei geändert'),aufgeraeumt:Number((text.match(/Aufgeraeumt: (\d+) Mitteilungen/)||[])[1]||0)};
}
const main=lesen('main'),bunny=lesen('bunny-live');
const zelle=z=>`${z.status} ${z.gut===null?'ohne Zählung':z.gut+'/'+z.gesamt}`;
const a=['# Gesamtläufe main und Bunny','', 'Gleiche Live-Datenbank einschließlich Schema 115; main ohne Bunny. OK bedeutet Exit 0, FEHL einen nicht erfolgreichen Prozess, ZEIT einen unvollständigen Lauf nach 15 Minuten. Die Prüfzahlen enthalten nur tatsächlich gezählte Zeilen.','', '| Lauf | main | bunny-live |','|---|---|---|'];
const anders=[];
for(const b of bunny.laeufe){const m=main.laeufe.find(z=>z.name===b.name);if(!m)throw Error('main fehlt '+b.name);a.push(`| ${b.name} | ${zelle(m)} | ${zelle(b)} |`);if(zelle(m)!==zelle(b))anders.push({name:b.name,main:m,bunny:b,mainFehler:main.fehler[b.name],bunnyFehler:bunny.fehler[b.name]});}
a.push(`| **Gezählte Prüfungen** | **${main.gut}/${main.gesamt}** | **${bunny.gut}/${bunny.gesamt}** |`);
for(const [label,filter] of [['Exit 0',z=>z.status==='OK'],['Nicht erfolgreich einschließlich Zeitgrenze',z=>z.status!=='OK'],['Davon Zeitgrenze',z=>z.status==='ZEIT']])a.push(`| **${label}** | **${main.laeufe.filter(filter).length}/71** | **${bunny.laeufe.filter(filter).length}/71** |`);
a.push('','## Abweichende Zeilen','');
for(const z of anders){a.push(`- ${z.name}: main ${zelle(z.main)}, Bunny ${zelle(z.bunny)}.`);for(const [n,f] of [['main',z.mainFehler],['Bunny',z.bunnyFehler]])for(const e of f)a.push(`  - ${n}: ${e.replaceAll('|','/')}`);}
if(!anders.length)a.push('Keine unterschiedlichen Status-/Prüfzahlzeilen.');
a.push('',`Quellstandänderung gemeldet: main ${main.quellstandGeaendert}, Bunny ${bunny.quellstandGeaendert}.`,`Automatisch entfernte Mitteilungen: main ${main.aufgeraeumt}, Bunny ${bunny.aufgeraeumt}. Separate Nachzählung siehe 06-bereinigung.txt.`,'');
fs.writeFileSync(path.join(dir,'05-vergleich-tabelle.md'),a.join('\n'));
fs.writeFileSync(path.join(dir,'05-auswertung.json'),JSON.stringify({main,bunny,abweichungen:anders},null,2)+'\n');
console.log(JSON.stringify({main:{gut:main.gut,gesamt:main.gesamt,gruen:main.laeufe.filter(z=>z.status==='OK').length},bunny:{gut:bunny.gut,gesamt:bunny.gesamt,gruen:bunny.laeufe.filter(z=>z.status==='OK').length},abweichend:anders.map(z=>z.name)}));
