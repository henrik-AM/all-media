/** Vorher/Nachher ohne Worktree-Wechsel: feste überprüfte Vorgängerrevision. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),Module=require('node:module');
const root=path.resolve(__dirname,'../..');
function quelle(datei){return process.env.AF_FIX_BASIS?execFileSync('git',['show','a5eccc5:'+datei],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,datei),'utf8');}
function laden(datei){const name=path.join(root,datei),m=new Module(name,module);m.filename=name;m.paths=Module._nodeModulePaths(path.dirname(name));m._compile(quelle(datei),name);return m.exports;}
module.exports={quelle,laden};
