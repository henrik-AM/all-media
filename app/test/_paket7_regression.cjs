require('./_offline_sperre.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const W=path.resolve(__dirname,'../..'),C=require('../../gemeinsam/chatabgleich');
function fn(file,name){const s=fs.readFileSync(path.join(W,file),'utf8'),ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true);return ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(ast).replace(/^export /,'');}
const tick=()=>new Promise(setImmediate),warte=ms=>new Promise(r=>setTimeout(r,ms));
test('Dauernde Klingeln werden begrenzt gebündelt und nie endlos verschoben',async()=>{
 let callback,entfernt=0,n=0;const kanal={on:(_a,_b,f)=>(callback=f,kanal),subscribe:()=>kanal},client={channel:()=>kanal,removeChannel:async()=>entfernt++};
 const aus=C.klingelHoeren(client,'chat:x',()=>n++);let timer=setInterval(()=>callback(),35);
 try{await warte(650);assert.ok(n>=2&&n<=3,'während Dauerstrom zweimal nachsehen: '+n);}finally{clearInterval(timer);aus();}await warte(300);assert.equal(n,2);assert.equal(entfernt,1);
});
test('Abofehler räumt schon angelegten Kanal und Timer auf',async()=>{
 let n=0;const k={on(){return k;},subscribe(){throw Error('Abofehler');}};let verbunden;
 const aus=C.klingelHoeren({channel:()=>k,removeChannel:async()=>n++},'chat:x',()=>assert.fail('kein Nachsehen'),v=>verbunden=v);aus();await tick();assert.equal(n,1);assert.equal(verbunden,false);
});
for(const app of [false,true])test((app?'App':'Server')+': fehlgeschlagene Reaktionsabfrage bestätigt keinen leeren Stand',async()=>{
 const ctx={ChatAbgleich:C,require:()=>({kuvertStandHolen:async()=>''})},src=fn(app?'app/lib/daten.ts':'web/server/supabase-api.js','ladeChatStand');
 vm.runInNewContext(ts.transpileModule(src+';globalThis.laden=ladeChatStand;',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);
 const client={from:t=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,in:()=>q,then:r=>r(t==='message_reactions'?{data:null,error:Error('Ausfall')}:{data:[{id:'m'}],error:null})};return q;}};
 if(app)assert.equal(await ctx.laden(client,'chat'),null);else await assert.rejects(ctx.laden(client,'chat'),/Ausfall/);
});
function liste(fetch){const ctx={console,fetch,Date,document:{hidden:false,activeElement:null},window:{Anmeldung:{angemeldet:()=>true,nutzer:()=>({id:'a'})},ChatAbgleich:C},state:{openChatId:'chat'},vorschauenOeffnen(){},main:{contains:()=>false},render(){}};
 vm.runInNewContext(`let listenKlingelDa=false,listenLetzteAbfrage=0,listenLaeuft=false,listenNochmal=false,listenSofort=false,listenGeneration=0,listenKuvertVersion=0,listenKuvertBestaetigt=0,listenStand=null,chatListeAenderungen=0;`+fn('web/public/app.js','listeNachsehen')+';globalThis.run=listeNachsehen;globalThis.kuvert=()=>{listenKuvertVersion++;return listeNachsehen(false,true);};',ctx);return ctx;}
test('Website-Chatliste lädt ersten Stand und wiederholt fehlgeschlagene Listenabrufe',async()=>{
 let n=0;const c=liste(async url=>({ok:true,json:async()=>url==='/api/chatstand'?{stand:'s'}:++n===1?{ok:false}:{ok:true,chats:[{id:'c',preview:'neu'}],communityChats:[]}}));
 await c.run(false,true);assert.equal(n,1);await c.run(false,true);assert.equal(n,2);assert.equal(c.state.chats[0].preview,'neu');await c.run(false,true);assert.equal(n,2);c.document.hidden=true;await c.kuvert();assert.equal(n,2);c.document.hidden=false;await c.run(false,true);assert.equal(n,3,'Kuvert aus Hintergrund lädt trotz identischem Stand nach');
});
test('Website-Chatliste bündelt Klingel während laufendem Abruf und holt danach nach',async()=>{
 let resolve,n=0;const c=liste(async url=>{if(url==='/api/chatstand'){n++;if(n===1)await new Promise(r=>resolve=r);return {ok:true,json:async()=>({stand:'s'+n})};}return {ok:true,json:async()=>({ok:true,chats:[{id:'c',preview:'Stand '+n}],communityChats:[]})};});
 const r=c.run(false,true);await tick();await c.run(false,true);await c.run(false,true);assert.equal(n,1);resolve();await r;await tick();assert.equal(n,2);assert.equal(c.state.chats[0].preview,'Stand 2');
});
test('Native Chatliste bestätigt fehlgeschlagenen Abruf nicht und lädt ersten Stand wirklich',async()=>{
 const file='app/contexts/DatenContext.tsx',s=fs.readFileSync(path.join(W,file),'utf8'),ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true);let effect;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('listenStand.current = null'))effect=n.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(effect);
 let poll,klingel,aktiv,n=0,now=1,data={ichId:'a'};const ctx={console:{warn(){}},supabase:{},ichId:'a',listenStand:{current:null},chatListenLauf:{current:0},setChatsGelesenSeit(){},ChatAbgleich:{...C,klingelHoeren:(_c,_t,f)=>(klingel=f,()=>{})},Date:{now:()=>now},AppState:{currentState:'active',addEventListener:(_e,f)=>(aktiv=f,{remove(){}})},setInterval:f=>(poll=f,1),clearInterval(){},chatsNeuLaden(){},ladeChatlistenStand:async()=>'s',ladeChatlisten:async()=>{if(++n===1)throw Error('Ausfall');return {chats:[{id:'neu'}]};},setDaten:f=>data=f(data)};
 vm.runInNewContext(ts.transpileModule('const effect='+effect+';globalThis.stop=effect();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);await tick();assert.equal(ctx.listenStand.current,null);now+=10000;await poll();assert.equal(ctx.listenStand.current,'s');assert.equal(data.chats[0].id,'neu');ctx.AppState.currentState='background';klingel('kuvert');await tick();assert.equal(n,2);ctx.AppState.currentState='active';aktiv('active');await tick();assert.equal(n,3,'Kuvert aus Hintergrund lädt trotz identischem Stand nach');ctx.stop();
});
test('Private Klingel setzt Sitzungstoken vor Subscribe; Abmelden vor getSession verhindert Join',async()=>{
 let resolve,sub=0,token,weg=0;const k={on(){return k;},subscribe(){assert.equal(token,'nur-test-token');sub++;}},client={auth:{getSession:()=>new Promise(r=>resolve=r)},realtime:{setAuth:async t=>token=t},channel:()=>k,removeChannel:async()=>weg++};
 const aus=C.klingelHoeren(client,'chat:x',()=>{});await tick();assert.equal(sub,0);resolve({data:{session:{access_token:'nur-test-token'}},error:null});await tick();assert.equal(sub,1);aus();
 const aus2=C.klingelHoeren(client,'chat:y',()=>{});await tick();aus2();resolve({data:{session:{access_token:'anderes-test-token'}},error:null});await tick();assert.equal(sub,1);assert.equal(weg,2);
});

