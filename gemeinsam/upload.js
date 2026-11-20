/** Roher Upload mit echtem Bytefortschritt. App und Website verwenden dieselbe Rechnung. */
(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.MedienUpload=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function abbruch(){const e=new Error('Hochladen abgebrochen.');e.name='AbortError';return e;}
 function senden({url,body,headers={},signal,fortschritt=()=>{},xhrFabrik=()=>new XMLHttpRequest()}) {
  return new Promise((resolve,reject)=>{
   if(signal?.aborted){reject(abbruch());return;}
   const xhr=xhrFabrik();let fertig=false;
   const ende=(fehler,daten)=>{if(fertig)return;fertig=true;signal?.removeEventListener('abort',stop);fehler?reject(fehler):resolve(daten);};
   const stop=()=>{xhr.abort();ende(abbruch());};
   xhr.open('POST',url,true);xhr.timeout=10*60*1000;
   Object.entries(headers).forEach(([k,v])=>xhr.setRequestHeader(k,v));
   // React Native meldet lengthComputable oft nicht; die Körpergröße ist bekannt.
   const groesse=body&&(body.byteLength||body.size)||0;
   xhr.upload.onprogress=e=>fortschritt({geladen:e.loaded,gesamt:e.lengthComputable&&e.total?e.total:groesse,phase:'hochladen'});
   xhr.upload.onload=()=>fortschritt({geladen:0,gesamt:0,phase:'pruefen'});
   xhr.onerror=()=>ende(new Error('Keine Verbindung. Bitte erneut versuchen.'));
   xhr.ontimeout=()=>ende(new Error('Das Hochladen hat zu lange gedauert. Bitte erneut versuchen.'));
   xhr.onabort=()=>ende(abbruch());
   xhr.onload=()=>{
    let daten;try{daten=JSON.parse(xhr.responseText);}catch{ende(new Error('Ungültige Serverantwort.'));return;}
    if(xhr.status<200||xhr.status>=300||daten?.ok===false){ende(new Error(daten?.error||'Hochladen fehlgeschlagen.'));return;}
    ende(null,daten);
   };
   signal?.addEventListener('abort',stop,{once:true});
   fortschritt({geladen:0,gesamt:0,phase:'hochladen'});
   if(signal?.aborted){stop();return;}
   try{xhr.send(body);}catch{ende(new Error('Die Aufnahme ließ sich nicht senden.'));}
  });
 }
 function text(s){if(s.phase==='pruefen')return 'Aufnahme wird geprüft und gespeichert …';return s.gesamt>0?`Hochladen: ${Math.min(100,Math.floor(100*s.geladen/s.gesamt))} %`:'Hochladen …';}
 return {senden,text};
});
