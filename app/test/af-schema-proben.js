#!/usr/bin/env node
/** AF-Schemas ausschließlich in verworfener Transaktion; keine Medien/Anmeldung/Resets.
 * KI-Belegung supabase-schema UND testbestand erforderlich. Token nur aus Umgebung.
 * Die abschließende Ausnahme erzwingt Rollback auch bei Management-API-Verbindungen.
 * Transaktionshüllen der Entwürfe werden entfernt, COMMIT bleibt ausgeschlossen.
 */
const fs=require('fs'),path=require('path');
require('./_ki_belegung').pruefeBelegung('supabase-schema');
// Beide Belegungen prüfen (der generische Helfer merkt nur die erste Prüfung).
delete globalThis.__kiBelegungGeprueft;
require('./_ki_belegung').pruefeBelegung('testbestand');
const nr=Number(process.argv[2]);if(![108,110,111,109].includes(nr))throw Error('Schema 108/109/110/111 angeben');
const root=path.resolve(__dirname,'../..');
const id=n=>`ac260026-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),B=id(2),C=id(3),W=id(4),P=id(10),Q=id(11),F=id(12),D=id(13),I=id(20);
const schema=n=>{const name=fs.readdirSync(root).find(x=>x.startsWith(`SUPABASE_SCHEMA_${n}_`));if(!name)throw Error(`Schema ${n} fehlt`);const s=fs.readFileSync(path.join(root,name),'utf8').replace(/^\s*(begin|commit|rollback)\s*;\s*$/gmi,'');if(/^\s*(commit|rollback)\b/im.test(s))throw Error('Transaktionsabschluss im Schema');return s;};
let checks=[];
const check=(name,expr)=>{checks.push(name);return `perform pg_temp.pruefe('${name}',(${expr}));`;};
const deny=(name,sql)=>{checks.push(name);return `begin ${sql}; perform pg_temp.pruefe('${name}',false); exception when insufficient_privilege or raise_exception then if sqlerrm like 'PRUEFFEHLER:%' then raise;end if; perform pg_temp.pruefe('${name}',true);end;`;};
const als=(u,sql)=>`reset role;select set_config('request.jwt.claims','{"sub":"${u}","role":"authenticated"}',true),set_config('request.jwt.claim.sub','${u}',true);set local role authenticated;do $probe$ declare j jsonb; v uuid; b boolean; n numeric;begin ${sql} end $probe$;reset role;`;
const owner=sql=>`do $probe$ begin ${sql} end $probe$;`;
const post=(p,u,extra='')=>`insert into public.posts(id,user_id,kind,description,demo,tags${extra?',publish_at':''}) values('${p}','${u}','reel','AF Rollbackprobe',false,array['afprobe']${extra?','+extra:''});`;
let sql=`begin;set local statement_timeout='45s';select set_config('probe.erg','',true);
create function pg_temp.pruefe(n text,b boolean) returns void language plpgsql as $$begin
 if b is not true then raise exception 'PRUEFFEHLER:%',n;end if;
 perform set_config('probe.erg',current_setting('probe.erg',true)||n||'|',true);end $$;