test('Kuvert-Signal überlebt die Bündelung mit gewöhnlichen Klingeln',async()=>{
 let callback,art;const k={on(_a,_b,f){callback=f;return k;},subscribe(){}};
 const aus=C.klingelHoeren({channel:()=>k,removeChannel:async()=>{}},'nutzer:a',a=>art=a);
 callback({payload:{art:'kuvert'}});callback({payload:{art:'liste'}});await warte(300);assert.equal(art,'kuvert');aus();
});

// Originale DatenContext-Funktionen: Reihenfolge expliziter Abrufe und Klingeln.
function listenRennen(){
 const file='app/contexts/DatenContext.tsx',text=fs.readFileSync(path.join(W,file),'utf8'),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);let reload,effect;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='chatsNeuLaden')reload=n.initializer.arguments[0].getText(ast);if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('listenStand.current = null'))effect=n.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(reload&&effect);
 let now=1,data={ichId:'a'},poll,klingel;const pending=[];
 const ctx={console:{warn(){}},supabase:{},ichId:'a',listenStand:{current:null},chatListenLauf:{current:0},Date:{now:()=>now},ChatAbgleich:{...C,klingelHoeren:(_c,_t,f)=>(klingel=f,()=>{})},AppState:{currentState:'active',addEventListener:()=>({remove(){}})},setInterval:f=>(poll=f,1),clearInterval(){},setChatsGelesenSeit:v=>ctx.seit=v,ladeChatlistenStand:async()=>'stand',ladeChatlisten:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),setDaten:f=>data=f(data)};
 vm.runInNewContext(ts.transpileModule('const chatsNeuLaden='+reload+';const effect='+effect+';globalThis.reload=chatsNeuLaden;globalThis.stop=effect();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);
 return {ctx,pending,get data(){return data;},now:v=>now=v,signal:()=>klingel('nachricht'),stop:()=>ctx.stop()};
}
test('Native Liste: alte Klingelantwort überschreibt neueren expliziten Abruf nicht',async()=>{const h=listenRennen();await tick();h.now(20);const neu=h.ctx.reload();assert.equal(h.pending.length,2);h.pending[1].resolve({chats:[{id:'neu'}]});assert.equal(await neu,true);h.pending[0].resolve({chats:[{id:'alt'}]});await tick();assert.equal(h.data.chats[0].id,'neu');assert.equal(h.ctx.listenStand.current,null,'verworfene Antwort bestätigt keinen Stand');h.stop();});
test('Native Liste: spätere Antwort eines älteren expliziten Abrufs wird verworfen',async()=>{const h=listenRennen();await tick();h.pending[0].resolve({chats:[{id:'start'}]});await tick();const alt=h.ctx.reload(),neu=h.ctx.reload();h.pending[2].resolve({chats:[{id:'neu'}]});assert.equal(await neu,true);h.pending[1].resolve({chats:[{id:'alt'}]});assert.equal(await alt,false);assert.equal(h.data.chats[0].id,'neu');h.stop();});
test('Native Liste: erfolgreicher unveränderter Stand belegt Frische nach Lesefehler',async()=>{const h=listenRennen();await tick();h.pending[0].resolve({chats:[{id:'start',muted:false}]});await tick();const vorher=h.ctx.seit;h.now(100);const fehl=h.ctx.reload();h.pending[1].reject(Error('Lesefehler'));assert.equal(await fehl,false);h.now(200);h.signal();await tick();assert.equal(h.pending.length,2,'gleicher Stand braucht keinen neuen Vollabruf');assert.ok(h.ctx.seit>vorher);assert.equal(h.ctx.seit,200);assert.equal(h.data.chats[0].muted,false);h.stop();});
