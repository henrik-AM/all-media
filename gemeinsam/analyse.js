(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.Analyse=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MINDESTZAHL=10;
 const n=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
 const z=v=>n(v).toLocaleString('de-DE');
 function zeilen(daten){
  if(!daten||!Array.isArray(daten.zeitraeume))throw new Error('Analysen konnten nicht geladen werden.');
  const zeilen=[{text:'Gemessen seit',neben:daten.seit?new Date(daten.seit).toLocaleDateString('de-DE'):'Noch keine Messung'},
    {text:'Sichtungen ab einer Sekunde; eigene Aufrufe zählen nicht.',kopf:true}];
  for(const tage of [7,30]){
   const f=daten.zeitraeume.find(f=>f.tage===tage);if(!f)throw new Error('Analysezeitraum fehlt.');
   for(const k of ['reichweite','aufrufe','followerAufrufe','nichtFollowerAufrufe','sichtzeitMs','interaktionen'])if(typeof f[k]!=='number'||!Number.isFinite(f[k])||f[k]<0)throw new Error('Messwert fehlt.');
   zeilen.push({text:`${tage} Tage (UTC-Kalendertage)`,kopf:true},
    {text:'Reichweite · erreichte Konten',neben:z(f.reichweite)},
    {text:'Aufrufe · gemessene Sichtungen',neben:z(f.aufrufe)},
    {text:'Davon Follower',neben:z(f.followerAufrufe)},
    {text:'Davon Nicht-Follower',neben:z(f.nichtFollowerAufrufe)},
    {text:'Gemessene Verweildauer (Min.)',neben:(n(f.sichtzeitMs)/60000).toLocaleString('de-DE',{maximumFractionDigits:1})},
    {text:'Vorhandene Likes, Kommentare, Saves, Reposts',neben:z(f.interaktionen)},
    {text:'Vorwahlregion · kein Standort',kopf:true});
   const laender=(f.laender||[]).filter(l=>n(l.ab)>=MINDESTZAHL);
   if(!laender.length)zeilen.push({text:'Länder erst ab 10 verschiedenen Konten je Land.'});
   for(const l of laender)zeilen.push({text:String(l.land),neben:`${z(l.ab)}–${z(n(l.ab)+9)} Konten`});
   zeilen.push({text:'Je Beitrag · Aufrufe / Reichweite',kopf:true});
   for(const b of f.beitraege||[])zeilen.push({text:String(b.titel||'Beitrag').slice(0,80),neben:`${z(b.aufrufe)} / ${z(b.reichweite)}`});
   if(!(f.beitraege||[]).length)zeilen.push({text:'Noch keine eigenen Beiträge.'});
  }
  return zeilen;
 }
 return {MINDESTZAHL,zeilen};
});
