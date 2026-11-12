const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W=path.resolve(__dirname,'../..');require(W+'/app/test/_offline_sperre.cjs');const ts=require(W+'/app/node_modules/typescript');
const Q=process.env.OPENCHAT_QUELLE||W;
const ast=ts.createSourceFile('app.js',fs.readFileSync(Q+'/web/public/app.js','utf8'),ts.ScriptTarget.Latest,true);
const fn=n=>ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text===n).getText(ast);
const tick=()=>new Promise(setImmediate);
function setup({group=true,holen,fetch,confirm=async()=>true}={}){
 const chat={id:'chat',name:'A',isGroup:group,userId:group?undefined:'person'},draws=[];const state={openChatId:null,messages:[],chats:[chat],communityChats:[],communities:[]};
 const c={console,state,draws,clearInterval(){},msgBezug:null,msgBearbeitet:null,nachrichtenHolen:holen,fetch:fetch|| (async()=>({ok:true,json:async()=>({ok:true,erlaubt:true})})),bestaetigen:confirm,
 ICONS:{},avatarOf:()=>'',mitStoryRing:()=>'',esc:x=>String(x),anfrageLeiste:()=>'',messengerLeiste:()=>'',chatGesperrt:()=>false};
 c.overlay={hidden:true,set innerHTML(v){draws.push({text:state.messages[0]?.text,name:state.chats[0].name,html:v});throw Error('PRUEFENDE_VOR_DOM_BINDUNGEN');}};
 vm.runInNewContext('let chatUhr=null;let chatNachsehenGeneration=0;'+fn('chatNachsehenStoppen')+fn('openChat'),c);
 return {c,state,chat,draws,start:()=>vm.runInNewContext('openChat("chat")',c).catch(e=>{if(e.message!=='PRUEFENDE_VOR_DOM_BINDUNGEN')throw e;})};
}
test('Initiales Promise.all: alte Neuöffnung derselben Chat-ID ersetzt neuen Kontoverlauf nicht',async()=>{
 let resolve,n=0;const h=setup({holen:()=>++n===1?new Promise(r=>resolve=r):Promise.resolve([{text:'Konto B'}])});
 const alt=h.start();await tick();h.state.chats=[{...h.chat,name:'B'}];await h.start();assert.equal(h.state.messages[0].text,'Konto B');
 resolve([{text:'Konto A alt'}]);await alt;assert.equal(h.state.messages[0].text,'Konto B');assert.equal(h.draws.length,1);
});
test('Verspätete DM-Antwort nach neuer Öffnung zeichnet nicht neu',async()=>{
 let resolve,n=0;const h=setup({group:false,holen:async()=>[{text:'Lesbar'}],fetch:async url=>url.startsWith('/api/dm-erlaubt/')?(++n===1?new Promise(r=>resolve=r):{ok:true,json:async()=>({erlaubt:true})}):{ok:true,json:async()=>({ok:true})}});
 const alt=h.start();await tick();await h.start();assert.equal(h.draws.length,1);resolve({ok:true,json:async()=>({erlaubt:false})});await alt;assert.equal(h.draws.length,1);assert.equal(h.chat.dmGesperrt,false);
});
test('Verspätetes DM-json nach Stop bleibt ohne UI- und Chatmutation',async()=>{
 let resolve;const h=setup({group:false,holen:async()=>[{text:'Lesbar'}],fetch:async url=>url.startsWith('/api/dm-erlaubt/')?{ok:true,json:()=>new Promise(r=>resolve=r)}:{ok:true,json:async()=>({ok:true})}});
 const p=h.start();await tick();vm.runInNewContext('chatNachsehenStoppen()',h.c);resolve({erlaubt:false});await p;assert.equal(h.draws.length,0);assert.equal(h.chat.dmGesperrt,false);
});
test('Alte Sperrbestätigung nach einer neueren Öffnung wird verworfen',async()=>{
 let resolve;const h=setup({holen:async()=>[{text:'Neu'}],confirm:()=>new Promise(r=>resolve=r)});h.chat.gesperrt=true;
 const alt=h.start();await tick();h.chat.gesperrt=false;await h.start();assert.equal(h.draws.length,1);resolve(true);await alt;assert.equal(h.draws.length,1);
});
