/** Schema127 auf echten Triggern/RLS verworfen proben; ausschließlich eigene Fixture-UUIDs. */
require('./_ki_belegung').pruefeBelegung('testbestand');
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {frage}=require('./_aufraeumen');
const A='3baafacd-bbdb-40fb-8ef4-a4e365ae00c4',B='62616c1d-82e2-4ee4-aab9-950e40e438a4';
const chat=crypto.randomUUID(),neu=crypto.randomUUID(),alt=crypto.randomUUID();
const out=path.resolve(__dirname,'../../pruefbelege/paket67-abschluss');fs.mkdirSync(out,{recursive:true});
const schema=fs.readFileSync(path.resolve(__dirname,'../../SUPABASE_SCHEMA_127_krypto_kontext.sql'),'utf8').replace(/^begin;\s*$/mg,'').replace(/^commit;\s*$/mg,'');
const mark=(k,v)=>`perform set_config('probe127.erg',current_setting('probe127.erg')||'${k}='||(${v})::text||' ',true);`;
const attempt=(k,sql,code='23514')=>`begin ${sql};${mark(k,"'offen'")} exception when sqlstate '${code}' then ${mark(k,"'zu'")} when others then ${mark(k,"'anders:'||sqlstate")} end;`;
const own=(id,s)=>`reset role;select set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated"}',true),set_config('request.jwt.claim.sub','${id}',true);set local role authenticated;do $p$ declare n int;begin ${s} end $p$;reset role;`;
const insert=(id,krypto,time='now()',text="''")=>`insert into public.messages(id,chat_id,sender_id,text,krypto,chiffre,krypto_nonce,absender_schluessel,krypto_gesendet_am) values('${id}','${chat}','${A}',${text},${krypto},'probe-chiffre','probe-nonce','probe-absender',${time})`;
(async()=>{
 if(!process.env.SUPABASE_TOKEN)throw Error('Verwaltungstoken fehlt');
 const vor=await frage("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='krypto_gesendet_am') spalte,(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.messages'::regclass and conname='messages_krypto_stimmig') check_def");
 assert.equal(vor[0].spalte,false,'Probe verlangt unveröffentlichtes Schema127, nicht blind erneut anwenden');
 const sql=`begin;
 select set_config('probe127.erg','',true),set_config('probe127.acl',(select relacl::text from pg_class where oid='public.messages'::regclass),true);
 ${schema}
 ${schema}
 do $p$ begin
 ${mark('acl',"(select relacl::text from pg_class where oid='public.messages'::regclass)=current_setting('probe127.acl')")}
 ${mark('rls',"(select relrowsecurity from pg_class where oid='public.messages'::regclass)")}
 ${mark('schema95',"exists(select 1 from pg_trigger where tgrelid='public.messages'::regclass and tgname='spalten_fest')")}
 ${mark('acl_anon',"not has_function_privilege('anon','public.krypto_zeit_fest()','EXECUTE')")}
 ${mark('acl_auth',"not has_function_privilege('authenticated','public.krypto_zeit_fest()','EXECUTE')")}
 insert into public.chats(id,name,is_group,bereich,created_by,anfrage_zustand) values('${chat}','Probe127 verworfen',true,'messenger','${A}','angenommen');
 insert into public.chat_members(chat_id,user_id) values('${chat}','${A}'),('${chat}','${B}');
 end $p$;
 ${own(A,`${insert(neu,2)};${mark('format2',`exists(select 1 from messages where id='${neu}' and krypto=2 and text='')`)}
 ${insert(alt,1,'null')};${mark('format1',`exists(select 1 from messages where id='${alt}' and krypto=1)`)}
 update messages set chiffre='bearbeitet' where id='${neu}';${mark('bearbeiten',`(select chiffre='bearbeitet' from messages where id='${neu}')`)}
 ${attempt('zeit_fest',`update messages set krypto_gesendet_am=krypto_gesendet_am+interval '1 second' where id='${neu}'`)}
 ${attempt('schema95_fest',`update messages set created_at=created_at+interval '1 second' where id='${neu}'`,'42501')}
 ${attempt('ohne_zeit',insert(crypto.randomUUID(),2,'null'))}
 ${attempt('klartext',insert(crypto.randomUUID(),2,'now()',"'nicht erlaubt'"))}
 ${attempt('version3',insert(crypto.randomUUID(),3))}
 ${attempt('zu_alt',insert(crypto.randomUUID(),2,"now()-interval '1 day'"))}
 ${attempt('zu_neu',insert(crypto.randomUUID(),2,"now()+interval '1 day'"))}`)}
 ${own(B,`${mark('mitglied_liest',`(select count(*)=2 from messages where chat_id='${chat}')`)}
 update messages set chiffre='fremd' where id='${neu}';get diagnostics n=row_count;${mark('fremd_update','n=0')}`)}
 do $p$ begin delete from chat_members where chat_id='${chat}' and user_id='${B}';end $p$;
 ${own(B,`${mark('entzug_liest_nicht',`(select count(*)=0 from messages where chat_id='${chat}')`)}
 ${attempt('entzug_schreibt_nicht',`insert into messages(chat_id,sender_id,text) values('${chat}','${B}','gesperrt')`,'42501')}`)}
 set local role anon;do $p$ declare n int;begin
 begin select count(*) into n from messages where chat_id='${chat}';${mark('anon_liest_nicht','n=0')} exception when insufficient_privilege then ${mark('anon_liest_nicht','true')} end;
 end $p$;reset role;
 do $p$ begin raise exception 'PROBE127 %',current_setting('probe127.erg');end $p$;
 rollback;`;
 const r=await frage(sql,{erwarteterFehler:/PROBE127 /});assert.ok(r.message?.includes('PROBE127 '),'Ergebnis der verworfenen Probe fehlt');
 const vals=Object.fromEntries([...r.message.matchAll(/([a-z0-9_]+)=([^\s]+)/g)].map(m=>[m[1],m[2]]));let gut=0,gesamt=0;
 for(const [k,v] of Object.entries(vals)){gesamt++;const ok=v==='true'||v==='zu';if(ok)gut++;console.log(ok?'OK':'FEHL',k,v);}
 assert.ok(gesamt>=19,'Nicht alle Proben wurden ausgeführt');
 const nach=await frage(`select exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='krypto_gesendet_am') spalte,(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.messages'::regclass and conname='messages_krypto_stimmig') check_def,(select count(*) from chats where id='${chat}')+(select count(*) from chat_members where chat_id='${chat}')+(select count(*) from messages where chat_id='${chat}') rest`);
 for(const [k,ok] of [['spalte_weg',nach[0].spalte===false],['check_erhalten',nach[0].check_def===vor[0].check_def],['fixtures_rest0',Number(nach[0].rest)===0]]){gesamt++;if(ok)gut++;console.log(ok?'OK':'FEHL',k);}
 fs.writeFileSync(path.join(out,'schema127-live-probe.json'),JSON.stringify({chat,neu,alt,vor,nach,werte:vals,gut,gesamt},null,2));console.log(`${gut}/${gesamt} verworfene Live-Schema127-Prüfungen, Rest ${nach[0].rest}`);assert.equal(gut,gesamt);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
