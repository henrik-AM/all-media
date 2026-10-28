// Regression: falsche iOS-Dateiendung und gescheiterte Veröffentlichung.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function modul(datei, abhaengig, extras={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../',datei),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports,require:n=>abhaengig[n],console:{error(){}},AbortSignal,Uint8Array,...extras});
  return exports;
}
const client={auth:{getSession:async()=>({data:{session:{access_token:'attrappe'}}})}};
for(const [typ,bytes,name] of [
  ['image/png',[137,80,78,71,13,10,26,10],'aufnahme.jpg'],
  ['image/jpeg',[255,216,255,0],'aufnahme.png'],
  ['image/webp',Array.from(Buffer.from('RIFFxxxxWEBP')),'aufnahme.jpg'],
  ['video/mp4',Array.from(Buffer.from('0000ftypisom')),'aufnahme.mp4'],
  ['video/quicktime',Array.from(Buffer.from('0000ftypqt  ')),'aufnahme.mp4'],
]) test('Upload sendet '+typ+' anhand Aufnahmeinhalt/Videoendung',async()=>{
  let gesendet;
  const storage=modul('lib/supabaseStorage.ts',{'./medien':{medienServerBasis:()=> 'https://attrappe.invalid'}},{fetch:async(url,opts)=>{
    if(!opts)return {ok:true,arrayBuffer:async()=>new Uint8Array(bytes).buffer};
    gesendet=opts.headers['Content-Type'];return {ok:true,json:async()=>({ok:true,url:'bestaendig',anzeige:'signiert'})};
  }});
  const r=await storage.ladeHoch(client,'file://aufnahme','posts',name);
  assert.equal(r.success,true);assert.equal(gesendet,typ);
});
function speichern(upload,anlegen,loeschen=async()=>{}) {
 return modul('lib/beitragSpeichern.ts',{'./aktionen':{beitragAnlegen:anlegen},'./supabaseStorage':{ladeHoch:upload,loesche:loeschen}}).beitragSpeichern;
}
test('Upload abgelehnt: kein INSERT und kein Erfolg',async()=>{
 let inserts=0;const tun=speichern(async()=>({success:false,error:'Falscher Inhaltstyp'}),async()=>{inserts++});
 await assert.rejects(tun(client,'ich',{mediaUrl:'file://aufnahme'}),/Falscher Inhaltstyp/);assert.equal(inserts,0);
});
test('Upload unvollständig: kein INSERT',async()=>{
 let inserts=0;const tun=speichern(async()=>({success:true,url:null}),async()=>{inserts++});
 await assert.rejects(tun(client,'ich',{mediaUrl:'file://aufnahme'}));assert.equal(inserts,0);
});
test('INSERT scheitert: Aufnahme aufräumen, Fehler erhalten',async()=>{
 let entfernt;const tun=speichern(async()=>({success:true,url:'https://sb/storage/v1/object/public/media/posts/eigen.png'}),async()=>{throw Error('DB abgelehnt')},async(c,p)=>{entfernt=p});
 await assert.rejects(tun(client,'ich',{mediaUrl:'file://aufnahme'}),/DB abgelehnt/);assert.equal(entfernt,'posts/eigen.png');
});
test('Erfolg: dauerhafte URL speichern, signiertes CDN-Bild anzeigen',async()=>{
 let felder;const tun=speichern(async()=>({success:true,url:'bestaendig',anzeige:'cdn-signiert'}),async(c,i,f)=>{felder=f;return 'echte-id'});
 const r=await tun(client,'ich',{mediaUrl:'file://aufnahme',beschreibung:'Bild'});
 assert.equal(felder.mediaUrl,'bestaendig');assert.equal(r.id,'echte-id');assert.equal(r.mediaUri,'cdn-signiert');
});
test('Websiteformular: Fehler sichtbar, kein Schließen, Doppelklick gesperrt',async()=>{
 const quelle=fs.readFileSync(require('node:path').join(__dirname,'../../web/public/app.js'),'utf8');
 const start=quelle.indexOf('function openFormular('),ende=quelle.indexOf('\n/**',start+20);
 const knopf={textContent:'Veröffentlichen',addEventListener:(e,f)=>knopf.klick=f};
 const fehler={hidden:true};let geschlossen=0,aufrufe=0,ablehnen;
 const sheet={querySelector:q=>q==='#formOk'?knopf:q==='#formFehler'?fehler:null,querySelectorAll:()=>[]};
 const kontext={esc:x=>x,setTimeout(){},openSheet:(t,h,init)=>init(sheet,()=>geschlossen++)};
 vm.runInNewContext(quelle.slice(start,ende),kontext);
 kontext.openFormular('Beitrag',[],async()=>{aufrufe++;await new Promise(r=>ablehnen=r);throw Error('Upload abgelehnt')},'Veröffentlichen');
 const erster=knopf.klick();await knopf.klick();assert.equal(aufrufe,1);assert.equal(knopf.disabled,true);
 ablehnen();await erster;assert.equal(geschlossen,0);assert.equal(fehler.hidden,false);assert.equal(fehler.textContent,'Upload abgelehnt');assert.equal(knopf.disabled,false);
});

test('Appformular: warten, Mehrfachtippen sperren, Fehler im Blatt, Wiederholung möglich',async()=>{
 const zustand=[];const react={createElement:(typ,props,...children)=>({typ,props,children}),useEffect(){},useRef:v=>({current:v}),useState:v=>{const i=zustand.length;zustand.push(v);return [v,x=>zustand[i]=x]}};
 let zu=0,aufrufe=0,weiter;
 const {FormularSheet}=modul('components/FormularSheet.tsx',{
  react:{...react,default:react},'react-native':{Keyboard:{dismiss(){}}},'./Druck':{Druck:'Druck'},'./SheetRahmen':{SheetRahmen:'Sheet'},'./MarkierungsEingabe':{},'../constants/design':{themenStyles:()=>({}),colors:{},radius:{},spacing:{},typography:{}}
 });
 const blatt=FormularSheet({visible:true,title:'Beitrag',felder:[],onClose:()=>zu++,onSubmit:async()=>{aufrufe++;if(aufrufe===1){await new Promise(r=>weiter=r);throw Error('Upload abgelehnt')}return null}});
 const erster=blatt.props.fuss.props.onPress();await blatt.props.fuss.props.onPress();blatt.props.onClose();
 assert.equal(aufrufe,1);assert.equal(zu,0);assert.equal(zustand[1],true);
 weiter();await erster;assert.equal(zu,0);assert.equal(zustand[2],'Upload abgelehnt');assert.equal(zustand[1],false);
 await blatt.props.fuss.props.onPress();assert.equal(aufrufe,2);assert.equal(zu,1);
});

test('Netzabbruch zeigt eine verständliche Meldung ohne SDK-Interna',async()=>{
 const storage=modul('lib/supabaseStorage.ts',{'./medien':{}},{fetch:async()=>{throw Error('fetch failed: UnexpectedException: The network connection was lost. (at ExpoModulesCore/Promise.swift:56)')}});
 const r=await storage.ladeHoch(client,'file://aufnahme','posts','bild.jpg');
 assert.equal(r.success,false);assert.equal(r.error,'Die Aufnahme ließ sich nicht speichern. Bitte erneut versuchen.');
});
