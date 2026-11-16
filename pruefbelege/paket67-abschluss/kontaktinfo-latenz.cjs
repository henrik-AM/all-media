// Original-Kontaktinfo mit drei kontrolliert langsamen Datenquellen, vollständig offline.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),ts=require('../../app/node_modules/typescript'),{chromium}=require('../../app/node_modules/playwright-core');
const src=fs.readFileSync(path.join(root,'web/public/app.js'),'utf8'),ast=ts.createSourceFile('app.js',src,ts.ScriptTarget.Latest,true);
const funktion=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='openContactProfile').getText(ast);
(async()=>{const b=await chromium.launch();try{
 const c=await b.newContext();let extern=0;await c.route('**/*',r=>{extern++;return r.abort();});const p=await c.newPage();
 await p.setContent('<div id="overlay" hidden></div>');
 await p.addScriptTag({content:`
 const overlay=document.querySelector('#overlay'),$=s=>document.querySelector(s),esc=x=>String(x??'');
 const state={chats:[{id:'chat',userId:'b',isGroup:false}],communityChats:[],contacts:[]};
 const user=()=>({id:'b',name:'Kontakt',handle:'@b'}),ICONS=new Proxy({}, {get:()=>''});
 const mitStoryRing=(_id,html)=>html,avatarForUser=()=>'<span>Kontakt</span>',einstellung=()=> 'Dunkel',profilZurueckNehmen=()=>null;
 window.Kontaktbild={FOTO_BEARBEITEN:'Foto bearbeiten'};window.trace=[];
 const langsam=async name=>{trace.push({name,at:performance.now()});await new Promise(r=>setTimeout(r,450));};
 window.fetch=async url=>{await langsam(url.includes('/medien')?'medien':'profil');return {json:async()=>url.includes('/medien')?{medien:[],markiert:[],gesamt:0}:{bio:'Echte Renderingfunktion'}};};
 const kryptoZustand=async()=>{await langsam('krypto');return {an:true};};
 ${funktion}
 window.pruefen=async()=>{const ab=performance.now();await openContactProfile('b');return {ms:performance.now()-ab,trace:trace.map(x=>({...x,at:x.at-ab})),zeilen:document.querySelectorAll('.kp__zeileText').length,design:document.querySelector('[data-kp-item="Chatdesign"] .kp__zeileWert').textContent};};`});
 const r=await p.evaluate(()=>pruefen());r.externeAnfragen=extern;fs.writeFileSync(process.env.AM_LATENZ_BELEG||path.join(__dirname,'kontaktinfo-latenz.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r));
 assert.equal(extern,0);assert.equal(r.trace.length,3);assert.ok(r.zeilen>=13);assert.equal(r.design,'Dunkel');assert.ok(r.ms<1000,'Drei unabhängige 450ms-Quellen sollen die Kontaktinfo nicht seriell blockieren: '+r.ms+'ms');console.log('1/1 Offline-Kontaktinfo-Latenzprüfung');
 }finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
