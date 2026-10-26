/** Offline, echter gemeinsamer Baustein und tatsächliche App-Persistenzfunktion. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const K=require('../../gemeinsam/karussell');
let n=0;async function test(name,f){await f();console.log(`OK ${++n} ${name}`);}
(async()=>{
 const medien=Array.from({length:101},(_,i)=>({url:`file:///${i}.${i%2?'mp4':'jpg'}`,typ:i%2?'video':'image'}));
 await test('101 gemischte Aufnahmen ohne Stückgrenze',()=>assert.equal(K.liste({medien}).length,101));
 await test('Verschieben bewahrt alle Aufnahmen und Eingabe',()=>{const r=K.verschieben(medien,100,0);assert.equal(r[0].url,medien[100].url);assert.equal(r.length,101);assert.equal(medien[0].url,'file:///0.jpg');});
 await test('Entfernen bewahrt Reihenfolge',()=>{const r=K.entfernen(medien,1);assert.equal(r.length,100);assert.equal(r[1].url,'file:///2.jpg');});
 await test('Ungültiges Verschieben verändert nichts',()=>assert.deepEqual(K.verschieben(medien,-1,10),medien));
 await test('Alter Bildbeitrag bleibt lesbar',()=>assert.deepEqual(K.liste({mediaUri:'https://lokal/a.jpg'}),[{url:'https://lokal/a.jpg',typ:'image'}]));
 await test('Alter Videobeitrag mit Signatur bleibt lesbar',()=>assert.equal(K.liste({mediaUrl:'https://lokal/a.mp4?token=x'})[0].typ,'video'));
 await test('Leerer Altbeitrag bleibt leer',()=>assert.deepEqual(K.liste({}),[]));
 await test('Neue Liste hat Vorrang vor Titelmedium',()=>assert.equal(K.liste({mediaUrl:'alt',medien})[0].url,medien[0].url));
 await test('Falsche Typen werden verständlich zurückgewiesen',()=>assert.match(K.pruefen([{url:'x',typ:'html'}]),/ungültig/));
 const code=ts.transpileModule(fs.readFileSync(__dirname+'/../lib/aktionen.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const ex={};vm.runInNewContext(code,{exports:ex,module:{exports:ex},require:name=>name.includes('gemeinsam/')?require(name):{},console});
 await test('App schreibt gesamte Reihenfolge atomar mit Beitrag; lokale Zusatzwerte entfallen',async()=>{let geschrieben;const client={from:t=>{assert.equal(t,'posts');return {insert:b=>{geschrieben=b;return {select:()=>({single:async()=>({data:{id:'echt'}})})};}}}};const list=[{url:'https://lokal/b.jpg',typ:'image',mime:'image/jpeg'},{url:'https://lokal/v.mp4',typ:'video',sekunden:1200}];assert.equal(await ex.beitragAnlegen(client,'ich',{art:'post',medien:list,mediaUrl:list[0].url}),'echt');assert.equal(JSON.stringify(geschrieben.medien),JSON.stringify(list.map(({url,typ})=>({url,typ}))));});
 await test('App-Persistenzfehler wird nicht zum Erfolg',async()=>{const client={from:()=>({insert:()=>({select:()=>({single:async()=>({error:Error('abgelehnt')})})})})};await assert.rejects(ex.beitragAnlegen(client,'ich',{medien}),/abgelehnt/);});
 console.log(`${n}/${n} Prüfungen bestanden`);
})().catch(e=>{console.error(e);process.exitCode=1;});
