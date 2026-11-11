/** Offline: echte kontenspeicher.ts + krypto.ts, keine externen Verbindungen.
 * node diese-datei.cjs /worktree; optional KONTENLISTE_QUELLEN=/temp/qa
 */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const W=path.resolve(process.argv[2]||path.resolve(__dirname,'../..')),Q=process.env.KONTENLISTE_QUELLEN||W;
const ts=require(path.join(W,'app/node_modules/typescript')),Krypto=require(path.join(W,'gemeinsam/krypto'));
Krypto.zufallsquelleSetzen((a,n)=>a.set(crypto.randomBytes(n)));
function load(file,mocks){const m=new Module(path.join(W,file.replace('.ts','.js')));m.filename=path.join(W,file.replace('.ts','.js'));m.paths=Module._nodeModulePaths(path.dirname(m.filename));const req=m.require.bind(m);m.require=id=>id in mocks?mocks[id]:req(id);m._compile(ts.transpileModule(fs.readFileSync(path.join(Q,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,m.filename);return m.exports}
function client(){return {from(){let w;const q={upsert(x){w=x;return q},select(){return q},single:async()=>({data:{id:w.user_id+'|'+w.geraet}})};return q}}}
let ok=0,fehl=0;
(async()=>{
 for(const variante of ['Speicherfehler','JSON kaputt','Objekt statt Liste','Ungültiger Eintrag']){
  try{
   const alt=Krypto.schluesselpaarErzeugen(),store={'allmedia.krypto.geheim':alt.geheim,'allmedia.krypto.geraet':'alt-device'};
   let roh=variante==='JSON kaputt'?'{kaputt':variante==='Objekt statt Liste'?'{}':variante==='Ungültiger Eintrag'?'["a",42]':'["a","b"]',defekt=true;
   const session={getItem:async()=>{if(defekt&&variante==='Speicherfehler')throw Error('SecureStore nicht verfügbar');return roh}};
   const konten=load('app/lib/kontenspeicher.ts',{'./sitzungsspeicher':{sitzungsspeicher:session},'../constants/supabase':{SUPABASE_CONFIG:{}}});
   assert.ok(Array.isArray(await konten.gespeicherteKonten()),'normaler UI-Aufruf bleibt fehlertolerant');
   const secure={getItemAsync:async k=>store[k]??null,setItemAsync:async(k,v)=>{store[k]=v},deleteItemAsync:async k=>{delete store[k]}};
   const K=load('app/lib/krypto.ts',{'expo-secure-store':secure,'expo-crypto':{getRandomBytes:n=>crypto.randomBytes(n),randomUUID:()=>crypto.randomUUID()},'./kontenspeicher':konten});
   assert.equal(Boolean(await K.meinSchluessel(client(),'a')),false,'defekte Liste muss Migration stoppen');
   assert.equal(store['allmedia.krypto.geheim'],alt.geheim,'globaler Alt-Schlüssel erhalten');
   assert.equal(store['allmedia.krypto.geraet'],'alt-device','globale Gerätekennung erhalten');
   assert.equal(store['allmedia.krypto.geheim.a'],undefined,'kein Teilbestand bei unlesbarer Liste');
   defekt=false;roh='["a","b"]';
   const a=await K.meinSchluessel(client(),'a'),b=await K.meinSchluessel(client(),'b');
   for(const [id,m] of [['a',a],['b',b]]){
    assert.equal(m.geheim,alt.geheim,'historischer Schlüssel '+id);
    assert.equal(m.geraet,'alt-device','historische Gerätekennung '+id);
    const paket=Krypto.verschluesseln('Alter Text '+id,alt.geheim,[{id:id+'|alt-device',oeffentlich:alt.oeffentlich}]);
    const kuvert=paket.kuverts.find(k=>k.schluesselId===m.id);
    assert.equal(Krypto.entschluesseln({version:paket.version,chiffre:paket.chiffre,nonce:paket.nonce,absender:paket.absender},kuvert,m.geheim),'Alter Text '+id,'alte Chiffre lesbar '+id);
   }
   assert.equal(store['allmedia.krypto.geheim'],undefined,'globaler Schlüssel nach vollständiger Migration entfernt');
   ok++;console.log('OK',variante);
  }catch(e){fehl++;console.error('FEHL',variante,e.message)}
 }
 console.log('Kontenliste:',ok+'/4 Szenarien; Fehler:',fehl);process.exitCode=fehl?1:0;
})();
