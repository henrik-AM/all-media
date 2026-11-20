/* Offline-Gegenproben: tatsächliche Komponenten in einer isolierten Hook-Hülle.
 * Kein React-Renderer/Simulator und kein Ersatz für native Sichtprüfung. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
let n = 0;
const test = async (name, fn) => { await fn(); console.log(`OK ${++n} ${name}`); };
function hooks() {
  const werte = [], effekte = [];
  let index = 0;
  const react = {
    createContext: () => ({Provider:'Provider'}),
    createElement: (type, props, ...children) => ({type, props:props || {}, children}),
    useState: anfang => { const i=index++; if (!(i in werte)) werte[i]=typeof anfang==='function'?anfang():anfang; return [werte[i], w=>{werte[i]=typeof w==='function'?w(werte[i]):w;}]; },
    useRef: v => react.useState({current:v})[0],
    useCallback: f => f, useMemo: f => f(), useEffect: f => {effekte.push(f);},
  };
  return { react, werte, effekte, render:f=>{index=0;effekte.length=0;return f();} };
}
function modul(datei, laden, extra={}) {
  const ex = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,datei),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{exports:ex,module:{exports:ex},require:laden,console:{error(){}},...extra});return ex;
}
const leerDaten = new Proxy({ichId:'a',eigenesProfil:{name:'Test'}},{get:(o,k)=>k in o?o[k]:[]});
// Paket 9: Uploads der App laufen auf main über lib/beitragSpeichern.
function speicher(upload) {
  const schreib=[];
  const ex=modul('../lib/beitragSpeichern.ts',name=>{
    if(name.endsWith('/supabaseStorage'))return {ladeHoch:upload,ladeMedienlisteHoch:async()=>[],loesche:async()=>({success:true})};
    if(name.endsWith('/aktionen'))return {beitragAnlegen:async(...args)=>{schreib.push(args);return 'echt';}};
    if(name.startsWith('../../gemeinsam/'))return require(name);
    throw Error('Unerwartetes Modul '+name);
  });
  return {f:ex.beitragSpeichern,schreib};
}
function texte(tree) { if(tree==null||typeof tree==='boolean')return '';if(typeof tree!=='object')return String(tree);if(Array.isArray(tree))return tree.map(texte).join('');return texte(tree.children); }
(async()=>{
  await test('App-Uploadfehler: kein Post, verständlicher Fehler',async()=>{
    const p=speicher(async()=>({success:false,error:'Die Datei überschreitet 50 MB.'}));
    await assert.rejects(p.f({},'a',{art:'reel',beschreibung:'Test',mediaUrl:'file:///test.mp4',sekunden:1200}),/50 MB/);
    assert.equal(p.schreib.length,0);
  });
  await test('App normal: Upload vor genau einer Veröffentlichung, echte Medienreferenz',async()=>{
    const p=speicher(async()=>({success:true,url:'https://lokal/gespeichert.mp4'}));
    const r=await p.f({},'a',{art:'clip',beschreibung:'Test',mediaUrl:'file:///test.mp4',sekunden:1200});
    assert.equal(r.id,'echt');assert.equal(p.schreib.length,1);assert.equal(p.schreib[0][2].mediaUrl,'https://lokal/gespeichert.mp4');
  });
  for (const fehler of [false,true]) await test(`Web: verspätete ${fehler?'Fehler':'Analyse'} von A nach Kontowechsel B verworfen`,async()=>{
    const quelle=fs.readFileSync(path.join(__dirname,'../../web/public/app.js'),'utf8');
    const tsAst=ts.createSourceFile('app.js',quelle,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const f=tsAst.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='openEinstellung');
    let konto='a',fertig,geoeffnet=0;
    const state={kontoAnalyse:null};
    const context={state,window:{Anmeldung:{nutzer:()=>({id:konto})}},Analyse:{zeilen(){throw Error('Alte Antwort ausgewertet');}},fetch:()=>new Promise(r=>{fertig=r;}),openSheet:()=>{geoeffnet++;}};
    vm.createContext(context);vm.runInContext(f.getText(tsAst),context);
    const lauf=context.openEinstellung({liste:'kontoanalysen'});konto='b';
    fertig({ok:!fehler,json:async()=>fehler?{}:{zeitraeume:[],privat:'A'}});await lauf;
    assert.equal(state.kontoAnalyse,null);assert.equal(state.kontoAnalyseFehler,null);assert.equal(geoeffnet,0);
  });
  await test('Native Instant-Hintergrund lädt nur Stand; Ausfall zeigt unbekannt statt Null',async()=>{
    const h=hooks(),aufrufe=[];
    const ex=modul('../components/InstantsBereich.tsx',name=>{
      if(name==='react')return h.react;
      if(name==='react-native')return {AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Text:'Text',View:'View'};
      if(name==='expo-camera')return {useCameraPermissions:()=>[null,()=>{}]};
      if(name.endsWith('SupabaseContext'))return {useSupabase:()=>({supabase:{}})};
      if(name.endsWith('DatenContext'))return {useDaten:()=>({ichId:'a'})};
      if(name.endsWith('/instants')&&name.includes('/lib/'))return {D:{stand:async()=>{aufrufe.push('stand');throw Error('Offline');}}};
      if(name.includes('gemeinsam/instants'))return require('../../gemeinsam/instants');
      if(name.endsWith('/design'))return {colors:{}};
      if(name==='./Druck')return {Druck:'Druck'};
      if(name==='./SheetRahmen')return {SheetRahmen:'Sheet'};
      throw Error('Unerwartetes Modul '+name);
    },{setInterval:()=>1,clearInterval(){}});
    h.render(()=>ex.InstantsBereich({}));const ab=h.effekte.map(f=>f());await new Promise(setImmediate);
    const text=texte(h.render(()=>ex.InstantsBereich({})));
    assert.deepEqual(aufrufe,['stand']);assert.match(text,/derzeit nicht verfügbar/);assert.ok(!text.includes('0 ungeöffnet'));
    ab.forEach(f=>f?.());
  });
  console.log(`${n}/${n} Prüfungen bestanden`);
})().catch(e=>{console.error(e);process.exit(1);});
