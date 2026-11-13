const cp=require('node:child_process'),path=require('node:path');
const W=path.resolve(__dirname,'../../..');
process.loadEnvFile('/Users/henrik.dikta/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/All-Media/app/.env.local');
const {TESTKONTO_PASS,PRUEFKONTO_PASS}=require(path.join(W,'app/test/_testpasswoerter.js'));
const u='5210E675-C198-4328-B3E2-30FCE9E0F624',i=Number(process.argv[2]||0),daten=i?['all.media.prueflauf@web.de',PRUEFKONTO_PASS]:['test@all-media.app',TESTKONTO_PASS];
try{for(let j=0;j<2;j++){
 const xs=JSON.parse(cp.execFileSync('axe',['describe-ui','--udid',u],{encoding:'utf8'})),rs=[];
 const walk=xs=>{for(const x of xs){if(x.type==='TextField'||x.type==='SecureTextField')rs.push(x);walk(x.children||[])}};walk(xs);
 const kandidaten=rs.length===2?[rs[j]]:[];
 if(kandidaten.length!==1)throw Error('Feld nicht eindeutig');const f=kandidaten[0].frame;
 cp.execFileSync('axe',['touch','-x',String(f.x+f.width-5),'-y',String(f.y+f.height/2),'--down','--up','--delay','0.12','--udid',u],{stdio:'ignore'});
 cp.execFileSync('axe',['key-sequence','--keycodes',Array(100).fill('42').join(','),'--delay','0.005','--udid',u],{stdio:'ignore'});
 cp.execFileSync('axe',['type','--stdin','--udid',u],{input:daten[j],stdio:['pipe','ignore','ignore']});
}console.log('Anmeldefelder des Testkontos '+(i?'B':'A')+' ausgefüllt; Geheimnisse nicht protokolliert.');}
catch(e){console.error('Anmeldefelder konnten nicht eindeutig ausgefüllt werden.');process.exitCode=1;}
