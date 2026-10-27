/** Bunny-Vertrag mit zwei Prüfkonten; sämtliche Daten und DDL werden verworfen. */
const fs=require('fs');
const {frage}=require('./_aufraeumen');
const A='3baafacd-bbdb-40fb-8ef4-a4e365ae00c4',B='62616c1d-82e2-4ee4-aab9-950e40e438a4';
const p=`posts/${A}-probe115.jpg`, url=`https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/${p}`;
const als=(id,s)=>`reset role; select set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated"}',true),set_config('request.jwt.claim.sub','${id}',true);set local role authenticated;do $p$ begin ${s} end $p$;reset role;`;
const ok=(name,expr)=>`if not coalesce((${expr}),false) then raise exception 'Prüfung fehlgeschlagen: ${name}';end if;perform set_config('probe.erg',current_setting('probe.erg')||'${name} ',true);`;
const zu=(name,s)=>`begin ${s};raise exception 'Angriff offen: ${name}' using errcode='P0115';exception when sqlstate '42501' then perform set_config('probe.erg',current_setting('probe.erg')||'${name} ',true);end;`;
(async()=>{
 let schema=fs.readFileSync(require('path').join(__dirname,'../../SUPABASE_SCHEMA_115_bunny_medienvertrag.sql'),'utf8').replace(/^begin;$/m,'').replace(/^commit;$/m,'');
 const sql=`begin;${schema}
 select set_config('probe.erg','',true);
 do $p$ begin if not public.ist_testkonto('${A}') or not public.ist_testkonto('${B}') then raise exception 'Keine Prüfkonten';end if;end $p$;
 ${als(A,ok('upload_eigen','public.medium_upload_erlaubt()'))}
 insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256) values('${p}','${A}','image/jpeg',10,repeat('a',64));
 ${als(A,ok('eigen_lesen',`(select count(*)=1 from public.medien_leseliste(array['${p}']) where anbieter='bunny')`)+ok('eigen_loeschrecht',`public.medium_loeschrecht('${p}')='bunny'`)+zu('beleg_direkt_gesperrt',`insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256) values('posts/${A}-falsch.jpg','${A}','image/jpeg',10,repeat('b',64))`)+zu('metadaten_lesen_gesperrt','perform * from public.medien_objekte'))}
 ${als(B,ok('upload_zweites_konto','public.medium_upload_erlaubt()')+ok('fremd_privat_lesen_gesperrt',`not exists(select 1 from public.medien_leseliste(array['${p}']))`)+ok('fremd_loeschen_gesperrt',`public.medium_loeschrecht('${p}') is null`)+zu('fremde_referenz_gesperrt',`insert into public.posts(user_id,kind,media_url,description) values(auth.uid(),'post','${url}','probe115-fremd')`))}
 ${als(A,`insert into public.posts(user_id,kind,media_url,description) values(auth.uid(),'post','${url}','probe115-eigen');`+ok('eigener_beitrag_lesbar',`exists(select 1 from public.posts where media_url='${url}')`)+ok('referenziert_nicht_loeschen',`public.medium_loeschrecht('${p}') is null`)+`delete from public.posts where media_url='${url}';`+ok('nach_beitrag_loeschbar',`public.medium_loeschrecht('${p}')='bunny'`))}
 set local role anon;
 do $p$ begin ${zu('anon_rpc_gesperrt','perform public.medium_upload_erlaubt()')}${zu('anon_tabelle_gesperrt','perform * from public.medien_objekte')} end $p$;reset role;
 do $p$ begin ${ok('keine_public_funktionsrechte',`not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'bunny_%' or p.proname in ('medium_upload_erlaubt','medien_leseliste','medium_loeschrecht')) and has_function_privilege('anon',p.oid,'execute'))`)} end $p$;
 delete from public.medien_objekte where pfad='${p}';
 do $p$ begin ${ok('beleg_geloescht',`not exists(select 1 from public.medien_objekte where pfad='${p}')`)} raise exception 'ERG:%',current_setting('probe.erg');end $p$;`;
 const r=await frage(sql);const msg=JSON.stringify(r);
 const m=msg.match(/ERG:([^"\\]*)/);
 if(!m)throw Error('Probe gescheitert: '+msg.slice(0,1200));
 const checks=m[1].trim().split(/\s+/);checks.forEach(c=>console.log('PASS '+c));
 const rest=await frage(`select to_regclass('public.medien_objekte') is null as ddl_verworfen, not exists(select 1 from public.posts where description in ('probe115-eigen','probe115-fremd')) as daten_verworfen`);
 if(!rest?.[0]?.daten_verworfen)throw Error('Probedaten nicht verworfen');
 console.log(`PASS Daten verworfen; Tabelle nach Rollback ${rest[0].ddl_verworfen?'nicht vorhanden':'bereits vorher vorhanden'}`);
 console.log(`${checks.length+1}/${checks.length+1} bestanden, Transaktion verworfen.`);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
