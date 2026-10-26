const assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript'),{quelle}=require('./_af_fix_quelle');
const tree=ts.createSourceFile('profil.tsx',quelle('app/contexts/ProfilContext.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function suche(n,p){if(p(n))return n;let r;ts.forEachChild(n,c=>{if(!r)r=suche(c,p);});return r;}
const init=suche(tree,n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='clipUmschalten').initializer;
(async()=>{let clips=[{id:'c',disliked:false}],meldung='';const jobs=[];const aktionen=new Proxy({},{get:()=>async()=>{throw Error('Offline');}});
 const env={useCallback:f=>f,clips,setClips:f=>{clips=f(clips);},reaktion:require('../../gemeinsam/rang').reaktion,Aktion:aktionen,schreiben:(text,tun,zurueck)=>jobs.push(tun({},'a').catch(()=>{meldung=text;zurueck();})),module:{exports:{}}};
 vm.runInNewContext(ts.transpileModule('module.exports='+init.getText(tree),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,env);
 env.module.exports('c','dislike');await Promise.all(jobs);assert.equal(meldung,'Die Negativreaktion');assert.equal(clips[0].disliked,false);console.log('OK 1 Negativreaktion korrekt benannt und nach Schreibfehler zurückgesetzt');console.log('1/1 Prüfungen bestanden');
})().catch(e=>{console.error(e);process.exitCode=1;});
