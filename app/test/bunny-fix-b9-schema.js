/** Kein Kontolöschweg: FK verhindert vorzeitigen Verlust des Bunny-Löschbelegs. */
const S=require('./_af_fix_sql'),{schema,konto,id,check,admin}=S,{quelle}=require('./_bunny_fix_quelle');
const A=id(1),pfad=`posts/${A}-b9.jpg`;
let sql=S.anfang();for(const n of [89,90,94,97,98,99,107,109,110,111])sql+=schema(n);
sql+=quelle('SUPABASE_SCHEMA_113_bunny_karussell.sql').replace(/^\s*(begin|commit|rollback)\s*;\s*$/gmi,'');
sql+=konto(1)+`set local role service_role;insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256) values('${pfad}','${A}','image/jpeg',200,repeat('a',64));reset role;`;
sql+=admin(`begin delete from auth.users where id='${A}';exception when foreign_key_violation then null;end;`+check('B9_Kontoloeschung_mit_Bytebeleg_gesperrt',`exists(select 1 from public.profiles where id='${A}') and exists(select 1 from public.medien_objekte where pfad='${pfad}')`));
sql+=`delete from public.medien_objekte where pfad='${pfad}';delete from auth.users where id='${A}';`+admin(check('B9_nach_expliziter_Dateibereinigung_Konto_loeschbar',`not exists(select 1 from auth.users where id='${A}') and not exists(select 1 from public.profiles where id='${A}')`));
S.ausfuehren(sql).catch(e=>{console.error(e.message);process.exitCode=1;});
