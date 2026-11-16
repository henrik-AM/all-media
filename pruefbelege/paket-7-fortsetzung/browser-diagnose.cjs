// Nur Zeit-/Netzdiagnose, keine Antwortkörper oder Geheimnisse.
const path=require('path');const app=path.resolve(__dirname,'../../app');
const stamp=()=>new Date().toISOString();let n=0;
function hook(p){if(p.__diagnose)return p;p.__diagnose=true;
for(const name of ['goto','reload','evaluate','click','waitForSelector']){const orig=p[name].bind(p);p[name]=async(...args)=>{const id=++n;console.log(stamp(),'START',id,name,name==='click'?String(args[0]):'');try{const r=await orig(...args);console.log(stamp(),'ENDE',id,name);return r;}catch(e){console.log(stamp(),'FEHLER',id,name,String(e.message).slice(0,180));throw e;}};}
p.on('requestfailed',r=>{const u=new URL(r.url());console.log(stamp(),'NETZFEHLER',u.origin+u.pathname,r.failure()?.errorText);});p.on('response',r=>{if(r.status()>=400){const u=new URL(r.url());console.log(stamp(),'HTTP',r.status(),u.origin+u.pathname);}});return p;}
const {chromium}=require(path.join(app,'node_modules/playwright-core'));const orig=chromium.launch.bind(chromium);chromium.launch=async(...a)=>{const b=await orig(...a);const np=b.newPage.bind(b),nc=b.newContext.bind(b);b.newPage=async(...x)=>hook(await np(...x));b.newContext=async(...x)=>{const c=await nc(...x);c.on('page',hook);return c;};return b;};
