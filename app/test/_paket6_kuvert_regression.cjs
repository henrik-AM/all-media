const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W=path.resolve(__dirname,'../..'),Q=process.env.KUVERT_FIX_QUELLE||W;
require(path.join(W,'app/test/_offline_sperre.cjs'));
const ts=require(path.join(W,'app/node_modules/typescript'));
const H=require(path.join(Q,'gemeinsam/kryptodaten.js'));
const m={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(Q,'gemeinsam/chatabgleich.js'),'utf8'),{module:m});const C=m.exports;
const id=n=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
function extract(f,name){const a=ts.createSourceFile(f,fs.readFileSync(path.join(Q,f),'utf8'),ts.ScriptTarget.Latest,true);return a.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(a).replace(/^export /,'');}
function dbClient(db){let calls=0;return {get calls(){return calls;},from:t=>{let key,ids;const q={select:()=>q,eq:(k,v)=>{if(k==='schluessel_id')key=v;return q;},in:(_,v)=>(ids=v,q),order:()=>q,limit:()=>q,then:(r,j)=>Promise.resolve().then(()=>{if(t==='message_keys'){calls++;assert.ok(ids.length<=100);return {data:db.keys.filter(z=>z.schluessel_id===key&&ids.includes(z.message_id)),error:null};}return {data:db.rows.slice(0,30),error:null};}).then(r,j)};return q;}};}
async function browser({initial=false,outside=false,fail=false}={}){
 const db={rows:initial?[{id:id(1)}]:[],keys:initial?[{message_id:id(1),schluessel_id:'own'}]:[]},client=dbClient(db);
 const api={ChatAbgleich:C,require:()=>H};vm.runInNewContext(extract('web/server/supabase-api.js','ladeChatStand')+';globalThis.laden=ladeChatStand;',api);
 let poll,loads=0,bad=fail;
 const state={openChatId:'chat',messages:initial?[{id:id(1),text:'Auf diesem Gerät nicht lesbar',kuvertFehlt:true,from:'me'}]:[]};
 const c={console,state,document:{hidden:false},window:{ChatAbgleich:C},chatUhr:null,chatNachsehenGeneration:0,clearInterval(){},setInterval:f=>(poll=f,1),$:()=>null,paintMessages(){},
 fetch:async(_u,opt)=>({ok:true,json:async()=>({stand:await api.laden(client,'chat',false,'own',opt?JSON.parse(opt.body).kuvertIds:[])})}),
 nachrichtenHolen:async()=>{loads++;if(bad){bad=false;throw Error('simulierter Lesefehler');}return db.rows.length?[{id:id(1),text:db.keys.some(k=>k.schluessel_id==='own')?'Geheim':'Auf diesem Gerät nicht lesbar',kuvertFehlt:!db.keys.some(k=>k.schluessel_id==='own'),from:'me'}]:[];}};
 vm.runInNewContext(extract('web/public/app.js','chatNachsehenStoppen')+';'+extract('web/public/app.js','chatNachsehenStarten')+';chatNachsehenStarten({id:"chat"});',c);await new Promise(setImmediate);
 if(initial){await poll();assert.equal(state.messages[0].text,'Geheim');return;}
 db.rows=[{id:id(1)}];await poll();assert.equal(state.messages[0].kuvertFehlt,true);
 if(outside)db.rows=Array.from({length:40},(_,i)=>({id:id(100+i)})).concat([{id:id(1)}]);
 db.keys=[{message_id:id(1),schluessel_id:'other'}];await poll();assert.equal(state.messages[0].kuvertFehlt,true);
 db.keys.push({message_id:id(1),schluessel_id:'own'});await poll();assert.equal(state.messages[0].text,'Geheim');
 const n=loads;await poll();await poll();assert.ok(loads<=n+1,'kein dauerndes Vollnachladen nach Heilung');
}
test('Browser: verspätetes eigenes Kuvert heilt, fremdes Gerät nicht',()=>browser());
test('Browser: Kuvert vor erster Standabfrage heilt Initialplatzhalter',()=>browser({initial:true}));
test('Browser: Pending-ID außerhalb des 30er-Fensters heilt',()=>browser({outside:true}));
test('Browser: gescheiterter Vollreload verbraucht Stand nicht',()=>browser({initial:true,fail:true}));
test('Pending: Klartext-Platzhalter und Absenderwarnung ohne Marker nicht abfragen',()=>{assert.deepEqual(Array.from(C.offeneKuvertIds([{id:id(1),text:'Auf diesem Gerät nicht lesbar'},{id:id(2),nichtPruefbar:true},{id:id(3),kuvertFehlt:true}])),[id(3)]);});
test('Kuvertabfrage: 500 IDs in5 Blöcken; Grenze/UUID strikt vor Zugriff',async()=>{const db={keys:[],rows:[]},c=dbClient(db);const ids=Array.from({length:500},(_,i)=>id(i));await H.kuvertStandHolen(c,'own',ids);assert.equal(c.calls,5);await assert.rejects(H.kuvertStandHolen(c,'own',ids.concat(id(501))),/500/);await assert.rejects(H.kuvertStandHolen(c,'own',['kaputt']),/UUID/);assert.equal(c.calls,5);});
test('App-Stand: keine Schlüsselregistrierung innerhalb periodischer Datenfunktion',async()=>{
 const db={rows:[{id:id(1)}],keys:[]},c=dbClient(db),a={ChatAbgleich:C,require:()=>H};
 vm.runInNewContext(ts.transpileModule(extract('app/lib/daten.ts','ladeChatStand')+';globalThis.laden=ladeChatStand;', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,a);
 const vorher=await a.laden(c,'chat',false,'own',[id(90)]);db.keys.push({message_id:id(90),schluessel_id:'own'});assert.notEqual(await a.laden(c,'chat',false,'own',[id(90)]),vorher);

});
test('App: echter Poll-Effekt registriert Gerät nur einmal und heilt verspätete Kuverts',async()=>{
 const file='app/screens/messenger/ChatDetailScreen.tsx',ast=ts.createSourceFile(file,fs.readFileSync(path.join(Q,file),'utf8'),ts.ScriptTarget.Latest,true);
 let effect;function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('let letzterStand: string | null'))effect=n.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(effect);
 const db={rows:[{id:id(1)}],keys:[]},c=dbClient(db);const a={ChatAbgleich:C,require:()=>H};vm.runInNewContext(ts.transpileModule(extract('app/lib/daten.ts','ladeChatStand')+';globalThis.laden=ladeChatStand;', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,a);
 let poll,registered=0;const ref={current:[{id:id(1),text:'Auf diesem Gerät nicht lesbar',kuvertFehlt:true,senderId:'me'}]};
 const ctx={console,supabase:c,ichId:'konto',chat:{id:'chat'},istKanal:false,messagesRef:ref,CURRENT_USER_ID:'me',ChatAbgleich:C,meinSchluessel:async()=>{registered++;return {id:'own'};},
 ladeChatStand:a.laden,ladeNachrichten:async()=>[{id:id(1),text:db.keys.length?'Geheim':'Auf diesem Gerät nicht lesbar',kuvertFehlt:!db.keys.length,senderId:'me'}],setMessages:f=>{ref.current=f(ref.current);},scrollToEnd(){},
 AppState:{currentState:'active',addEventListener:()=>({remove(){}})},setInterval:f=>(poll=f,1),clearInterval(){}};
 vm.runInNewContext(ts.transpileModule('const effekt='+effect+';globalThis.stop=effekt();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);await new Promise(setImmediate);
 await poll();await poll();assert.equal(registered,1);db.keys.push({message_id:id(1),schluessel_id:'own'});await poll();assert.equal(ref.current[0].text,'Geheim');await poll();assert.equal(registered,1);ctx.stop();
});
test('Browser-Krypto: fehlendes Kuvert markieren, kaputte Chiffre und Absenderwarnung nicht',async()=>{
 const base=require(path.join(W,'app/test/_paket6_hilfe.cjs'));
 const ctx=base.browser({id:base.A},()=>base.antwort({id:'own'}));
 vm.runInContext(fs.readFileSync(path.join(Q,'web/public/krypto.js'),'utf8'),ctx);
 await ctx.KryptoWeb.anmelden();
 const fehlend=ctx.KryptoWeb.oeffnen({id:id(1),krypto:1});assert.equal(fehlend.kuvertFehlt,true);
 const kaputt=ctx.KryptoWeb.oeffnen({id:id(2),krypto:1,kuvert:{nonce:'x',chiffre:'x'},chiffre:'x',kryptoNonce:'x',absenderSchluessel:'x'});assert.equal(kaputt.kuvertFehlt,false);
 assert.equal(kaputt._geoeffnet,false);
});
test('App-Krypto: fehlendes Kuvert markieren, kaputte Chiffre nicht',async()=>{
 const a={Krypto:{entschluesseln:()=>null},verschluesselteChats:new Set(),NICHT_LESBAR:'Auf diesem Gerät nicht lesbar'};
 vm.runInNewContext(ts.transpileModule(extract('app/lib/krypto.ts','aufschliessen')+';globalThis.oeffnen=aufschliessen;',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,a);
 const db={rows:[],keys:[]};const c=dbClient(db);const z={id:id(1),krypto:1};await a.oeffnen(c,[z],{id:'own',geheim:'mock'});assert.equal(z.kuvertFehlt,true);
 db.keys.push({message_id:id(1),schluessel_id:'own'});await a.oeffnen(c,[z],{id:'own',geheim:'mock'});assert.equal(z.kuvertFehlt,false);assert.equal(z._geoeffnet,false);
});
test('Geheilter Antwort-/Zitatbezug ersetzt alten Zustand bei gleichem Haupttext',()=>{
 for(const feld of ['antwortAuf','zitat']){
  const alt=[{id:id(1),text:'Haupttext unverändert',[feld]:{id:id(2),text:'Auf diesem Gerät nicht lesbar',kuvertFehlt:true}}];
  const neu=[{id:id(1),text:'Haupttext unverändert',[feld]:{id:id(2),text:'Geheimer Bezug',kuvertFehlt:false}}];
  const result=C.nachrichtenAbgleichen(alt,neu);assert.notEqual(result,alt);assert.equal(result[0][feld].text,'Geheimer Bezug');
 }
});
test('Browser: 500 Hauptnachrichten+500 Zitate werden über2 begrenzte Requests geheilt',async()=>{
 const original=Array.from({length:500},(_,i)=>({id:id(i),text:'unlesbar',kuvertFehlt:true,from:'me',zitat:{id:id(i+500),text:'unlesbar',kuvertFehlt:true}}));
 const db={rows:[{id:id(0)}],keys:[]},client=dbClient(db),api={ChatAbgleich:C,require:()=>H};
 vm.runInNewContext(extract('web/server/supabase-api.js','ladeChatStand')+';globalThis.laden=ladeChatStand;',api);
 let poll;const sizes=[],state={openChatId:'chat',messages:original};
 const ctx={console,state,document:{hidden:false},window:{ChatAbgleich:C},chatUhr:null,chatNachsehenGeneration:0,clearInterval(){},setInterval:f=>(poll=f,1),$:()=>null,paintMessages(){},
 fetch:async(_u,opt)=>{const ids=JSON.parse(opt.body).kuvertIds;sizes.push(ids.length);return {ok:true,json:async()=>({stand:await api.laden(client,'chat',false,'own',ids)})};},
 nachrichtenHolen:async()=>original.map(n=>({...n,text:db.keys.length?'Haupttext':'unlesbar',kuvertFehlt:!db.keys.length,zitat:{...n.zitat,text:db.keys.length?'Geheimer Bezug':'unlesbar',kuvertFehlt:!db.keys.length}}))};
 vm.runInNewContext(extract('web/public/app.js','chatNachsehenStoppen')+';'+extract('web/public/app.js','chatNachsehenStarten')+';chatNachsehenStarten({id:"chat"});',ctx);await new Promise(setImmediate);
 assert.deepEqual(sizes,[500,500]);db.keys=Array.from({length:1000},(_,i)=>({message_id:id(i),schluessel_id:'own'}));await poll();
 assert.deepEqual(sizes,[500,500,500,500]);assert.equal(state.messages.length,500);assert.ok(state.messages.every(n=>n.text==='Haupttext'&&n.zitat.text==='Geheimer Bezug'));
});
test('App: Nullschlüssel wird mit Backoff erneut versucht, erfolgreiche ID danach gecached',async()=>{
 const file='app/screens/messenger/ChatDetailScreen.tsx',ast=ts.createSourceFile(file,fs.readFileSync(path.join(Q,file),'utf8'),ts.ScriptTarget.Latest,true);let effect;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('let letzterStand: string | null'))effect=n.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);
 const db={rows:[{id:id(1)}],keys:[]},c=dbClient(db),a={ChatAbgleich:C,require:()=>H};vm.runInNewContext(ts.transpileModule(extract('app/lib/daten.ts','ladeChatStand')+';globalThis.laden=ladeChatStand;',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,a);
 let poll,registered=0,now=0;const ref={current:[{id:id(1),text:'unlesbar',kuvertFehlt:true,senderId:'me'}]};
 const ctx={console,Date:{now:()=>now},supabase:c,ichId:'konto',chat:{id:'chat'},istKanal:false,messagesRef:ref,CURRENT_USER_ID:'me',ChatAbgleich:C,meinSchluessel:async()=>++registered===1?null:{id:'own'},ladeChatStand:a.laden,
 ladeNachrichten:async()=>[{id:id(1),text:db.keys.length?'Geheim':'unlesbar',kuvertFehlt:!db.keys.length,senderId:'me'}],setMessages:f=>{ref.current=f(ref.current);},scrollToEnd(){},AppState:{currentState:'active',addEventListener:()=>({remove(){}})},setInterval:f=>(poll=f,1),clearInterval(){}};
 vm.runInNewContext(ts.transpileModule('const effekt='+effect+';globalThis.stop=effekt();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);await new Promise(setImmediate);
 assert.equal(registered,1);await poll();now=3999;await poll();assert.equal(registered,1);
 now=4000;db.keys.push({message_id:id(1),schluessel_id:'own'});await poll();assert.equal(registered,2);assert.equal(ref.current[0].text,'Geheim');
 now=100000;await poll();assert.equal(registered,2);ctx.stop();
});
