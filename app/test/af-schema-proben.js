#!/usr/bin/env node
const KONTENPOOL = require('./_kontenpool').konten(); // Schema 138: Konten des Prüfplatzes
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
const nr=Number(process.argv[2]);if(![129,130,131,132,133,134,135,136,137].includes(nr))throw Error('Schema 129–137 angeben');
// Paket 9: Entwürfe 108/110/111/109/113 heißen auf main 129/130/131/132/133.
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
if(nr===137){
 if(!process.env.AF_PROBE_LIVE)sql+=schema(137)+'\n';
}else{
 if(nr<=131||nr>=134)sql+=schema(129)+'\n';
 if(nr>=134)sql+=schema(130)+'\n';
 if(nr===130||nr===131)sql+=schema(130)+'\n';
 if(nr===131)sql+=schema(131)+'\n';
 if(nr>=132)sql+=schema(132)+'\n';
 if(nr>=133)sql+=schema(133)+'\n';
 // Schema 134 ist live: alle Proben laufen mit dem Gegenprüfungsstand.
 if(nr>=134||nr<=130||nr===132||nr===133)sql+=schema(134)+'\n';
 if(nr!==131)sql+=schema(135)+'\n';
 if(nr!==131)sql+=schema(136)+'\n';
}
// Wegwerfkonten im Rollback: ausdrücklich keine bestehenden Konten ändern.
for(const [u,name] of [[A,'A'],[B,'B'],[C,'C'],[W,'W']])sql+=`insert into auth.users(id,email,raw_user_meta_data) values('${u}','afprobe-${name}@example.invalid','{"name":"AF Probe ${name}","handle":"@afprobe${name}","geburtsdatum":"1990-01-01","land":"DE"}');update public.konto_alter set status='frei',geburtsdatum='1990-01-01' where user_id='${u}';`;
sql+=`insert into public.konto_alter(user_id,status,geburtsdatum) values('${W}','wartet','2020-01-01') on conflict(user_id) do update set status='wartet',geburtsdatum='2020-01-01';`;
if(nr<=131||nr>=134)sql+=post(P,A)+post(Q,A)+post(F,A,"now()+interval '1 day'")+`insert into public.posts(id,user_id,kind,demo) values('${D}','${A}','reel',true);`;
if(nr===132){
 const pfad=`posts/${A}-probe.mp4`,obj=id(30);
 sql+=`insert into storage.objects(id,bucket_id,name,owner_id,metadata) values('${obj}','media','${pfad}','${A}','{"size":1234,"mimetype":"video/mp4"}');`;
 sql+=als(A,deny('demo_tarnung_zu',`insert into public.posts(user_id,kind,media_url,duration,demo) values(auth.uid(),'reel',public.medien_adresse('${pfad}'),'0:01',true)`)+deny('ohne_beleg_zu',`insert into public.posts(user_id,kind,media_url,duration) values(auth.uid(),'reel',public.medien_adresse('${pfad}'),'0:01')`)+deny('beleg_faelschen_zu',`insert into public.video_upload_belege(objekt_id,user_id,pfad,sekunden,sha256,bytes) values('${obj}',auth.uid(),'${pfad}',1,repeat('a',64),1234)`)+`update storage.objects set metadata='{"size":1234}' where id='${obj}';get diagnostics n=row_count;`+check('austausch_null_zeilen','n=0'));
 sql+=`set local role service_role;insert into public.video_upload_belege(objekt_id,user_id,pfad,sekunden,sha256,bytes) values('${obj}','${A}','${pfad}',1200,repeat('a',64),1234);reset role;`;
 sql+=als(A,`insert into public.posts(id,user_id,kind,media_url,duration) values('${P}',auth.uid(),'reel',public.medien_adresse('${pfad}'),'0:01');`+check('dauer_aus_beleg',`(select duration='20:00' from public.posts where id='${P}')`)+`update public.posts set duration='0:01' where id='${P}';`+check('dauer_update_korrigiert',`(select duration='20:00' from public.posts where id='${P}')`));
 sql+=als(B,deny('fremder_beleg_zu',`insert into public.posts(user_id,kind,media_url) values(auth.uid(),'reel',public.medien_adresse('${pfad}'))`));
 sql+=`update storage.objects set metadata=metadata||'{"size":1235}'::jsonb where id='${obj}';`;
 sql+=owner(check('privilegierter_austausch_entwertet',`not exists(select 1 from public.video_upload_belege where objekt_id='${obj}')`));
 sql+=als(A,deny('nach_austausch_zu',`insert into public.posts(user_id,kind,media_url) values(auth.uid(),'reel',public.medien_adresse('${pfad}'))`)+deny('als_foto_tarnen_zu',`insert into public.posts(user_id,kind,media_url) values(auth.uid(),'post',public.medien_adresse('${pfad}'))`));
 sql+=`insert into public.posts(id,user_id,kind,demo,description) select '${id(41)}',id,'reel',true,'Rollback: bekannte Demo-Vorlage' from public.profiles where id='3baafacd-bbdb-40fb-8ef4-a4e365ae00c4' and public.ist_testkonto(id);`;
 sql+=als(KONTENPOOL.partnerId,deny('demo_update_keine_ausnahme',`update public.posts set media_url=public.medien_adresse('${pfad}') where id='${id(41)}'`));
 sql+=owner(check('interne_testvorlage_weiter_möglich',`exists(select 1 from public.posts where description='Rollback: bekannte Demo-Vorlage' and demo)`));
 sql+=owner(check('anon_belege_zu',`not has_table_privilege('anon','public.video_upload_belege','SELECT')`)+check('beleg_update_zu',`not has_table_privilege('authenticated','public.video_upload_belege','UPDATE')`));
}
if(nr===132){
 // Bunny-Weg (live seit 28.10.): Beleg in medien_objekte.sekunden.
 const bp=`posts/${A}-bunny.mp4`,bq=`posts/${A}-ohne.mp4`;
 sql+=`set local role service_role;insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256,sekunden) values('${bp}','${A}','video/mp4',1000,repeat('b',64),75),('${bq}','${A}','video/mp4',1000,repeat('c',64),null);reset role;`;
 sql+=als(A,`insert into public.posts(id,user_id,kind,media_url,duration) values('${id(50)}',auth.uid(),'reel',public.medien_adresse('${bp}'),'0:01');`+check('bunny_dauer_aus_beleg',`(select duration='1:15' from public.posts where id='${id(50)}')`)+deny('bunny_ohne_sekunden_zu',`insert into public.posts(user_id,kind,media_url) values(auth.uid(),'reel',public.medien_adresse('${bq}'))`)+`insert into public.posts(id,user_id,kind) values('${id(51)}',auth.uid(),'reel');`+check('ohne_datei_erlaubt',`exists(select 1 from public.posts where id='${id(51)}')`));
 sql+=als(B,deny('bunny_fremd_zu',`insert into public.posts(user_id,kind,media_url) values(auth.uid(),'reel',public.medien_adresse('${bp}'))`));
 sql+=owner(check('sekunden_grenze',`(select count(*)=1 from pg_constraint where conname='medien_objekte_sekunden_check')`));
}
if(nr===133){
 const bild=`posts/${A}-k1.jpg`,vid=`posts/${A}-k2.mp4`,roh=`posts/${A}-k3.mp4`,fremd=`posts/${B}-f.jpg`;
 sql+=`insert into storage.objects(bucket_id,name,owner_id,metadata) values('media','${bild}','${A}','{"size":1234,"mimetype":"image/jpeg"}'),('media','${fremd}','${B}','{"size":1234,"mimetype":"image/jpeg"}');`;
 sql+=`set local role service_role;insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256,sekunden) values('${vid}','${A}','video/mp4',1000,repeat('d',64),30),('${roh}','${A}','video/mp4',1000,repeat('e',64),null);reset role;`;
 const liste=(...m)=>`jsonb_build_array(${m.map(([u,t])=>`jsonb_build_object('url',public.medien_adresse('${u}'),'typ','${t}')`).join(',')})`;
 sql+=als(A,`insert into public.posts(id,user_id,kind,medien) values('${id(60)}',auth.uid(),'post',${liste([bild,'image'],[vid,'video'])});`+
  check('karussell_ok',`(select media_url=public.medien_adresse('${bild}') and jsonb_array_length(medien)=2 from public.posts where id='${id(60)}')`)+
  deny('video_ohne_beleg_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',${liste([bild,'image'],[roh,'video'])})`)+
  deny('video_als_bild_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',${liste([vid,'image'])})`)+
  deny('fremdes_medium_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',${liste([fremd,'image'])})`)+
  deny('reel_mit_liste_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'reel',${liste([bild,'image'])})`)+
  deny('zusatzfeld_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',jsonb_build_array(jsonb_build_object('url',public.medien_adresse('${bild}'),'typ','image','x',1)))`)+
  `update public.posts set medien=${liste([vid,'video'],[bild,'image'])} where id='${id(60)}';`+
  check('umsortiert_titel_folgt',`(select media_url=public.medien_adresse('${vid}') from public.posts where id='${id(60)}')`)+
  deny('referenz_orakel_zu',`perform public.bunny_medium_referenziert('${bild}')`));
 sql+=owner(check('loeschschutz_zweites',`public.bunny_medium_referenziert('${bild}')`));
 sql+=als(B,check('zweites_medium_sichtbar',`public.medium_sichtbar('${bild}')`)+check('bunny_liste_lesbar',`exists(select 1 from public.medien_leseliste(array['${vid}']))`));
}
if(nr===136){
 sql+=als(A,`j:=public.meine_kontoanalysen();`+check('ohne_messwert_null_aufrufe',`(select (x->>'aufrufe')::int=0 from jsonb_array_elements(j->'zeitraeume'->0->'beitraege') x where x->>'id'='${Q}')`));
 sql+=owner(`insert into public.posts(id,user_id,kind,format,title,created_at) values('${id(90)}','${A}','clip','live','Livestream',now()-interval '125 seconds');`);
 sql+=als(A,`update public.posts set format='standard',title='Livestream-Aufzeichnung',duration='99:99' where id='${id(90)}';`+check('livestream_dauer_aus_start',`(select duration in ('02:05','02:06') from public.posts where id='${id(90)}')`));
}
if(nr===137){
 const ohneMesswert = (fenster) => `(select (x->>'aufrufe')::int=0 and (x->>'reichweite')::int=0 from jsonb_array_elements(j->'zeitraeume'->${fenster}->'beitraege') x where x->>'id'='${Q}')`;
 sql+=als(A,`j:=public.meine_kontoanalysen();`+check('ohne_messwert_7_tage',ohneMesswert(0))+check('ohne_messwert_30_tage',ohneMesswert(1)));
 for(const [nummer,sekunden,dauer] of [[90,125,'02:05'],[91,6059,'100:59'],[92,-23,'00:00']]){
  const stream=id(nummer);
  sql+=owner(`insert into public.posts(id,user_id,kind,format,title,created_at) values('${stream}','${A}','clip','live','Livestream',now()-make_interval(secs=>${sekunden}));`);
  sql+=als(A,`update public.posts set format='standard',title='Livestream-Aufzeichnung'${nummer===91?'':",duration='99:99'"} where id='${stream}';`+
   check('livestream_ende_'+nummer,`(select duration='${dauer}' from public.posts where id='${stream}')`)+
   `update public.posts set format='standard',duration='88:88' where id='${stream}';`+
   check('livestream_wiederholung_'+nummer,`(select duration='${dauer}' from public.posts where id='${stream}')`));
 }
}
if(nr===135){
 const st=`stories/${A}-s.jpg`;
 sql+=`insert into storage.objects(bucket_id,name,owner_id,metadata) values('media','${st}','${A}','{"size":10,"mimetype":"image/jpeg"}');`;
 sql+=als(A,deny('karussell_stories_zu',`insert into public.posts(user_id,kind,medien) values(auth.uid(),'post',jsonb_build_array(jsonb_build_object('url',public.medien_adresse('${st}'),'typ','image')))`)+
  `insert into public.posts(id,user_id,kind,description) values('${id(80)}',auth.uid(),'reel','ohne Datei');update public.posts set duration='19:00' where id='${id(80)}';`+check('update_ohne_datei_keine_dauer',`(select duration is null from public.posts where id='${id(80)}')`));
 sql+=als(B,`perform public.impression_vermerken('${Q}',2000,'feed');perform public.impression_vermerken('${Q}',2000,'reels');`);
 sql+=owner(`delete from public.post_impressions where post_id='${Q}' and user_id='${B}' and quelle='feed';`);
 sql+=als(A,`j:=public.meine_kontoanalysen();`+check('aufruf_bleibt_nach_loeschen',`(select (x->>'aufrufe')::int=1 from jsonb_array_elements(j->'zeitraeume'->0->'beitraege') x where x->>'id'='${Q}')`));
}
if(nr===134){
 sql+=als(B,`perform public.beitrag_reaktion('${P}','dislike');select punkte into n from public.feed_rang(array['${Q}'::uuid]);perform set_config('probe.q1',n::text,true);`+check('negativ_gesetzt',`exists(select 1 from public.post_dislikes where post_id='${P}')`));
 sql+=owner(`update public.posts set publish_at=now()+interval '1 day' where id='${P}';`);
 sql+=als(B,check('unsichtbare_quelle_wirkt_nicht',`(select punkte>current_setting('probe.q1')::numeric*2 from public.feed_rang(array['${Q}'::uuid]))`));
 sql+=als(B,`perform public.impression_vermerken('${Q}',2000,'feed');perform public.impression_vermerken('${Q}',2000,'feed');perform public.impression_vermerken('${Q}',290000,'reels');perform public.impression_vermerken('${Q}',290000,'profil');`);
 sql+=owner(check('ein_aufruf_je_tag',`(select sum(sichtungen)=1 from public.konto_sichtungen where post_id='${Q}' and zuschauer='${B}')`)+check('dauer_gedeckelt',`(select sum(dauer_ms)=300000 from public.konto_sichtungen where post_id='${Q}' and zuschauer='${B}')`));
 sql+=als(A,`insert into public.posts(id,user_id,kind,duration,description) values('${id(70)}',auth.uid(),'reel','19:59','ohne Datei');`+check('ohne_datei_keine_dauer',`(select duration is null from public.posts where id='${id(70)}')`));
 // Löschen direkt per SQL verbietet Supabase selbst; geprüft wird die Regel.
 sql+=owner(check('beitragsdatei_loeschsperre',`exists(select 1 from pg_policy where polname='post_upload_loeschsperre' and polrelid='storage.objects'::regclass and position('video_belegt' in pg_get_expr(polqual,polrelid))=0 and position('posts/%' in pg_get_expr(polqual,polrelid))>0)`));
 sql+=als(A,deny('orakel_zu',`perform public.bunny_medium_referenziert('posts/x.jpg')`));
}
if(nr===129){
 sql+=owner(check('anon_RPC_zu',`not has_function_privilege('anon','public.beitrag_reaktion(uuid,text)','EXECUTE')`)+check('anon_Rang_zu',`not has_function_privilege('anon','public.feed_rang(uuid[],text)','EXECUTE')`));
 sql+=als(B,`select punkte into n from public.feed_rang(array['${P}'::uuid]);perform set_config('probe.rang',n::text,true);`+
 check('dislike_an',`public.beitrag_reaktion('${P}','dislike')`)+check('eigen_lesbar',`(select count(*)=1 from public.post_dislikes where post_id='${P}')`)+check('rang_gesenkt',`(select punkte<current_setting('probe.rang')::numeric*0.03 from public.feed_rang(array['${P}'::uuid]))`)+
 check('like_verdrängt',`public.beitrag_reaktion('${P}','like')`)+check('dislike_weg',`not exists(select 1 from public.post_dislikes where post_id='${P}')`)+check('dislike_verdrängt',`public.beitrag_reaktion('${P}','dislike')`)+check('dislike_zurück',`not public.beitrag_reaktion('${P}','dislike')`)+deny('direkt_dislike_zu',`insert into public.post_dislikes(post_id,user_id) values('${P}',auth.uid())`)+deny('fremd_geplant_zu',`perform public.beitrag_reaktion('${F}','like')`)+check('rang_geplant_unsichtbar',`not exists(select 1 from public.feed_rang(array['${F}'::uuid]))`)+check('rang_demo_unsichtbar',`not exists(select 1 from public.feed_rang(array['${D}'::uuid]))`)+`perform public.beitrag_reaktion('${P}','dislike');`);
 sql+=als(C,check('fremd_dislike_privat',`not exists(select 1 from public.post_dislikes where post_id='${P}')`));
 sql+=als(A,check('eigen_geplant_like',`public.beitrag_reaktion('${F}','like')`));
 sql+=als(W,deny('wartend_RPC_zu',`perform public.beitrag_reaktion('${P}','dislike')`)+deny('wartend_Rang_zu',`perform public.feed_rang(array['${P}'::uuid])`)+check('wartend_liste_leer',`not exists(select 1 from public.post_dislikes)`));
 sql+=als(B,`insert into public.blocks(user_id,blocked_user_id) values(auth.uid(),'${A}');`+deny('blockiert_RPC_zu',`perform public.beitrag_reaktion('${P}','like')`)+check('blockiert_Rang_leer',`not exists(select 1 from public.feed_rang(array['${P}'::uuid]))`));
}
if(nr===130){
 sql+=owner(check('anon_Analyse_zu',`not has_function_privilege('anon','public.meine_kontoanalysen()','EXECUTE')`));
 sql+=als(B,`perform public.impression_vermerken('${P}',0,'feed');perform public.impression_vermerken('${P}',999,'feed');`+`perform public.impression_vermerken('${P}',1000,'feed');`+deny('rohzugriff_zu',`perform * from public.konto_sichtungen`)+deny('direkt_messen_zu',`insert into public.konto_sichtungen(impression_id,post_id,zuschauer,tag,folgt,sichtungen,dauer_ms) values(gen_random_uuid(),'${P}',auth.uid(),current_date,false,99,99000)`)+`perform public.impression_vermerken('${F}',1000,'feed');`);
 sql+=owner(check('kurz_nicht_gezählt',`(select coalesce(sum(sichtungen),0)=1 and coalesce(sum(dauer_ms),0)=1000 from public.konto_sichtungen where post_id='${P}' and zuschauer='${B}')`)+check('geplant_nicht_gemessen',`not exists(select 1 from public.konto_sichtungen where post_id='${F}')`));
 sql+=als(A,`perform public.impression_vermerken('${P}',2000,'feed');j:=public.meine_kontoanalysen();`+check('echte_reichweite_eins',`(j->'zeitraeume'->0->>'reichweite')::int=1`)+check('aufrufe_eins',`(j->'zeitraeume'->0->>'aufrufe')::int=1`)+check('dauer_1000',`(j->'zeitraeume'->0->>'sichtzeitMs')::int=1000`)+check('nichtfollower_eins',`(j->'zeitraeume'->0->>'nichtFollowerAufrufe')::int=1`)+check('kleine_laender_verborgen',`j->'zeitraeume'->0->'laender'='[]'::jsonb`));
 sql+=als(C,`insert into public.follows(follower_id,followee_id) values(auth.uid(),'${A}');perform public.impression_vermerken('${P}',1500,'reels');insert into public.post_likes(post_id,user_id) values('${P}',auth.uid());j:=public.meine_kontoanalysen();`+check('fremde_Analyse_leer',`(j->'zeitraeume'->0->>'reichweite')::int=0`));
 sql+=als(A,`j:=public.meine_kontoanalysen();`+check('follower_gezählt',`(j->'zeitraeume'->0->>'followerAufrufe')::int=1`)+check('reichweite_zwei',`(j->'zeitraeume'->0->>'reichweite')::int=2`)+check('interaktion_eins',`(j->'zeitraeume'->0->>'interaktionen')::int=1`));
 sql+=als(W,deny('wartend_Analyse_zu',`perform public.meine_kontoanalysen()`)+`perform public.impression_vermerken('${P}',5000,'feed');`);
 sql+=owner(check('wartend_nicht_gezählt',`not exists(select 1 from public.konto_sichtungen where zuschauer='${W}')`));
}
if(nr===131){
 sql+=`insert into public.follows(follower_id,followee_id) values('${A}','${B}'),('${B}','${A}'),('${A}','${C}'),('${C}','${A}');`;
 const pfad=`instants/${A}/probe.jpg`;
 sql+=owner(check('anon_Instant_zu',`not has_function_privilege('anon','public.instant_senden(text,text)','EXECUTE')`)+check('aufräumer_nur_dienst',`not has_function_privilege('authenticated','public.instant_loeschkandidaten()','EXECUTE')`));
 sql+=`insert into storage.objects(bucket_id,name,owner_id,metadata) values('media','${pfad}','${A}','{"size":1234,"mimetype":"image/jpeg"}');`;
 sql+=als(A,`insert into public.enge_freunde(user_id,freund_id) values(auth.uid(),'${B}'),(auth.uid(),'${C}');`+check('empfaenger_zwei',`public.instant_empfaengerzahl()=2`)+`v:=public.instant_senden('${pfad}','Hallo');perform set_config('probe.instant',v::text,true);`+check('absender_zugang',`intern.instant_zugang(v)`)+deny('direkt_instant_zu',`insert into public.instants(absender,bild_pfad) values(auth.uid(),'${pfad}x')`));
 sql+=als(C,check('liste_privatsphäre',`not exists(select 1 from public.enge_freunde where user_id='${A}')`)+check('postfach_eins',`(select count(*)=1 from public.instant_postfach())`)+check('badge_eins',`public.instant_stand()=1`)+check('direkt_storage_zu',`not exists(select 1 from storage.objects where bucket_id='media' and name='${pfad}')`)+deny('fremd_zurückziehen_zu',`perform public.instant_zurueckziehen(current_setting('probe.instant')::uuid)`));
 sql+=als(B,check('oeffnen_ok',`public.instant_oeffnen(current_setting('probe.instant')::uuid)`)+check('badge_danach_null',`public.instant_stand()=0`)+check('geöffnet_unzugänglich',`not intern.instant_zugang(current_setting('probe.instant')::uuid)`)+deny('zweites_oeffnen_zu',`perform public.instant_oeffnen(current_setting('probe.instant')::uuid)`));
 sql+=als(W,check('wartend_postfach_leer',`public.instant_stand()=0`)+deny('wartend_senden_zu',`perform public.instant_senden('${pfad}','x')`)+deny('wartend_liste_zu',`insert into public.enge_freunde(user_id,freund_id) values(auth.uid(),'${A}')`));
 sql+=als(C,`insert into public.blocks(user_id,blocked_user_id) values(auth.uid(),'${A}');`+check('blockiert_zugang_zu',`not intern.instant_zugang(current_setting('probe.instant')::uuid)`)+check('blockiert_badge_null',`public.instant_stand()=0`));
 sql+=als(A,check('blockierte_liste_weg',`not exists(select 1 from public.enge_freunde where freund_id='${C}')`)+`perform public.instant_zurueckziehen(current_setting('probe.instant')::uuid);`+check('zurückgezogen_zu',`not intern.instant_zugang(current_setting('probe.instant')::uuid)`));
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
 const table={129:'post_dislikes',130:'konto_sichtungen',131:'instants',132:'video_upload_belege',133:'video_upload_belege',134:'post_dislikes',135:'post_dislikes',136:'post_dislikes',137:'posts'}[nr];
 const nach=await query(`select (select count(*) from auth.users where id='${A}') as konten,to_regclass('public.${table}') as tabelle`);
 // Seit 21.11. sind 129–133 live: nur noch die Wegwerfkonten zählen.
 const sauber=Array.isArray(nach)&&Number(nach[0]?.konten)===0;
 console.log(`Rollback-Kontrolle: ${sauber?'1/1':'0/1'} (Wegwerfkonten und neues Schema fehlen)`);
 process.exitCode=checks.every(c=>ok.has(c))&&sauber?0:1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
