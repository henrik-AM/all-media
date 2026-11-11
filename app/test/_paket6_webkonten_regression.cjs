/** Offline: echte anmeldung.js + krypto.js; Konfiguration bewusst deaktiviert.
 * node diese-datei.cjs /worktree; optional WEBKONTEN_QUELLEN=/temp/qa
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const W=path.resolve(process.argv[2]||path.resolve(__dirname,'../..')),Q=process.env.WEBKONTEN_QUELLEN||W;
let ok=0,fehl=0;
(async()=>{
 for(const art of ['Speicherfehler','JSON kaputt','Array statt Objekt','Ungültiger Eintrag']){
  try{
   const store={};let defekt=true,konto='a';const fach='all-media.web.konten.v1';
   let roh=art==='JSON kaputt'?'{kaputt':art==='Array statt Objekt'?'[]':art==='Ungültiger Eintrag'?' {"a":{"id":"a","refresh_token":"x"},"b":42}':JSON.stringify({a:{id:'a',refresh_token:'x'},b:{id:'b',refresh_token:'y'}});
   const c={console,Uint8Array,Promise,Date,JSON,Math,Error,Set,Map,Object,Array,String,Number,Boolean,location:{host:'offline.invalid'},crypto:{randomUUID:()=>crypto.randomUUID(),getRandomValues:a=>crypto.randomFillSync(a)},localStorage:{getItem:k=>{if(k===fach){if(defekt&&art==='Speicherfehler')throw Error('Speicherfehler');return roh}return store[k]??null},setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}}};
   c.window=c;c.self=c;c.globalThis=c;
   c.fetch=async(url,opt)=>{if(url==='/api/konfiguration')return {json:async()=>({konfiguriert:false})};assert.equal(url,'/api/krypto/schluessel');return {ok:true,json:async()=>({id:konto+'|'+JSON.parse(opt.body).geraet})}};
   vm.createContext(c);
   for(const f of ['gemeinsam/tweetnacl.js','gemeinsam/krypto.js','web/public/anmeldung.js','web/public/krypto.js'])vm.runInContext(fs.readFileSync(path.join(f.startsWith('web/')?Q:W,f),'utf8'),c);
   // Nur die aktive Identität ersetzen; konten()/kontenLesen() laufen unverändert.
   c.Anmeldung.nutzer=()=>({id:konto});
   const alt=c.Krypto.schluesselpaarErzeugen();store['allmedia.krypto.geheim']=alt.geheim;store['allmedia.krypto.geraet']='old-device';
   assert.ok(Array.isArray(c.Anmeldung.konten()),'normale UI bleibt fehlertolerant');
   assert.equal(Boolean(await c.KryptoWeb.anmelden()),false,'unlesbare Liste muss Migration stoppen');
   assert.equal(store['allmedia.krypto.geheim'],alt.geheim,'Alt-Schlüssel bleibt erhalten');
   assert.equal(store['allmedia.krypto.geraet'],'old-device','Alt-Gerätekennung bleibt erhalten');
   assert.equal(store['allmedia.krypto.geheim.a'],undefined,'kein Teilbestand');
   defekt=false;roh=JSON.stringify({a:{id:'a',refresh_token:'x'},b:{id:'b',refresh_token:'y'}});
   for(const id of ['a','b']){
    konto=id;const m=await c.KryptoWeb.anmelden();assert.ok(m);
    assert.equal(m.geheim,alt.geheim,'alter Geheimschlüssel '+id);assert.equal(m.geraet,'old-device','alte Gerätekennung '+id);
    const p=c.Krypto.verschluesseln('Alter Text '+id,alt.geheim,[{id:id+'|old-device',oeffentlich:alt.oeffentlich}]);
    const k=p.kuverts.find(k=>k.schluesselId===m.id);assert.ok(k,'ursprüngliches Kuvert '+id);
    assert.equal(c.Krypto.entschluesseln({version:p.version,chiffre:p.chiffre,nonce:p.nonce,absender:p.absender},k,m.geheim),'Alter Text '+id,'alte Chiffre lesbar '+id);
   }
   assert.equal(store['allmedia.krypto.geheim'],undefined,'Altfach nach vollständiger Übernahme entfernt');
   ok++;console.log('OK',art);
  }catch(e){fehl++;console.error('FEHL',art,e.message)}
 }
 console.log('Browser-Kontenliste:',ok+'/4 Szenarien; Fehler:',fehl);process.exitCode=fehl?1:0;
})();
