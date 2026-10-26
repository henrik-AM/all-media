/** Dienstrollenfehler vorher reproduzieren, korrigierten Trigger mit RLS vergleichen. */
const S=require('./_af_fix_sql'),{schema,konto,id,check,deny,als}=S,{quelle}=require('./_bunny_fix_quelle');
const A=id(1),P=id(10),film=`posts/${A}-film.mp4`,roh=`posts/${A}-roh.mp4`;
const liste=p=>`jsonb_build_array(jsonb_build_object('url',public.medien_adresse('${p}'),'typ','video'))`;
let sql=S.anfang();for(const n of [89,90,94,97,98,99,107,109,110,111])sql+=schema(n);
sql+=quelle('SUPABASE_SCHEMA_113_bunny_karussell.sql').replace(/^\s*(begin|commit|rollback)\s*;\s*$/gmi,'');
sql+=konto(1)+`set local role service_role;insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256,sekunden) values('${film}','${A}','video/mp4',1000,repeat('a',64),10),('${roh}','${A}','video/mp4',1000,repeat('b',64),null);reset role;`;
sql+=als(A,`insert into public.posts(id,user_id,kind,medien) values('${P}',auth.uid(),'post',${liste(film)});`+check('B7_Klient_mit_Videobeleg_erlaubt',`exists(select 1 from public.posts where id='${P}')`));
sql+=als(id(2),`update public.posts set medien=${liste(film)}||${liste(film)} where id='${P}';`+check('B7_Dienstrolle_darf_Medienliste_pflegen',`(select jsonb_array_length(medien)=2 from public.posts where id='${P}')`),'service_role');
sql+=als(A,deny('B7_Klient_ohne_Videobeleg_weiter_gesperrt',`update public.posts set medien=${liste(roh)} where id='${P}'`));
S.ausfuehren(sql).catch(e=>{console.error(e.message);process.exitCode=1;});
