/** Offline: echter gemeinsamer Transport mit XHR-Gegenstelle; keine Anmeldung/Cloud. */
const assert=require('node:assert/strict'),U=require('../../gemeinsam/upload');
let n=0;async function test(name,f){await f();console.log(`OK ${++n} ${name}`);}
function xhr(){return {upload:{},headers:{},open(m,u){this.method=m;this.url=u;},setRequestHeader(k,v){this.headers[k]=v;},send(b){this.body=b;},abort(){this.aborted=true;this.onabort();}};}
(async()=>{
 await test('Bytefortschritt und Prüfen sind verschiedene Phasen',async()=>{const x=xhr(),staende=[];const p=U.senden({url:'/upload',body:'bytes',xhrFabrik:()=>x,fortschritt:s=>staende.push(s)});x.upload.onprogress({loaded:5,total:10,lengthComputable:true});assert.equal(U.text(staende.at(-1)),'Hochladen: 50 %');x.upload.onload();assert.match(U.text(staende.at(-1)),/geprüft/);let fertig=false;p.then(()=>fertig=true);await Promise.resolve();assert.equal(fertig,false);x.status=200;x.responseText='{"ok":true,"url":"dauer"}';x.onload();assert.equal((await p).url,'dauer');});
 await test('Abbruch beendet XHR und liefert nie Erfolg',async()=>{const x=xhr(),a=new AbortController();const p=U.senden({url:'/u',body:'x',signal:a.signal,xhrFabrik:()=>x});a.abort();await assert.rejects(p,{name:'AbortError'});assert.equal(x.aborted,true);x.status=200;x.responseText='{"ok":true}';x.onload();});
 await test('Vorher abgebrochen sendet kein Byte',async()=>{const a=new AbortController();a.abort();await assert.rejects(U.senden({signal:a.signal,xhrFabrik:()=>{throw Error('Darf nicht entstehen');}}),{name:'AbortError'});});
 for(const status of [401,413,429,500])await test(`HTTP ${status} meldet verständlichen Fehler`,async()=>{const x=xhr(),p=U.senden({url:'/u',body:'x',xhrFabrik:()=>x});x.status=status;x.responseText='{"ok":false,"error":"Bitte erneut versuchen"}';x.onload();await assert.rejects(p,/Bitte erneut/);});
 await test('Fehler auch bei HTTP 200 bleibt Fehler',async()=>{const x=xhr(),p=U.senden({url:'/u',body:'x',xhrFabrik:()=>x});x.status=200;x.responseText='{"ok":false,"error":"Falscher Typ"}';x.onload();await assert.rejects(p,/Falscher Typ/);});
 await test('HTML-Fehlerseite wird nicht als Upload gewertet',async()=>{const x=xhr(),p=U.senden({url:'/u',body:'x',xhrFabrik:()=>x});x.status=200;x.responseText='<html>';x.onload();await assert.rejects(p,/Serverantwort/);});
 for(const art of ['onerror','ontimeout'])await test(art,async()=>{const x=xhr(),p=U.senden({url:'/u',body:'x',xhrFabrik:()=>x});x[art]();await assert.rejects(p);});
 await test('Header, Bytes und Zeitgrenze werden tatsächlich gesetzt',async()=>{const x=xhr(),p=U.senden({url:'/u',body:'bytes',headers:{Authorization:'Bearer lokal'},xhrFabrik:()=>x});assert.equal(x.headers.Authorization,'Bearer lokal');assert.equal(x.body,'bytes');assert.equal(x.timeout,600000);x.status=200;x.responseText='{"ok":true}';x.onload();await p;});
 console.log(`${n}/${n} Prüfungen bestanden`);
})().catch(e=>{console.error(e);process.exitCode=1;});
