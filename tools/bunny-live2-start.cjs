/** Dienstschlüssel nur im Arbeitsspeicher abrufen und an einen Kindprozess geben. */
const {spawn}=require('child_process');
(async()=>{
 require('../app/test/_ki_belegung').pruefeBelegung();
 if(!process.env.SUPABASE_TOKEN)throw Error('Verwaltungstoken fehlt');
 const ref='ijztosbjfybdgotpdixw';
 const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`,{headers:{Authorization:`Bearer ${process.env.SUPABASE_TOKEN}`},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Dienstschlüsselabruf fehlgeschlagen: '+r.status);
 const keys=await r.json();const key=keys.find(k=>k.name==='service_role')?.api_key;
 if(!key)throw Error('Dienstschlüssel fehlt in Verwaltungsantwort');
 const args=process.argv.slice(2);
 const trocken=args[0]==='--trockenlauf';
 const env={...process.env,SUPABASE_SERVICE_ROLE_KEY:key,PORT:'3300'};
 const child=spawn(process.execPath,trocken?['tools/medien-umzug-bunny.mjs','--trockenlauf']:['web/server/lokal.js'],{env,stdio:'inherit'});
 for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>child.kill(s));
 child.on('exit',code=>{process.exitCode=code??1;});
})().catch(()=>{console.error('Start fehlgeschlagen; keine Zugangsdaten ausgegeben.');process.exitCode=1;});
