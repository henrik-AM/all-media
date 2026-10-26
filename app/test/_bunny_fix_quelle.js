/** Originalrevision ausführbar laden, ohne den Arbeitsbaum umzuschalten. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),Module=require('node:module');
const root=path.resolve(__dirname,'../..');
function quelle(datei){return process.env.BUNNY_FIX_BASIS?execFileSync('git',['show',process.env.BUNNY_FIX_BASIS+':'+datei],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,datei),'utf8');}
function laden(datei,ersatz={}){const name=path.join(root,datei),m=new Module(name,module);m.filename=name;m.paths=Module._nodeModulePaths(path.dirname(name));const original=m.require.bind(m);m.require=id=>id in ersatz?ersatz[id]:original(id);let code=quelle(datei);if(/\.tsx?$/.test(datei))code=require('typescript').transpileModule(code,{compilerOptions:{module:1,target:9,jsx:2,esModuleInterop:true}}).outputText;m._compile(code,name);return m.exports;}
module.exports={quelle,laden,root};
