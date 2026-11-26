/** Schema 113 darf später folgen: alte Einzelmedien bleiben les- und schreibbar. */
(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.Beitragschema=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function fehlt(fehler){return ['42703','PGRST204'].includes(fehler?.code)&&/\bmedien\b/i.test(fehler.message||'');}
 function spalten(liste,mitMedien){return mitMedien?liste+', medien':liste;}
 async function lesen(abfrage){const antwort=await abfrage(true);return fehlt(antwort.error)?abfrage(false):antwort;}
 async function schreiben(client,zeile,rueckgabe='*'){
  const senden=z=>client.from('posts').insert(z).select(rueckgabe).single();
  const antwort=await senden(zeile);
  if(!zeile.medien||!fehlt(antwort.error))return antwort;
  // Mehrere Aufnahmen niemals unbemerkt auf die erste reduzieren.
  if(zeile.medien.length>1)throw new Error('Hier ist derzeit nur eine Aufnahme je Beitrag möglich. Bitte die übrigen entfernen und erneut versuchen.');
  const {medien,...alt}=zeile;alt.media_url=medien[0]?.url||alt.media_url;
  return senden(alt);
 }
 return {fehlt,spalten,lesen,schreiben};
});
