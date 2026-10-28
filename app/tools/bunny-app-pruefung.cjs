// Begleitprobe zur echten Simulatorbedienung. Kein Reset, keine Schreibzugriffe.
// Tokens und signierte URLs bleiben ausschließlich im Arbeitsspeicher.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { createClient } = require('@supabase/supabase-js');
require('../test/_ki_belegung').pruefeBelegung('testbestand');
const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const wert = n => (env.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1]?.trim();
const client = createClient(wert('EXPO_PUBLIC_SUPABASE_URL'), wert('EXPO_PUBLIC_SUPABASE_ANON_KEY'), {auth:{persistSession:false,autoRefreshToken:false}});
const basis = 'https://all-media-website.onrender.com';
const belege = new Map();
let ich, token, anfang;
const protokoll = z => console.log(JSON.stringify({zeit:new Date().toISOString(),...z}));
async function bestand() {
  const {data,error} = await client.from('posts').select('id,kind,description,media_url,thumbnail_url').eq('user_id',ich).order('created_at',{ascending:false});
  if(error) throw error;
  return data;
}
async function befehl(s) {
  const alle = await bestand();
  const eigene = alle.filter(p=>p.description.startsWith('Bunny-App 28.10.2026'));
  protokoll({befehl:s,eigeneBeitraege:alle.length,pruefbeitraege:eigene.map(p=>({id:p.id,art:p.kind,text:p.description})),anfang});
  if(s==='vorher') for(const p of eigene) {
    const pfad = p.media_url.split('/object/public/media/')[1];
    if(!pfad) throw new Error('Kein beständiger Medienpfad');
    const r = await fetch(basis+'/api/medien/unterschreiben',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({pfade:[pfad]})});
    const z = await r.json();
    const url = z.dateien?.[0]?.url;
    if(!r.ok||!url) throw new Error('Signatur fehlgeschlagen: '+r.status);
    const u = new URL(url);
    if(u.hostname!=='allmedia-cdn.b-cdn.net') throw new Error('Falscher CDN-Host');
    const antwort = await fetch(url,{headers:{Range:'bytes=0-1023'}});
    await antwort.arrayBuffer();
    belege.set(p.id,{url,pfad});
    protokoll({id:p.id,host:u.hostname,pfad,status:antwort.status,typ:antwort.headers.get('content-type'),range:antwort.headers.get('content-range')});
  }
  if(s==='nachher') {
    if(belege.size!==2) throw new Error('Genau zwei vorherige Medienbelege erforderlich');
    for(const [id,b] of belege) {
      const r = await fetch(b.url,{headers:{Range:'bytes=0-31'}}); await r.arrayBuffer();
      protokoll({id,pfad:b.pfad,nochInDatenbank:alle.some(p=>p.id===id),statusNachLoeschen:r.status});
      if(r.status!==404 || alle.some(p=>p.id===id)) throw new Error('Löschung nicht vollständig');
    }
    if(eigene.length!==0 || alle.length!==anfang) throw new Error('Bestandszählung weicht ab');
    protokoll({abschluss:'2/2 Beiträge gelöscht, 2/2 vorherige URLs 404, Ausgangsbestand wiederhergestellt'});
  }
}
(async()=>{
  const {data,error}=await client.auth.signInWithPassword({email:'test@all-media.app',password:wert('AM_TESTKONTO_PASS')});
  if(error) throw error;
  ich=data.user.id;token=data.session.access_token;anfang=(await bestand()).length;
  protokoll({bereit:true,anfang,konto:'test@all-media.app'});
  for await(const s of readline.createInterface({input:process.stdin})) {
    if(s==='ende') break;
    try {await befehl(s.trim());} catch(e) {protokoll({fehler:e.message});}
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
