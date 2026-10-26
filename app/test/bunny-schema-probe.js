#!/usr/bin/env node
/** Schema 113 nur innerhalb erzwungenem Rollback. Keine Anmeldung/Medien/Bestandskonten.
 * Ausführung nur mit eigener supabase-schema- und testbestand-Belegung.
 * BUNNY_PROBE_SQL=... erzeugt ausschließlich die prüfbare SQL-Datei.
 */
const fs=require('node:fs'),path=require('node:path');
require('./_ki_belegung').pruefeBelegung('supabase-schema');delete globalThis.__kiBelegungGeprueft;require('./_ki_belegung').pruefeBelegung('testbestand');
const root=path.resolve(__dirname,'../..'),id=n=>`bd260026-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),B=id(2),C=id(3),W=id(4),P=id(10),Q=id(11),R=id(12),I=id(20);
const bild=`posts/${A}-bild.jpg`,film=`posts/${A}-film.mp4`,roh=`posts/${A}-roh.mp4`,privat=`posts/${A}-privat.jpg`,fremd=`posts/${B}-fremd.jpg`,instant=`instants/${A}/kamera.jpg`,getarnt=`posts/${A}-getarnt.jpg`;
const url=p=>`public.medien_adresse('${p}')`,ml=arr=>`jsonb_build_array(${arr.map(([p,t])=>`jsonb_build_object('url',${url(p)},'typ','${t}')`).join(',')})`;
const checks=[],check=(n,e)=>{checks.push(n);return `perform pg_temp.pruefe('${n}',(${e}));`;};
const deny=(n,s)=>{checks.push(n);return `begin ${s};perform pg_temp.pruefe('${n}',false);exception when insufficient_privilege or raise_exception or check_violation or not_null_violation then if sqlerrm like 'PRUEFFEHLER:%' then raise;end if;perform pg_temp.pruefe('${n}',true);end;`;};
const als=(u,s,role='authenticated')=>`reset role;select set_config('request.jwt.claims','{"sub":"${u}","role":"${role}"}',true),set_config('request.jwt.claim.sub','${u}',true);set local role ${role};do $probe$ declare j jsonb;v uuid;n bigint;begin ${s} end $probe$;reset role;`;
const admin=s=>`reset role;do $probe$ begin ${s} end $probe$;`;
const schema=n=>{const datei=fs.readdirSync(root).find(p=>p.startsWith('SUPABASE_SCHEMA_'+n+'_'));const s=fs.readFileSync(path.join(root,datei),'utf8').replace(/^\s*(begin|commit|rollback)\s*;\s*$/gmi,'');if(/^\s*(commit|rollback)\b/im.test(s))throw Error('Transaktionsabschluss im Entwurf');return s;};
let sql=`begin;set local statement_timeout='45s';select set_config('probe.erg','',true);
create function pg_temp.pruefe(n text,b boolean) returns void language plpgsql as $$begin if b is not true then raise exception 'PRUEFFEHLER:%',n;end if;perform set_config('probe.erg',current_setting('probe.erg',true)||n||'|',true);end $$;\n`;
for(const nr of [89,90,94,97,98,99,107,109,110,111,113])sql+=schema(nr)+'\n';
for(const [u,name] of [[A,'A'],[B,'B'],[C,'C'],[W,'W']])sql+=`insert into auth.users(id,email,raw_user_meta_data) values('${u}','bunnyprobe-${name}@example.invalid','{"name":"Bunny Probe ${name}","handle":"@bunnyprobe${name}","geburtsdatum":"1990-01-01","land":"DE"}');update public.konto_alter set status='frei',geburtsdatum='1990-01-01' where user_id='${u}';\n`;
sql+=`update public.konto_alter set status='wartet',geburtsdatum='2020-01-01' where user_id='${W}';
set local role service_role;
insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256,sekunden) values
('${bild}','${A}','image/jpeg',200,repeat('a',64),null),
('${film}','${A}','video/mp4',1000,repeat('b',64),1200),
('${roh}','${A}','video/mp4',1000,repeat('c',64),null),
('${privat}','${A}','image/jpeg',200,repeat('d',64),null),
('${fremd}','${B}','image/jpeg',200,repeat('e',64),null),
('${instant}','${A}','image/jpeg',200,repeat('f',64),null);
reset role;
insert into storage.objects(id,bucket_id,name,owner_id,metadata) values
('${id(30)}','media','posts/${A}-alt.jpg','${A}','{"size":200,"mimetype":"image/jpeg"}'),
('${id(31)}','media','${getarnt}','${A}','{"size":1000,"mimetype":"video/mp4"}'),
('${id(32)}','media','${bild}','${B}','{"size":200,"mimetype":"image/jpeg"}');\n`;
sql+=`insert into public.follows(follower_id,followee_id) values('${A}','${B}'),('${B}','${A}');`;
sql+=als(A,
 check('eigener_bunny_besitz',`public.medium_besitzer_stimmt('${bild}',auth.uid())`)+
 check('bunny_leseliste_eigen',`(select anbieter='bunny' from public.medien_leseliste(array['${bild}']))`)+
 check('alter_speicher_bleibt',`(select anbieter='supabase' from public.medien_leseliste(array['posts/${A}-alt.jpg']))`)+
 check('loeschrecht_eigen',`public.medium_loeschrecht('${bild}')='bunny'`)+
 deny('register_nicht_schreibbar',`insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256) values('posts/angriff.jpg',auth.uid(),'image/jpeg',200,repeat('a',64))`)+
 deny('register_nicht_direkt_lesbar',`perform * from public.medien_objekte`)+
 `insert into public.posts(id,user_id,kind,description,medien) values('${P}',auth.uid(),'post','Karussell',${ml([[bild,'image'],[film,'video'],[bild,'image']])});`+
 check('liste_reihenfolge_dauerhaft',`(select medien->1->>'typ'='video' and jsonb_array_length(medien)=3 and media_url=${url(bild)} from public.posts where id='${P}')`)+
 `update public.posts set medien=${ml([[film,'video'],[bild,'image']])} where id='${P}';`+
 check('umsortieren_erste_referenz',`(select media_url=${url(film)} and duration='20:00' from public.posts where id='${P}')`)+
 `insert into public.posts(id,user_id,kind,media_url,duration) values('${R}',auth.uid(),'reel',${url(film)},'0:01');`+
 check('bunny_videodauer_aus_beleg',`(select duration='20:00' from public.posts where id='${R}')`)+
 `update public.posts set duration='0:01' where id='${R}';`+
 check('bunny_dauer_update_korrigiert',`(select duration='20:00' from public.posts where id='${R}')`)+
 deny('zweites_video_ohne_beleg_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',${ml([[bild,'image'],[roh,'video']])})`)+
 deny('getarntes_zweites_video_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',${ml([[bild,'image'],[getarnt,'image']])})`)+
 deny('fremde_bunnyreferenz_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',${ml([[bild,'image'],[fremd,'image']])})`)+
 deny('falscher_medientyp_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',${ml([[film,'image']])})`)+
 deny('instant_als_liste_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',${ml([[instant,'image']])})`)+
 `insert into public.posts(id,user_id,kind,medien,publish_at) values('${Q}',auth.uid(),'post',${ml([[privat,'image']])},now()+interval '1 day');`+
 check('geplant_eigen_lesbar',`exists(select 1 from public.posts where id='${Q}')`));
