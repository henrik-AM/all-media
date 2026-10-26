/** Index und tatsächlichen OR-Abfrageplan in verworfener Transaktion prüfen. */
const S=require('./_af_fix_sql'),{schema,check,admin}=S,{quelle}=require('./_bunny_fix_quelle');
let sql=S.anfang();for(const n of [89,90,94,97,98,99,107,109,110,111])sql+=schema(n);
sql+=quelle('SUPABASE_SCHEMA_113_bunny_karussell.sql').replace(/^\s*(begin|commit|rollback)\s*;\s*$/gmi,'');
sql+=admin(check('B12_GIN_Index_mit_jsonb_path_ops',`exists(select 1 from pg_indexes where schemaname='public' and tablename='posts' and indexname='posts_medien_gin' and indexdef like '%USING gin (medien jsonb_path_ops)%')`));
sql+=`set local enable_seqscan=off;do $probe$ declare j json;begin execute $plan$explain(format json) select 1 from public.posts where media_url='https://probe.invalid/alt.jpg' or medien @> '[{"url":"https://probe.invalid/alt.jpg"}]'::jsonb$plan$ into j;`+check('B12_OR_Abfrage_kann_GIN_und_Altindex_kombinieren',`j::text like '%posts_medien_gin%' and j::text like '%posts_media_url_idx%' and j::text like '%BitmapOr%'`)+`end $probe$;set local enable_seqscan=on;`;
S.ausfuehren(sql).catch(e=>{console.error(e.message);process.exitCode=1;});
