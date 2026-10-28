/** Altmedienvertrag: normale Wege und Angriffe, alles wird zurückgerollt. */
const fs=require('fs');
const assert=require('assert/strict');
const {frage}=require('./_aufraeumen');
const A='3baafacd-bbdb-40fb-8ef4-a4e365ae00c4',B='62616c1d-82e2-4ee4-aab9-950e40e438a4';
const p='stories/probe116-alt.jpg',b='beispiel/probe116-gemeinsam.jpg';
let zahl=0;
const ok=(name,expr)=>{zahl++;return `if not coalesce((${expr}),false) then raise exception 'FEHL ${name}';end if;perform set_config('probe.erg',current_setting('probe.erg')||'${name} ',true);`;};
const zu=(name,sql)=>{zahl++;return `begin ${sql};raise exception 'OFFEN ${name}' using errcode='P0116';exception when sqlstate '42501' then perform set_config('probe.erg',current_setting('probe.erg')||'${name} ',true);end;`;};
const rolle=(role,id,s)=>`reset role;select set_config('request.jwt.claims','${JSON.stringify({role,...id?{sub:id}:{}})}',true),set_config('request.jwt.claim.sub','${id||''}',true);set local role ${role};do $p$ begin ${s} end $p$;reset role;`;
const reg=(pf=p,bytes=10,sha="repeat('a',64)")=>`public.medien_umzug_registrieren('${pf}','image/jpeg',${bytes},${sha})`;
(async()=>{
 const vorher=await frage("select to_regprocedure('public.medien_umzug_registrieren(text,text,bigint,text)') is not null as vorhanden, (select count(*) from public.medien_objekte) as belege");
 assert.ok(Array.isArray(vorher));
 let schema=fs.readFileSync(require('path').join(__dirname,'../../SUPABASE_SCHEMA_116_bunny_altmedien.sql'),'utf8').replace(/^begin;$/m,'').replace(/^commit;$/m,'');
 const sql=`begin;${schema}
 select set_config('probe.erg','',true);
 do $p$ begin if not public.ist_testkonto('${A}') or not public.ist_testkonto('${B}') then raise exception 'Keine Prüfkonten';end if;end $p$;
 insert into storage.objects(bucket_id,name,owner_id,metadata,created_at) values
 ('media','${p}','${A}','{"size":10,"mimetype":"image/jpeg"}',now()-interval '30 days'),
 ('media','${b}',null,'{"size":10,"mimetype":"image/jpeg"}',now()-interval '30 days'),
 ('media','stories/probe116-ohne-owner.jpg',null,'{"size":10,"mimetype":"image/jpeg"}',now()-interval '30 days');
 ${rolle('service_role',null,ok('alt_registriert',`${reg()}='bunny'`)+ok('wiederholung_idempotent',`${reg()}='bunny'`)+ok('konflikt_gesperrt',`${reg(p,10,"repeat('b',64)")} like 'ausgelassen:%'`)+ok('groessenkonflikt',`${reg(b,11)} like 'ausgelassen:%'`)+ok('quelle_fehlt',`${reg('posts/probe116-fehlt.jpg')} like 'ausgelassen:%'`)+ok('owner_fehlt',`${reg('stories/probe116-ohne-owner.jpg')} like 'ausgelassen:%'`)+ok('gemeinsames_beispiel',`${reg(b)}='bunny'`)+ok('pfad_gesperrt',`${reg('../probe116.jpg')} like 'ausgelassen:%'`)+ok('sha_ungueltig',`${reg('posts/probe116-fehlt.jpg',10,"'falsch'")} like 'ausgelassen:%'`))}
 do $p$ begin ${ok('zeitstempel_erhalten',`(select created_at<now()-interval '29 days' and migriert_am is not null from public.medien_objekte where pfad='${p}')`)} ${ok('owner_aus_quelle',`(select owner_id='${A}' from public.medien_objekte where pfad='${p}')`)} end $p$;
 ${rolle('authenticated',A,ok('eigen_lesen',`exists(select 1 from public.medien_leseliste(array['${p}']) where anbieter='bunny')`)+ok('eigen_loeschen',`public.medium_loeschrecht('${p}')='bunny'`)+zu('registrierung_auth_gesperrt',`perform ${reg()}`)+zu('direkte_tabelle_gesperrt',`perform * from public.medien_objekte`))}
 ${rolle('authenticated',B,ok('privat_gesperrt',`not exists(select 1 from public.medien_leseliste(array['${p}']))`)+ok('fremd_loeschen_gesperrt',`public.medium_loeschrecht('${p}') is null`)+ok('beispiel_lesbar',`exists(select 1 from public.medien_leseliste(array['${b}']) where anbieter='bunny')`)+ok('beispiel_nicht_loeschbar',`public.medium_loeschrecht('${b}') is null`))}
 ${rolle('anon',null,zu('registrierung_anon_gesperrt',`perform ${reg()}`)+zu('leseliste_anon_gesperrt',`perform * from public.medien_leseliste(array['${p}'])`))}
 do $p$ begin ${zu('neuer_upload_ohne_praefix_gesperrt',`insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256) values('posts/probe116-neu.jpg','${A}','image/jpeg',10,repeat('a',64))`)} end $p$;
 insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256) values('posts/${A}-probe116-neu.jpg','${A}','image/jpeg',10,repeat('a',64));
 delete from public.medien_objekte where pfad='posts/${A}-probe116-neu.jpg';
 do $p$ begin ${ok('neuer_upload_normal_geloescht',`not exists(select 1 from public.medien_objekte where pfad='posts/${A}-probe116-neu.jpg')`)} end $p$;
 ${rolle('service_role',null,`delete from public.medien_objekte where pfad='${p}';`+ok('loeschmarke',`(select geloescht_am is not null from public.medien_objekte where pfad='${p}')`)+ok('keine_wiederbelebung',`${reg()}='ausgelassen: bereits gelöscht'`))}
 ${rolle('authenticated',A,ok('kein_supabase_rueckfall',`public.bunny_medium_anbieter('${p}')='bunny'`)+ok('geloescht_nicht_signierbar',`not exists(select 1 from public.medien_leseliste(array['${p}']))`))}
 do $p$ begin ${ok('quelle_unveraendert',`exists(select 1 from storage.objects where bucket_id='media' and name='${p}' and owner_id='${A}')`)} raise exception 'ERG:%',current_setting('probe.erg');end $p$;`;
 const r=await frage(sql),msg=JSON.stringify(r);const m=msg.match(/ERG:([^"\\]+)/);
 if(!m)throw Error(msg);
 const namen=m[1].trim().split(/\s+/);assert.equal(namen.length,zahl);console.log(namen.map(n=>'PASS '+n).join('\n'));
 const nach=await frage("select to_regprocedure('public.medien_umzug_registrieren(text,text,bigint,text)') is not null as vorhanden, (select count(*) from public.medien_objekte) as belege, not exists(select 1 from storage.objects where name like '%probe116%') as daten_verworfen");
 assert.equal(nach[0].vorhanden,vorher[0].vorhanden);assert.equal(nach[0].belege,vorher[0].belege);assert.equal(nach[0].daten_verworfen,true);
 console.log(`${zahl+3}/${zahl+3} Prüfungen; Transaktion vollständig verworfen.`);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
