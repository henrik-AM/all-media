require('./_offline_sperre.cjs');
const {client:tabellenClient}=require('./_paket6_hilfe.cjs');
/** Offline: realer Krypto-Code, Speicherabbruch nach geheim vor geraet.
 * node app/test/_paket6_migration_regression.cjs
 * Keine Quelle wird verändert; keine Netzwerkverbindung.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const W=path.resolve(process.argv[2]||path.resolve(__dirname,'../..'));
const Krypto=require(path.join(W,'gemeinsam/krypto.js'));
Krypto.zufallsquelleSetzen((a,n)=>a.set(crypto.randomBytes(n)));
const ts=require(path.join(W,'app/node_modules/typescript'));
const quellPfad=f=>path.join(process.env.MIGRATIONS_QUELLEN||W,f);
const S='allmedia.krypto.geheim',G='allmedia.krypto.geraet';
let ok=0,fehl=0;
function speicher(store,fault){return {getItem:k=>store[k]??null,setItem(k,v){if(fault.key===k){fault.key=null;throw Error('simulierter Speicherabbruch');}store[k]=v},removeItem:k=>{delete store[k]}}}
function server(alt){return tabellenClient({krypto_schluessel:['a','b'].map(id=>({id:id+'|alt-geraet',user_id:id,geraet:'alt-geraet',oeffentlich:alt.oeffentlich}))});}
function app(store,fault,konten,alt){
 const ls=speicher(store,fault),m=new Module(path.join(W,'app/lib/krypto.js'));
 m.filename=path.join(W,'app/lib/krypto.js');m.paths=Module._nodeModulePaths(path.dirname(m.filename));const original=m.require.bind(m);
 m.require=id=>id==='expo-secure-store'?{getItemAsync:async k=>ls.getItem(k),setItemAsync:async(k,v)=>ls.setItem(k,v),deleteItemAsync:async k=>ls.removeItem(k)}:id==='expo-crypto'?{getRandomBytes:n=>crypto.randomBytes(n),randomUUID:()=>crypto.randomUUID()}:id==='./kontenspeicher'?{gespeicherteKonten:async()=>konten}:original(id);
 m._compile(ts.transpileModule(fs.readFileSync(quellPfad('app/lib/krypto.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,m.filename);
 return konto=>m.exports.meinSchluessel(server(alt),konto);
}
function web(store,fault,konten,alt){
 let konto;const c={console,localStorage:speicher(store,fault),Uint8Array,Promise,Date,JSON,Math,Error,Set,Map,Object,Array,String,Number,Boolean,crypto:{randomUUID:()=>crypto.randomUUID(),getRandomValues:a=>crypto.randomFillSync(a)}};
 c.window=c;c.self=c;c.globalThis=c;c.Anmeldung={nutzer:()=>({id:konto}),konten:()=>konten.map(id=>({id}))};
 c.fetch=async(url,opts)=>{if(url.startsWith('/api/krypto/altbestand?')){const passt=decodeURIComponent(url.split('=')[1])===alt.oeffentlich&&['a','b'].includes(konto);return {ok:true,json:async()=>({kontoId:konto,id:passt?konto+'|alt-geraet':null,geraet:passt?'alt-geraet':null})};}assert.equal(url,'/api/krypto/schluessel');const b=JSON.parse(opts.body);return {ok:true,json:async()=>({id:konto+'|'+b.geraet})}};
 vm.createContext(c);for(const f of ['gemeinsam/tweetnacl.js','gemeinsam/krypto.js','web/public/krypto.js'])vm.runInContext(fs.readFileSync(f==='web/public/krypto.js'?quellPfad(f):path.join(W,f),'utf8'),c);
 return id=>{konto=id;return c.KryptoWeb.anmelden()};
}
(async()=>{
 for(const [art,laden] of [['App',app],['Browser',web]])for(const ziel of ['a','b']){
  try{
   const alt=Krypto.schluesselpaarErzeugen(),eigen=Krypto.schluesselpaarErzeugen();
   const store={[S]:alt.geheim,[G]:'alt-geraet',[S+'.c']:eigen.geheim};
   const fault={key:G+'.'+ziel},konten=['a','b','c'];
   const paket=Krypto.verschluesseln('Historischer Text',alt.geheim,[{id:ziel+'|alt-geraet',oeffentlich:alt.oeffentlich}]);
   let anmelden=laden(store,fault,konten,alt);
   assert.equal(await anmelden(ziel),null,'gezielter erster Speicherabbruch wird sichtbar');
   anmelden=laden(store,fault,konten,alt); // echter Neustart des Moduls, persistenter Speicher bleibt
   const wieder=await anmelden(ziel);
   assert.ok(wieder,'erneute Anmeldung möglich');
   assert.equal(wieder.geraet,'alt-geraet','ursprüngliche Gerätekennung bleibt erhalten');
   assert.equal(wieder.geheim,alt.geheim,'ursprünglicher Geheimschlüssel bleibt erhalten');
   const kuvert=paket.kuverts.find(k=>k.schluesselId===wieder.id);
   assert.ok(kuvert,'ursprüngliche Kuvert-ID wieder erreichbar');
   assert.equal(Krypto.entschluesseln({version:paket.version,chiffre:paket.chiffre,nonce:paket.nonce,absender:paket.absender},kuvert,wieder.geheim),'Historischer Text','alte Nachricht tatsächlich lesbar');
   const anderes=await anmelden('c');
   assert.equal(anderes.geheim,eigen.geheim,'unabhängiges Konto behält eigenes Paar');
   assert.notEqual(anderes.geraet,'alt-geraet','unabhängiger Schlüssel erhält keine fremde Gerätekennung');
   assert.equal(store[S],alt.geheim,'globale Rettungskopie für weitere historische Konten erhalten');
   assert.equal(store[G],'alt-geraet','historische Gerätekennung als Rettungskopie erhalten');
   const historisch=await anmelden(ziel==='a'?'b':'a');assert.equal(historisch.geheim,alt.geheim,'zweites historisch bestätigtes Konto bleibt lesbar');
   const neu=await anmelden('neu');assert.notEqual(neu.geheim,alt.geheim,'neues Konto erbt keinen historischen Schlüssel');
   ok++;console.log('OK',art,'Abbruch bei Konto',ziel,'alte Chiffre lesbar, Rettungskopie erhalten, neues Konto getrennt');
  }catch(e){fehl++;console.error('FEHL',art,'Abbruch bei Konto',ziel,e.message)}
 }
 console.log('Migration:',ok+'/4 Szenarien; Fehler:',fehl);process.exitCode=fehl?1:0;
})();
