/** B4 Nachtrag: gezielt geöffnete Fremdbeiträge (nurEinzeln) erscheinen nicht in Suche/Explorer — App und Website, Originalquelltext. */
const assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm'),{quelle}=require('./_bunny_fix_quelle');
let n=0,ok=0;function test(s,f){n++;try{f();ok++;console.log(`OK ${n} ${s}`);}catch(e){process.exitCode=1;console.log(`ROT ${n} ${s}: ${e.message.split('\n')[0]}`);}}
function knoten(datei,treffer){const kind=/\.tsx$/.test(datei)?ts.ScriptKind.TSX:ts.ScriptKind.JS,a=ts.createSourceFile(datei,quelle(datei),ts.ScriptTarget.Latest,true,kind);let k;(function suche(x){if(!k&&treffer(x,a))k=x;ts.forEachChild(x,suche);})(a);assert.ok(k,`${datei}: Stelle nicht gefunden`);return k.getText(a);}
function ausfuehren(code,env){const ctx={module:{exports:{}},...env};vm.runInNewContext(ts.transpileModule('module.exports='+code,{compilerOptions:{module:1,target:9}}).outputText,ctx);return ctx.module.exports;}
const memo=(datei,name)=>knoten(datei,(x,a)=>ts.isVariableDeclaration(x)&&x.name.getText(a)===name&&x.initializer&&ts.isCallExpression(x.initializer)?true:false).replace(/^[^=]+=\s*useMemo\(/,'').replace(/,\s*\[[^\]]*\]\s*\)\s*$/,'');
const ids=l=>Array.from(l,x=>x.id).sort();
const e=(id,extra={})=>({id,userId:'u',title:'Probe',description:'Probe',music:'Lied',tags:['probe'],location:'Ort',likes:0,views:0,...extra});
const normal={posts:[e('p-normal')],videos:[e('v-normal')],clips:[e('c-normal')]};
const einzeln={posts:[e('p-einzeln',{nurEinzeln:true})],videos:[e('v-einzeln',{nurEinzeln:true})],clips:[e('c-einzeln',{nurEinzeln:true})]};
const alle=k=>[...normal[k],...einzeln[k]];
const app={eigeneBeitraege:[],eigeneVideos:[],alleBeitraege:alle('posts'),alleVideos:alle('videos'),clips:alle('clips'),alleNutzer:{u:{id:'u',name:'Nutzer',handle:'n'}},alleHashtags:[],alleOrte:[],alleSounds:[],folgtPerson:()=>false,nachInteresse:l=>l};

const explorer=memo('app/screens/videos/ExplorerScreen.tsx','treffer');
for(const [art,feld,k] of [['reels','reels','videos'],['querformat','clips','clips'],['beitraege','beitraege','posts']])
 test(`App Explorer-Übersicht ${art} ohne Einzelöffnung`,()=>{const r=ausfuehren(explorer,{...app,ziel:{art,suche:''},uebersicht:true})();assert.deepEqual(ids(r[feld]),ids(normal[k]));});
test('App Explorer Hashtag ohne Einzelöffnung',()=>{const r=ausfuehren(explorer,{...app,ziel:{art:'hashtag',wert:'probe'},uebersicht:false})();assert.deepEqual([...ids(r.reels),...ids(r.clips),...ids(r.beitraege)],['v-normal','c-normal','p-normal']);});
test('App Videosuche ohne Einzelöffnung',()=>{const r=ausfuehren(memo('app/screens/videos/VideoSearchScreen.tsx','allResults'),{...app,query:''})();assert.deepEqual([...ids(r.reels),...ids(r.clips),...ids(r.posts)],['v-normal','c-normal','p-normal']);});

const web='web/public/app.js',state={posts:alle('posts'),videos:alle('videos'),clips:alle('clips'),videoSearchQuery:'',users:{},hashtags:[],places:[{id:'o',name:'Ort'}],sounds:[]};
const webEnv={state,user:()=>({name:'Nutzer',handle:'n'}),nachInteresse:l=>l,vonGefolgten:()=>false,folgtPerson:()=>false};
test('Website Videosuche/Explorer-Übersichten ohne Einzelöffnung',()=>{const f=knoten(web,(x,a)=>ts.isFunctionDeclaration(x)&&x.name?.getText(a)==='suchTreffer');const r=ausfuehren(`(()=>{${f};return suchTreffer;})()`,webEnv)();assert.deepEqual([...ids(r.reels),...ids(r.clips),...ids(r.posts)],['v-normal','c-normal','p-normal']);});
for(const [fn,env] of [['renderHashtagExplorer',{tag:'probe'}],['renderPlaceExplorer',{place:state.places[0]}]])
 test(`Website ${fn} ohne Einzelöffnung`,()=>{const f=knoten(web,(x,a)=>ts.isFunctionDeclaration(x)&&x.name?.getText(a)===fn);const items=knoten(web,(x,a)=>ts.isVariableDeclaration(x)&&x.name.getText(a)==='items'&&x.getStart(a)>quelle(web).indexOf('function '+fn));void f;const r=ausfuehren(items.replace(/^items\s*=\s*/,''),{...webEnv,...env});assert.deepEqual(ids(r),['c-normal','p-normal','v-normal']);});
console.log(`${ok}/${n} Prüfungen bestanden`);