`;
if(nr===111)for(const n of [89,90,94,97,98,99,107])sql+=schema(n)+'\n';
if(nr!==109)sql+=schema(108)+'\n';
if(nr>=110)sql+=schema(110)+'\n';
if(nr===111)sql+=schema(111)+'\n';
if(nr===109)sql+=schema(109)+'\n';
// Wegwerfkonten im Rollback: ausdrücklich keine bestehenden Konten ändern.
for(const [u,name] of [[A,'A'],[B,'B'],[C,'C'],[W,'W']])sql+=`insert into auth.users(id,email,raw_user_meta_data) values('${u}','afprobe-${name}@example.invalid','{"name":"AF Probe ${name}","handle":"@afprobe${name}","geburtsdatum":"1990-01-01","land":"DE"}');update public.konto_alter set status='frei',geburtsdatum='1990-01-01' where user_id='${u}';`;
sql+=`insert into public.konto_alter(user_id,status,geburtsdatum) values('${W}','wartet','2020-01-01') on conflict(user_id) do update set status='wartet',geburtsdatum='2020-01-01';`;
sql+=post(P,A)+post(Q,A)+post(F,A,"now()+interval '1 day'")+`insert into public.posts(id,user_id,kind,demo) values('${D}','${A}','reel',true);`;
if(nr===108){
 sql+=owner(check('anon_RPC_zu',`not has_function_privilege('anon','public.beitrag_reaktion(uuid,text)','EXECUTE')`)+check('anon_Rang_zu',`not has_function_privilege('anon','public.feed_rang(uuid[],text)','EXECUTE')`));
 sql+=als(B,`select punkte into n from public.feed_rang(array['${P}'::uuid]);perform set_config('probe.rang',n::text,true);`+
 check('dislike_an',`public.beitrag_reaktion('${P}','dislike')`)+check('eigen_lesbar',`(select count(*)=1 from public.post_dislikes where post_id='${P}')`)+check('rang_gesenkt',`(select punkte<current_setting('probe.rang')::numeric*0.03 from public.feed_rang(array['${P}'::uuid]))`)+
 check('like_verdrängt',`public.beitrag_reaktion('${P}','like')`)+check('dislike_weg',`not exists(select 1 from public.post_dislikes where post_id='${P}')`)+check('dislike_verdrängt',`public.beitrag_reaktion('${P}','dislike')`)+check('dislike_zurück',`not public.beitrag_reaktion('${P}','dislike')`)+deny('direkt_dislike_zu',`insert into public.post_dislikes(post_id,user_id) values('${P}',auth.uid())`)+deny('fremd_geplant_zu',`perform public.beitrag_reaktion('${F}','like')`)+check('rang_geplant_unsichtbar',`not exists(select 1 from public.feed_rang(array['${F}'::uuid]))`)+check('rang_demo_unsichtbar',`not exists(select 1 from public.feed_rang(array['${D}'::uuid]))`)+`perform public.beitrag_reaktion('${P}','dislike');`);
 sql+=als(C,check('fremd_dislike_privat',`not exists(select 1 from public.post_dislikes where post_id='${P}')`));
 sql+=als(A,check('eigen_geplant_like',`public.beitrag_reaktion('${F}','like')`));
 sql+=als(W,deny('wartend_RPC_zu',`perform public.beitrag_reaktion('${P}','dislike')`)+deny('wartend_Rang_zu',`perform public.feed_rang(array['${P}'::uuid])`)+check('wartend_liste_leer',`not exists(select 1 from public.post_dislikes)`));
 sql+=als(B,`insert into public.blocks(user_id,blocked_user_id) values(auth.uid(),'${A}');`+deny('blockiert_RPC_zu',`perform public.beitrag_reaktion('${P}','like')`)+check('blockiert_Rang_leer',`not exists(select 1 from public.feed_rang(array['${P}'::uuid]))`));
}
if(nr===110){
 sql+=owner(check('anon_Analyse_zu',`not has_function_privilege('anon','public.meine_kontoanalysen()','EXECUTE')`));
 sql+=als(B,`perform public.impression_vermerken('${P}',0,'feed');perform public.impression_vermerken('${P}',999,'feed');`+check('kurz_keine_impression',`not exists(select 1 from public.post_impressions where post_id='${P}' and user_id=auth.uid())`)+`perform public.impression_vermerken('${P}',1000,'feed');`+deny('rohzugriff_zu',`perform * from public.konto_sichtungen`)+deny('direkt_messen_zu',`insert into public.konto_sichtungen(impression_id,post_id,zuschauer,tag,folgt,sichtungen,dauer_ms) values(gen_random_uuid(),'${P}',auth.uid(),current_date,false,99,99000)`)+deny('geplant_messen_zu',`perform public.impression_vermerken('${F}',1000,'feed')`));
 sql+=als(A,`perform public.impression_vermerken('${P}',2000,'feed');j:=public.meine_kontoanalysen();`+check('echte_reichweite_eins',`(j->'zeitraeume'->0->>'reichweite')::int=1`)+check('aufrufe_eins',`(j->'zeitraeume'->0->>'aufrufe')::int=1`)+check('dauer_1000',`(j->'zeitraeume'->0->>'sichtzeitMs')::int=1000`)+check('nichtfollower_eins',`(j->'zeitraeume'->0->>'nichtFollowerAufrufe')::int=1`)+check('kleine_laender_verborgen',`j->'zeitraeume'->0->'laender'='[]'::jsonb`));
 sql+=als(C,`insert into public.follows(follower_id,followee_id) values(auth.uid(),'${A}');perform public.impression_vermerken('${P}',1500,'reels');insert into public.post_likes(post_id,user_id) values('${P}',auth.uid());j:=public.meine_kontoanalysen();`+check('fremde_Analyse_leer',`(j->'zeitraeume'->0->>'reichweite')::int=0`));
 sql+=als(A,`j:=public.meine_kontoanalysen();`+check('follower_gezählt',`(j->'zeitraeume'->0->>'followerAufrufe')::int=1`)+check('reichweite_zwei',`(j->'zeitraeume'->0->>'reichweite')::int=2`)+check('interaktion_eins',`(j->'zeitraeume'->0->>'interaktionen')::int=1`));
 sql+=als(W,deny('wartend_Analyse_zu',`perform public.meine_kontoanalysen()`)+deny('wartend_messen_zu',`perform public.impression_vermerken('${P}',1000,'feed')`));
}
if(nr===111){
 const pfad=`instants/${A}/probe.jpg`;
 sql+=owner(check('anon_Instant_zu',`not has_function_privilege('anon','public.instant_senden(text,text)','EXECUTE')`)+check('aufräumer_nur_dienst',`not has_function_privilege('authenticated','public.instant_loeschkandidaten()','EXECUTE')`));
 sql+=`insert into storage.objects(bucket_id,name,owner_id,metadata) values('media','${pfad}','${A}','{"size":1234,"mimetype":"image/jpeg"}');`;
 sql+=als(A,`insert into public.enge_freunde(user_id,freund_id) values(auth.uid(),'${B}'),(auth.uid(),'${C}');`+check('empfaenger_zwei',`public.instant_empfaengerzahl()=2`)+`v:=public.instant_senden('${pfad}','Hallo');perform set_config('probe.instant',v::text,true);`+check('absender_zugang',`public.instant_zugang(v)`)+deny('direkt_instant_zu',`insert into public.instants(absender,bild_pfad) values(auth.uid(),'${pfad}x')`));
 sql+=als(C,check('liste_privatsphäre',`not exists(select 1 from public.enge_freunde where user_id='${A}')`)+check('postfach_eins',`(select count(*)=1 from public.instant_postfach())`)+check('badge_eins',`public.instant_stand()=1`)+check('direkt_storage_zu',`not exists(select 1 from storage.objects where bucket_id='media' and name='${pfad}')`)+deny('fremd_zurückziehen_zu',`perform public.instant_zurueckziehen(current_setting('probe.instant')::uuid)`));
 sql+=als(B,check('oeffnen_ok',`public.instant_oeffnen(current_setting('probe.instant')::uuid)`)+check('badge_danach_null',`public.instant_stand()=0`)+check('geöffnet_unzugänglich',`not public.instant_zugang(current_setting('probe.instant')::uuid)`)+deny('zweites_oeffnen_zu',`perform public.instant_oeffnen(current_setting('probe.instant')::uuid)`));
 sql+=als(W,check('wartend_postfach_leer',`public.instant_stand()=0`)+deny('wartend_senden_zu',`perform public.instant_senden('${pfad}','x')`)+deny('wartend_liste_zu',`insert into public.enge_freunde(user_id,freund_id) values(auth.uid(),'${A}')`));
 sql+=als(C,`insert into public.blocks(user_id,blocked_user_id) values(auth.uid(),'${A}');`+check('blockiert_zugang_zu',`not public.instant_zugang(current_setting('probe.instant')::uuid)`)+check('blockiert_badge_null',`public.instant_stand()=0`));
 sql+=als(A,check('blockierte_liste_weg',`not exists(select 1 from public.enge_freunde where freund_id='${C}')`)+`perform public.instant_zurueckziehen(current_setting('probe.instant')::uuid);`+check('zurückgezogen_zu',`not public.instant_zugang(current_setting('probe.instant')::uuid)`));
 sql+=owner(check('loeschkandidat',`exists(select 1 from public.instant_loeschkandidaten() where bild_pfad='${pfad}')`));
}
sql+=`reset role;do $$begin raise exception 'AF_ROLLBACK_ERG:%',current_setting('probe.erg',true);end $$;rollback;`;
if(process.env.AF_PROBE_SQL){fs.writeFileSync(process.env.AF_PROBE_SQL,sql);process.exit(0);}
(async()=>{
 const token=process.env.SUPABASE_TOKEN;if(!token)throw Error('SUPABASE_TOKEN fehlt');
 const env=fs.readFileSync(path.join(root,'app/.env.local'),'utf8'),ref=env.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
 const query=async query=>{const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000)});return r.json();};
 const r=await query(sql),s=JSON.stringify(r),match=s.match(/AF_ROLLBACK_ERG:([^"\\]*)/);
 if(!match){console.error(s.slice(0,2000));process.exitCode=1;return;}
 const ok=new Set(match[1].split('|'));for(const c of checks)console.log(`${ok.has(c)?'OK':'FEHL'} ${c}`);
 console.log(`Schema ${nr}: ${checks.filter(c=>ok.has(c)).length}/${checks.length}, verworfen`);
 // Unabhängige SELECT-Verbindung belegt das Rollback der Konten und Schemata.
 const table={108:'post_dislikes',110:'konto_sichtungen',111:'instants',109:'video_upload_belege'}[nr];
 const nach=await query(`select (select count(*) from auth.users where id='${A}') as konten,to_regclass('public.${table}') as tabelle`);
 const sauber=Array.isArray(nach)&&Number(nach[0]?.konten)===0&&nach[0]?.tabelle===null;
 console.log(`Rollback-Kontrolle: ${sauber?'1/1':'0/1'} (Wegwerfkonten und neues Schema fehlen)`);
 process.exitCode=checks.every(c=>ok.has(c))&&sauber?0:1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
