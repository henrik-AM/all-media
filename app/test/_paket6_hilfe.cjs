/** Paket-6-Gegenproben mit echten Kryptomodulen, ausschließlich Speichertabellen. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), Module = require('node:module');
const crypto = require('node:crypto');
const W = process.env.AM_PAKET6_QUELLE || path.resolve(__dirname, '../..');
const Krypto = require(path.join(W, 'gemeinsam/krypto'));
Krypto.zufallsquelleSetzen((x,n)=>x.set(crypto.randomBytes(n)));
// Altstand besitzt diesen neuen Helfer noch nicht; die Integration wird
// über dessen App-/Server-Aufrufer separat gegen den Altstand geprüft.
const { schluesselHolen } = require(fs.existsSync(path.join(W, 'gemeinsam/kryptodaten.js'))
  ? path.join(W, 'gemeinsam/kryptodaten.js') : '../../gemeinsam/kryptodaten');
const S = require(path.join(W, 'web/server/sync-handlers'));
const ts = require('typescript');
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function client(db, fehler = () => null) {
  let zaehler = 0;
  return { rpc: async () => ({ data: true, error: null }), from(tabelle) {
    const filter = []; let art = 'select', wert, einzeln = false, bereich, lim, spalten = '', ordnung;
    const q = {
      select(s) { spalten = s || ''; return q; },
      eq(s,v) { filter.push(z => z[s] === v); return q; },
      neq(s,v) { filter.push(z => z[s] !== v); return q; },
      gt(s,v) { filter.push(z => Number(z[s]) > v); return q; },
      in(s,l) { filter.push(z => l.includes(z[s])); return q; },
      order(s) { ordnung = s; return q; }, range(a,b) { bereich = [a,b]; return q; },
      limit(n) { lim=n; return q; }, single() { einzeln=true; return q; }, maybeSingle() { einzeln=true; return q; },
      insert(w) { art='insert'; wert=w; return q; }, upsert(w) { art='upsert'; wert=w; return q; },
      update(w) { art='update'; wert=w; return q; }, delete() { art='delete'; return q; },
      then(res,rej) { return Promise.resolve().then(() => {
        const error=fehler(tabelle,art,bereich);
        if (error) return { data: null, error, count: null };
        const t=db[tabelle] ||= [];
        if (art==='upsert') {
          const z=t.find(z => z.user_id===wert.user_id && z.geraet===wert.geraet);
          if (z) { Object.assign(z,wert); return {data:z,error:null}; }
          wert={ id:crypto.randomUUID(),...wert }; t.push(wert); return {data:wert,error:null};
        }
        if (art==='insert') {
          const rows=(Array.isArray(wert)?wert:[wert]).map(z=>({id:'n'+ ++zaehler,created_at:'2026-11-10T18:00:00Z',...z}));
          t.push(...rows); return {data:einzeln?rows[0]:rows,error:null};
        }
        let rows=t.filter(z=>filter.every(f=>f(z)));
        if(art==='update') rows.forEach(z=>Object.assign(z,wert));
        if(art==='delete') db[tabelle]=t.filter(z=>!rows.includes(z));
        const count=rows.length;
        if(ordnung) rows=rows.slice().sort((a,b)=>String(a[ordnung]).localeCompare(String(b[ordnung])));
        if(bereich) rows=rows.slice(bereich[0],bereich[1]+1); else rows=rows.slice(0,1000);
        if(lim) rows=rows.slice(0,lim);
        if(tabelle==='chat_members' && spalten.includes('chats(')) rows=rows.map(z=>({...z,chats:db.chats.find(c=>c.id===z.chat_id)}));
        return {data:einzeln?rows[0]||null:rows,error:null,count};
      }).then(res,rej); }
    }; return q;
  }};
}
function app(speicher = {}, konten = [A,B]) {
  const secure = {
    getItemAsync: async k => speicher[k] ?? null,
    setItemAsync: async(k,v)=>{speicher[k]=v;}, deleteItemAsync:async k=>{delete speicher[k];}
  };
  const cache = new Map();
  function laden(datei) {
    if(cache.has(datei)) return cache.get(datei).exports;
    const m=new Module(path.join(W,datei)); m.filename=path.join(W,datei); cache.set(datei,m);
    const echt=m.require.bind(m);
    m.require=id=> {
      if(id==='expo-secure-store') return secure;
      if(id==='expo-crypto') return {getRandomBytes:crypto.randomBytes,randomUUID:crypto.randomUUID};
      if(id==='./kontenspeicher') return {gespeicherteKonten:async()=>konten};
      if(id==='./krypto') return laden('app/lib/krypto.ts');
      if(id==='./medien') return {};
      if(id==='../constants/supabase') return {SUPABASE_CONFIG:{}};
      return echt(id);
    };
    m._compile(ts.transpileModule(fs.readFileSync(m.filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,m.filename);
    return m.exports;
  }
  return { K:laden('app/lib/krypto.ts'), aktionen:()=>laden('app/lib/aktionen.ts'), speicher, secure };
}
function browser(konto, routen, speicher = {}) {
  const ctx={console,Uint8Array,crypto:{randomUUID:crypto.randomUUID,getRandomValues:crypto.randomFillSync},
    localStorage:{getItem:k=>speicher[k]??null,setItem:(k,v)=>{speicher[k]=v;},removeItem:k=>{delete speicher[k];}},
    fetch:async(url,opt)=>routen(url,opt),Anmeldung:{nutzer:()=>konto.id?{id:konto.id}:null,konten:()=>[{id:A},{id:B}]}};
  ctx.window=ctx;ctx.self=ctx;vm.createContext(ctx);
  for(const p of ['gemeinsam/tweetnacl.js','gemeinsam/krypto.js','web/public/krypto.js']) vm.runInContext(fs.readFileSync(path.join(W,p),'utf8'),ctx);
  return ctx;
}
const antwort = body => ({ok:true,json:async()=>body});
function basis() {
  const pa=Krypto.schluesselpaarErzeugen(),pb=Krypto.schluesselpaarErzeugen();
  return {chats:[{id:'zwei',is_group:false,bereich:'messenger'},{id:'gruppe',is_group:true}],
    chat_members:[{chat_id:'zwei',user_id:A},{chat_id:'zwei',user_id:B}],
    krypto_schluessel:[{id:'a',user_id:A,oeffentlich:pa.oeffentlich},{id:'b',user_id:B,oeffentlich:pb.oeffentlich}],
    messages:[],message_keys:[],contacts:[], pa,pb};
}


module.exports = { client, app, browser, antwort, basis, A, B, Krypto, schluesselHolen, S };
