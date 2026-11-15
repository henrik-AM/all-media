/** Reines lokales PostgreSQL/WASM. Benötigt AM_PGLITE_MODUL, kein Supabase. */
require('./_offline_sperre.cjs');
const {PGlite}=require(process.env.AM_PGLITE_MODUL || '@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();const sendezeit=new Date().toISOString();let ok=0;const pruefe=(name,b)=>{assert.ok(b,name);ok++;console.log('OK '+name);};
 try{
  await db.exec(`create role authenticated;create role anon;
   create table public.messages(id uuid primary key default gen_random_uuid(),text text,krypto smallint not null default 0,chiffre text,krypto_nonce text,absender_schluessel text,created_at timestamptz not null default now());
   alter table public.messages add constraint messages_krypto_stimmig check((krypto=0 and chiffre is null and krypto_nonce is null) or(krypto=1 and chiffre is not null and krypto_nonce is not null and absender_schluessel is not null and coalesce(text,'')=''));
   grant select,insert,update on public.messages to authenticated;
   insert into public.messages(text,krypto) values('alt',0);
   insert into public.messages(text,krypto,chiffre,krypto_nonce,absender_schluessel) values('',1,'altchiffre','nonce','sender');`);
  const acl=(await db.query("select relacl::text acl from pg_class where oid='public.messages'::regclass")).rows[0].acl;
  const sql=fs.readFileSync(path.join(__dirname,'../../SUPABASE_SCHEMA_127_krypto_kontext.sql'),'utf8');
  const innen=sql.replace(/^begin;\s*$/mg,'').replace(/^commit;\s*$/mg,'');
  await db.exec('begin;'+innen+'rollback;');
  pruefe('Verworfene Migration hinterlässt keine neue Spalte',(await db.query("select count(*)::int n from information_schema.columns where table_name='messages' and column_name='krypto_gesendet_am'")).rows[0].n===0);
  await db.exec(sql);await db.exec(sql);
  pruefe('Migration wiederholbar und beide Bestandszeilen erhalten',(await db.query('select count(*)::int n from messages')).rows[0].n===2);
  pruefe('Tabellenrechte unverändert',(await db.query("select relacl::text acl from pg_class where oid='public.messages'::regclass")).rows[0].acl===acl);
  await db.exec(`set role authenticated;insert into public.messages(text,krypto,chiffre,krypto_nonce,absender_schluessel,krypto_gesendet_am) values('',2,'chiffre','nonce','sender','${sendezeit}');reset role;`);
  pruefe('Normales Format2 mit verschlossener Zeit wird angenommen',(await db.query('select count(*)::int n from messages where krypto=2')).rows[0].n===1);
  for(const [name,werte] of [['Format2 ohne Zeit',"'',2,'c','n','s',null"],['Format2 mit Klartext',"'geheim',2,'c','n','s',now()"],['Unbekannte Version',"'',3,'c','n','s',now()"],['Format0 mit Chiffre',"'offen',0,'c',null,null,null"],['Format2 zurückdatiert',"'',2,'c','n','s',now()-interval '1 day'"],['Format2 vordatiert',"'',2,'c','n','s',now()+interval '1 day'"]]){
   await assert.rejects(db.exec(`insert into messages(text,krypto,chiffre,krypto_nonce,absender_schluessel,krypto_gesendet_am) values(${werte})`),e=>e.code==='23514');pruefe(name+' abgewiesen',true);
  }
  await db.exec('set role authenticated;');
  await assert.rejects(db.exec("update messages set krypto_gesendet_am=krypto_gesendet_am+interval '1 minute' where krypto=2"),e=>e.code==='23514');
  pruefe('Gespeicherte Sendezeit bleibt unveränderlich',true);
  await db.exec("update messages set chiffre='bearbeitet' where krypto=2;reset role;");
  pruefe('Normales verschlüsseltes Bearbeiten bleibt möglich',(await db.query("select chiffre from messages where krypto=2")).rows[0].chiffre==='bearbeitet');
  pruefe('Triggerfunktion für authenticated nicht direkt aufrufbar',(await db.query("select has_function_privilege('authenticated','public.krypto_zeit_fest()','EXECUTE') v")).rows[0].v===false);
  pruefe('Triggerfunktion für anon nicht direkt aufrufbar',(await db.query("select has_function_privilege('anon','public.krypto_zeit_fest()','EXECUTE') v")).rows[0].v===false);
  await db.exec('set role anon;');await assert.rejects(db.exec('select * from messages'),e=>e.code==='42501');await db.exec('reset role;');pruefe('Anonyme Rechte bleiben gesperrt',true);
  pruefe('Präzision der Sendezeit bleibt millisekundengenau',(await db.query('select krypto_gesendet_am from messages where krypto=2')).rows[0].krypto_gesendet_am.toISOString()===sendezeit);
  console.log(`${ok}/${ok} lokale SQL-Prüfungen, kein Supabase`);
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
