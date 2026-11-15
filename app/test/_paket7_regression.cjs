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
 vm.runInNewContext(`let listenKlingelDa=false,listenLetzteAbfrage=0,listenLaeuft=false,listenNochmal=false,listenSofort=false,listenGeneration=0,listenStand=null,chatListeAenderungen=0;`+fn('web/public/app.js','listeNachsehen')+';globalThis.run=listeNachsehen;',ctx);return ctx;}
test('Website-Chatliste lädt ersten Stand und wiederholt fehlgeschlagene Listenabrufe',async()=>{
 let n=0;const c=liste(async url=>({ok:true,json:async()=>url==='/api/chatstand'?{stand:'s'}:++n===1?{ok:false}:{ok:true,chats:[{id:'c',preview:'neu'}],communityChats:[]}}));
 await c.run(false,true);assert.equal(n,1);await c.run(false,true);assert.equal(n,2);assert.equal(c.state.chats[0].preview,'neu');await c.run(false,true);assert.equal(n,2);
});
test('Website-Chatliste bündelt Klingel während laufendem Abruf und holt danach nach',async()=>{
 let resolve,n=0;const c=liste(async url=>{if(url==='/api/chatstand'){n++;if(n===1)await new Promise(r=>resolve=r);return {ok:true,json:async()=>({stand:'s'+n})};}return {ok:true,json:async()=>({ok:true,chats:[{id:'c',preview:'Stand '+n}],communityChats:[]})};});
 const r=c.run(false,true);await tick();await c.run(false,true);await c.run(false,true);assert.equal(n,1);resolve();await r;await tick();assert.equal(n,2);assert.equal(c.state.chats[0].preview,'Stand 2');
});
test('Native Chatliste bestätigt fehlgeschlagenen Abruf nicht und lädt ersten Stand wirklich',async()=>{
 const file='app/contexts/DatenContext.tsx',s=fs.readFileSync(path.join(W,file),'utf8'),ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true);let effect;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('listenStand.current = null'))effect=n.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(effect);
 let poll,n=0,now=1,data={ichId:'a'};const ctx={console:{warn(){}},supabase:{},ichId:'a',listenStand:{current:null},ChatAbgleich:C,Date:{now:()=>now},AppState:{currentState:'active',addEventListener:()=>({remove(){}})},setInterval:f=>(poll=f,1),clearInterval(){},chatsNeuLaden(){},ladeChatlistenStand:async()=>'s',ladeChatlisten:async()=>{if(++n===1)throw Error('Ausfall');return {chats:[{id:'neu'}]};},setDaten:f=>data=f(data)};
 vm.runInNewContext(ts.transpileModule('const effect='+effect+';globalThis.stop=effect();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);await tick();assert.equal(ctx.listenStand.current,null);now+=10000;await poll();assert.equal(ctx.listenStand.current,'s');assert.equal(data.chats[0].id,'neu');ctx.stop();
});
test('Private Klingel setzt Sitzungstoken vor Subscribe; Abmelden vor getSession verhindert Join',async()=>{
 let resolve,sub=0,token,weg=0;const k={on(){return k;},subscribe(){assert.equal(token,'nur-test-token');sub++;}},client={auth:{getSession:()=>new Promise(r=>resolve=r)},realtime:{setAuth:async t=>token=t},channel:()=>k,removeChannel:async()=>weg++};
 const aus=C.klingelHoeren(client,'chat:x',()=>{});await tick();assert.equal(sub,0);resolve({data:{session:{access_token:'nur-test-token'}},error:null});await tick();assert.equal(sub,1);aus();
 const aus2=C.klingelHoeren(client,'chat:y',()=>{});await tick();aus2();resolve({data:{session:{access_token:'anderes-test-token'}},error:null});await tick();assert.equal(sub,1);assert.equal(weg,2);
});
