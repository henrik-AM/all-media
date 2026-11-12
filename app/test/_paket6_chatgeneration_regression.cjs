const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W=path.resolve(__dirname,'../..');require(W+'/app/test/_offline_sperre.cjs');const ts=require(W+'/app/node_modules/typescript');
const Q=process.env.CHAT_GENERATION_QUELLE||W;
const text=fs.readFileSync(Q+'/web/public/app.js','utf8');const ast=ts.createSourceFile('app.js',text,ts.ScriptTarget.Latest,true);
const fn=name=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(ast);
function harness({fetch,holen}){
 let timer=0;const active=new Map(),state={openChatId:'chat',messages:[]},ctx={console,state,document:{hidden:false},window:{},$:()=>null,paintMessages(){},fetch,nachrichtenHolen:holen,
 setInterval:f=>{active.set(++timer,f);return timer;},clearInterval:id=>active.delete(id)};
 vm.runInNewContext('let chatUhr=null;let chatNachsehenGeneration=0;'+fn('chatNachsehenStoppen')+fn('chatNachsehenStarten'),ctx);
 return {ctx,state,active,start:()=>vm.runInNewContext('chatNachsehenStarten({id:"chat"})',ctx),stop:()=>vm.runInNewContext('chatNachsehenStoppen()',ctx)};
}
const tick=()=>new Promise(setImmediate),response=()=>({ok:true,json:async()=>({stand:'s'})});
test('Neuöffnung derselben Chat-ID: alte Verlaufantwort überschreibt neues Konto nicht',async()=>{
 let firstResolve,loads=0;const h=harness({fetch:async()=>response(),holen:async()=>++loads===1?new Promise(r=>firstResolve=r):[{id:'m',text:'Konto B'}]});
 h.start();await tick();const altTimer=[...h.active.keys()][0];h.start();await tick();assert.equal(h.state.messages[0].text,'Konto B');
 const neuTimer=[...h.active.keys()][0];assert.notEqual(neuTimer,altTimer);firstResolve([{id:'m',text:'Konto A alt'}]);await tick();
 assert.equal(h.state.messages[0].text,'Konto B');assert.deepEqual([...h.active.keys()],[neuTimer]);
});
test('Veraltete Standantwort startet keinen Verlaufabruf nach Neuöffnung',async()=>{
 let resolve,fragen=0,loads=0;const h=harness({fetch:async()=>++fragen===1?new Promise(r=>resolve=r):response(),holen:async()=>{loads++;return [{id:'m',text:'Konto B'}];}});
 h.start();h.start();await tick();assert.equal(loads,1);resolve(response());await tick();assert.equal(loads,1);assert.equal(h.state.messages[0].text,'Konto B');
});
test('Stop invalidiert laufenden Abruf und bereits eingereihte alte Timeraufrufe',async()=>{
 let resolve,fragen=0;const h=harness({fetch:async()=>{fragen++;return response();},holen:()=>new Promise(r=>resolve=r)});
 h.start();await tick();const callback=[...h.active.values()][0];h.stop();assert.equal(h.active.size,0);resolve([{id:'m',text:'alt'}]);await tick();assert.equal(h.state.messages.length,0);
 await callback();assert.equal(fragen,1);assert.equal(h.active.size,0);
});
test('Stop während json-await invalidiert dieselbe Chat-ID vor UI-Aktualisierung',async()=>{
 let resolve,fragen=0,loads=0;const h=harness({fetch:async()=>++fragen===1?{ok:true,json:()=>new Promise(r=>resolve=r)}:response(),holen:async()=>{loads++;return [{id:'m',text:'Konto B'}];}});
 h.start();await tick();h.start();await tick();resolve({stand:'alterStand'});await tick();assert.equal(loads,1);assert.equal(h.state.messages[0].text,'Konto B');
});