sql+=als(B,
 check('doppelpfad_keine_bunny_eigentuemerschaft',`not public.medium_besitzer_stimmt('${bild}',auth.uid())`)+
 check('sichtbarer_beitrag_alle_medien_lesbar',`(select count(*)=2 from public.medien_leseliste(array['${bild}','${film}']))`)+
 check('privates_geplantes_medium_zu',`not exists(select 1 from public.medien_leseliste(array['${privat}']))`)+
 check('fremdes_loeschrecht_zu',`public.medium_loeschrecht('${film}') is null`)+
 deny('referenz_macht_nicht_selbst_sichtbar',`update public.profiles set avatar_url=${url(privat)} where id=auth.uid()`)+
 `insert into public.blocks(user_id,blocked_user_id) values(auth.uid(),'${A}');`+
 check('blockierung_widerruft_leseliste',`not exists(select 1 from public.medien_leseliste(array['${bild}','${film}']))`)+
 `delete from public.blocks where user_id=auth.uid() and blocked_user_id='${A}';`);
sql+=als(W,
 check('wartend_upload_zu',`not public.medium_upload_erlaubt()`)+
 check('wartend_lesen_zu',`not exists(select 1 from public.medien_leseliste(array['${bild}','${film}']))`)+
 check('wartend_loeschen_zu',`public.medium_loeschrecht('${bild}') is null`)+
 deny('wartend_liste_schreiben_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',${ml([[bild,'image']])})`));
sql+=als(A,`insert into public.enge_freunde(user_id,freund_id) values(auth.uid(),'${B}');v:=public.instant_senden('${instant}','Bunny-Kamera');perform set_config('probe.instant',v::text,true);`+
 check('bunny_instant_angelegt',`public.instant_zugang(v)`)+
 check('instant_keine_allgemeine_signatur',`not exists(select 1 from public.medien_leseliste(array['${instant}']))`));
sql+=als(B,
 check('empfaenger_instant_lesbar',`public.instant_zugang(current_setting('probe.instant')::uuid)`)+
 check('empfaenger_keine_allgemeine_signatur',`not exists(select 1 from public.medien_leseliste(array['${instant}']))`)+
 check('einmal_oeffnen',`public.instant_oeffnen(current_setting('probe.instant')::uuid)`)+
 check('danach_unsichtbar',`not public.instant_zugang(current_setting('probe.instant')::uuid)`));
sql+=als(C,check('upload_vor_kontingent_frei',`public.medium_upload_erlaubt()`));
sql+=`set local role service_role;insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256) select 'posts/quota-'||g||'.jpg','${C}','image/jpeg',10,repeat('a',64) from generate_series(1,300) g;reset role;`;
sql+=als(C,check('kontingent_beide_anbieter',`not public.medium_upload_erlaubt()`));
sql+=admin(deny('paralleler_abschluss_ueber_kontingent_zu',`insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256) values('posts/quota-301.jpg','${C}','image/jpeg',10,repeat('a',64))`)+check('instant_loeschkandidat',`exists(select 1 from public.instant_loeschkandidaten() where bild_pfad='${instant}')`));
sql+=als(A,
 deny('anonym_leseliste_zu',`perform * from public.medien_leseliste(array['${bild}'])`)+
 deny('anonym_upload_zu',`perform public.medium_upload_erlaubt()`),'anon');
sql+=`reset role;do $$begin raise exception 'BUNNY_ROLLBACK_ERG:%',current_setting('probe.erg',true);end $$;rollback;`;
if(process.env.BUNNY_PROBE_SQL){fs.writeFileSync(process.env.BUNNY_PROBE_SQL,sql);console.log(`${checks.length} SQL-Gegenproben vorbereitet`);process.exit(0);}
(async()=>{
 const token=process.env.SUPABASE_TOKEN;if(!token)throw Error('SUPABASE_TOKEN fehlt');
 const env=fs.readFileSync(path.join(root,'app/.env.local'),'utf8'),ref=env.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];if(!ref)throw Error('Projektkennung fehlt');
 const query=async query=>{const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000)});return r.json();};
 const result=await query(sql),text=JSON.stringify(result),match=text.match(/BUNNY_ROLLBACK_ERG:([^"\\]*)/);
 // Auch bei SQL-Fehlern anschließend unabhängig nachsehen.
 const nach=await query(`select (select count(*) from auth.users where id in ('${A}','${B}','${C}','${W}')) as konten,to_regclass('public.medien_objekte') as tabelle,exists(select 1 from information_schema.columns where table_schema='public' and table_name='posts' and column_name='medien') as spalte`);
 const sauber=Array.isArray(nach)&&Number(nach[0]?.konten)===0&&nach[0]?.tabelle===null&&nach[0]?.spalte===false;
 if(!match){console.error('SQL-Probe fehlgeschlagen:',text.slice(0,2400));console.log(`Rollback-Kontrolle: ${sauber?'1/1':'0/1'}`);process.exitCode=1;return;}
 const ok=new Set(match[1].split('|'));for(const c of checks)console.log(`${ok.has(c)?'OK':'FEHL'} ${c}`);
 console.log(`Schema 113: ${checks.filter(c=>ok.has(c)).length}/${checks.length}, verworfen`);console.log(`Rollback-Kontrolle: ${sauber?'1/1':'0/1'} (Wegwerfkonten, Tabelle und Spalte fehlen)`);
 process.exitCode=checks.every(c=>ok.has(c))&&sauber?0:1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
