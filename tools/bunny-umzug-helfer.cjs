/** Geheimnisse bleiben im Prozess; gemeinsam für diesen kontrollierten Umzug. */
const fs=require('fs');
const assert=require('assert/strict');
const basis='https://ijztosbjfybdgotpdixw.supabase.co';
async function frage(query){
 const r=await fetch('https://api.supabase.com/v1/projects/ijztosbjfybdgotpdixw/database/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)});
 assert.ok(r.ok,'Management SQL Status '+r.status);const data=await r.json();assert.ok(Array.isArray(data),'SQL lieferte keine Zeilen');return data;
}
async function dienst(){
 const r=await fetch('https://api.supabase.com/v1/projects/ijztosbjfybdgotpdixw/api-keys?reveal=true',{headers:{Authorization:'Bearer '+process.env.SUPABASE_TOKEN},signal:AbortSignal.timeout(30000)});
 assert.ok(r.ok,'Dienstschlüsselabruf Status '+r.status);const k=(await r.json()).find(k=>k.name==='service_role')?.api_key;assert.ok(k);return k;
}
function testumgebung(){
 const p=process.env.BUNNY_UMZUG_TESTUMGEBUNG;
 if(p){const s=fs.readFileSync(p,'utf8');for(const k of ['AM_TESTKONTO_PASS','AM_PRUEFKONTO_PASS'])process.env[k]||=s.match(new RegExp('^'+k+'=(.*)$','m'))?.[1]?.trim();}
 assert.ok(process.env.AM_TESTKONTO_PASS&&process.env.AM_PRUEFKONTO_PASS,'Testpasswörter fehlen');
}
module.exports={frage,dienst,testumgebung,basis};
