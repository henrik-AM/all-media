// Eigene temporäre Webschlüssel seit der exklusiven Paket6/7-Sitzung.
// App: @supabase/supabase-js ^2.112.4; vorhandener Management-Helfer unverändert.
// Doku: Supabase Management /database/query und cascade-deletes (Context7,17.11.).
// Standard: nur Bestand. Mutation bewusst mit --ausfuehren, niemals bei laufendem Gesamttest.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),basis=JSON.parse(fs.readFileSync(path.join(__dirname,'schluessel-ausgangsliste.json'),'utf8'));
const ausfuehren=process.argv.includes('--ausfuehren');
const ids=xs=>xs.length?xs.map(x=>{if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(x))throw Error('Ungültige Kennung');return `'${x}'`;}).join(','):"'00000000-0000-0000-0000-000000000000'";
if(JSON.stringify(basis.kontoIds)!==JSON.stringify(['3baafacd-bbdb-40fb-8ef4-a4e365ae00c4','62616c1d-82e2-4ee4-aab9-950e40e438a4']))throw Error('Falscher Testkontenumfang');
if(ausfuehren){const sperre=path.join(root,'app/test/.gesamtlauf-laeuft.json');if(fs.existsSync(sperre)){const s=JSON.parse(fs.readFileSync(sperre));let lebt=false;try{process.kill(s.pid,0);lebt=true;}catch(e){if(e.code!=='ESRCH')throw e;}if(lebt)throw Error('Gesamtlauf noch aktiv; keine Schlüssel entfernen');}}
process.env.SUPABASE_TOKEN=fs.readFileSync('/Users/henrik.dikta/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/2.Gehirn.md/04 Ressourcen/Zugangsdaten/Supabase.md','utf8').match(/sbp_[A-Za-z0-9_-]{20,}/)[0];
const {frage}=require(path.join(root,'app/test/_aufraeumen'));
const filter=`user_id in(${ids(basis.kontoIds)}) and id not in(${ids(basis.bewahren)}) and art='web' and created_at>='2026-11-17T12:00:00Z'::timestamptz`;
(async()=>{
 const vorher=await frage(`select id,user_id,art,created_at from krypto_schluessel where ${filter} order by created_at,id`);
 const erhaltenVorher=await frage(`select id from krypto_schluessel where user_id in(${ids(basis.kontoIds)}) and id in(${ids(basis.bewahren)}) order by id`);
 if(!ausfuehren){console.log(JSON.stringify({nurLesen:true,eigeneNeueWebschluessel:vorher.length,bestehendeAusAusgangsliste:erhaltenVorher.length}));return;}
 const keyIds=vorher.map(x=>x.id),auswahl=ids(keyIds);
 const roh=await frage(`select jsonb_build_object('schluessel',coalesce((select jsonb_agg(to_jsonb(k)) from krypto_schluessel k where id in(${auswahl}) and ${filter}),'[]'::jsonb),'kuverts',coalesce((select jsonb_agg(to_jsonb(m)) from message_keys m where schluessel_id in(${auswahl})),'[]'::jsonb)) archiv`);
 const ordner='/Users/henrik.dikta/allmedia-wt-codex/rohbelege-paket67-2026-11-17/schluessel';fs.mkdirSync(ordner,{recursive:true,mode:0o700});
 const datei=path.join(ordner,Date.now()+'.json'),inhalt=JSON.stringify(roh,null,2);fs.writeFileSync(datei,inhalt,{mode:0o600,flag:'wx'});
 await frage(`begin;set local lock_timeout='3s';set local statement_timeout='15s';delete from krypto_schluessel where id in(${auswahl}) and ${filter};commit;select 1 ok`);
 const nachher=await frage(`select (select count(*) from krypto_schluessel where ${filter})::int rest,(select count(*) from message_keys where schluessel_id in(${auswahl}))::int kuvertRest`);
 const erhaltenNachher=await frage(`select id from krypto_schluessel where user_id in(${ids(basis.kontoIds)}) and id in(${ids(basis.bewahren)}) order by id`);
 const beleg={zeit:new Date().toISOString(),quelle:basis.quelle,vorher:vorher.length,rest:nachher[0].rest,kuvertRest:nachher[0].kuvertRest,ausgangslisteVorher:erhaltenVorher.length,ausgangslisteNachher:erhaltenNachher.length,ausgangslisteUnveraendert:JSON.stringify(erhaltenVorher)===JSON.stringify(erhaltenNachher),roharchiv:datei,sha256:crypto.createHash('sha256').update(inhalt).digest('hex')};
 fs.writeFileSync(path.join(__dirname,'schluessel-abschluss.json'),JSON.stringify(beleg,null,2));console.log(JSON.stringify(beleg));
 if(beleg.rest||beleg.kuvertRest||!beleg.ausgangslisteUnveraendert)throw Error('Schlüssel-Abschluss noch unvollständig');
})().catch(e=>{console.error(e.message);process.exitCode=1});
