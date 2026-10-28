/** Alte Prüfläufe enthalten feste URLs. Nur im Prüflauf auf Codex-Port 3300 lenken. */
const Module=require('module');
const path=require('path');
const root=path.resolve(process.env.BUNNY_PRUEF_ROOT || __dirname)+path.sep;
const laden=Module._extensions['.js'];
Module._extensions['.js']=function(mod,datei){
 if(!datei.startsWith(root))return laden(mod,datei);
 const compile=mod._compile;
 mod._compile=function(text,name){return compile.call(this,text.replaceAll('http://localhost:3000','http://127.0.0.1:3300').replaceAll('http://127.0.0.1:3000','http://127.0.0.1:3300'),name);};
 return laden(mod,datei);
};
