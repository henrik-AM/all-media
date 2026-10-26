/** Ausschließlich Schema-/Rollenproben mit erzwungenem Rollback; niemals Anmeldung/Medien. */
const fs=require('node:fs'),path=require('node:path');
const {quelle}=require('./_af_fix_quelle');
const root=path.resolve(__dirname,'../..');
const id=n=>`cf260026-0000-4000-8000-${String(n).padStart(12,'0')}`;
const checks=[];
function schema(n,basis=false){const f=fs.readdirSync(root).find(p=>p.startsWith(`SUPABASE_SCHEMA_${n}_`));let s;if(basis){const alt=process.env.AF_FIX_BASIS;process.env.AF_FIX_BASIS='1';s=quelle(f);if(alt)process.env.AF_FIX_BASIS=alt;else delete process.env.AF_FIX_BASIS;}else s=fs.readFileSync(path.join(root,f),'utf8');s=s.replace(/^\s*(begin|commit|rollback)\s*;\s*$/gmi,'');if(/^\s*(commit|rollback)\b/im.test(s))throw Error('Transaktionsabschluss im Schema');return s;}
const check=(n,e)=>{checks.push(n);return `perform pg_temp.pruefe('${n}',(${e}));`;};
const deny=(n,s)=>{checks.push(n);return `begin ${s};perform pg_temp.pruefe('${n}',false);exception when insufficient_privilege or raise_exception or unique_violation then if sqlerrm like 'PRUEFFEHLER:%' then raise;end if;perform pg_temp.pruefe('${n}',true);end;`;};
const als=(u,s,rolle='authenticated')=>`reset role;select set_config('request.jwt.claims','{"sub":"${u}","role":"${rolle}"}',true),set_config('request.jwt.claim.sub','${u}',true);set local role ${rolle};do $probe$ declare n bigint;v uuid;j jsonb;begin ${s} end $probe$;reset role;`;
const admin=s=>`reset role;do $probe$ begin ${s} end $probe$;`;
function anfang(){checks.length=0;return `begin;set local statement_timeout='45s';select set_config('probe.erg','',true);create function pg_temp.pruefe(n text,b boolean) returns void language plpgsql as $$begin if b is not true then raise exception 'PRUEFFEHLER:%',n;end if;perform set_config('probe.erg',current_setting('probe.erg',true)||n||'|',true);end $$;\n`;}
function konto(n,status='frei',datum='1990-01-01'){const u=id(n);return `insert into auth.users(id,email,raw_user_meta_data) values('${u}','af-fix-${n}@example.invalid','{"name":"AF Fix ${n}","handle":"@affix${n}","geburtsdatum":"${datum}","land":"DE"}');update public.konto_alter set status='${status}',geburtsdatum='${datum}' where user_id='${u}';`;}
async function ausfuehren(sql){require('./_ki_belegung').pruefeBelegung('supabase-schema');delete globalThis.__kiBelegungGeprueft;require('./_ki_belegung').pruefeBelegung('testbestand');
 sql+=`reset role;do $$begin raise exception 'AF_FIX_ROLLBACK:%',current_setting('probe.erg',true);end $$;rollback;`;
 if(process.env.AF_FIX_SQL){fs.writeFileSync(process.env.AF_FIX_SQL,sql);return;}
 const token=process.env.SUPABASE_TOKEN;if(!token)throw Error('SUPABASE_TOKEN fehlt');
 const ref=fs.readFileSync(path.join(root,'app/.env.local'),'utf8').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
 const query=async query=>{const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000)});return r.json();};
 const result=JSON.stringify(await query(sql)),match=result.match(/AF_FIX_ROLLBACK:([^"\\]*)/);
 const ok=new Set(match?.[1].split('|')||[]);for(const c of checks)console.log(`${ok.has(c)?'OK':'FEHL'} ${c}`);
 if(!match)console.error(result.slice(0,1500));
 console.log(`${checks.filter(c=>ok.has(c)).length}/${checks.length} Rollenprüfungen, verworfen`);
 const nach=await query(`select (select count(*) from auth.users where id::text like 'cf260026-%') as konten,to_regclass('public.instants') as instants,to_regclass('public.video_upload_belege') as belege,to_regclass('public.medien_objekte') as bunny`);
 const sauber=Array.isArray(nach)&&Number(nach[0]?.konten)===0&&nach[0]?.instants===null&&nach[0]?.belege===null&&nach[0]?.bunny===null;
 console.log(`Rollback-Kontrolle ${sauber?'1/1':'0/1'}`);if(!sauber||checks.some(c=>!ok.has(c)))process.exitCode=1;
}
module.exports={id,schema,check,deny,als,admin,anfang,konto,ausfuehren};
