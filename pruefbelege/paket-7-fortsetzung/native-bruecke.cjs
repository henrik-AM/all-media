// Lokale Prüfsteuerung. Sitzungstoken nur im Arbeitsspeicher und Loopback-Antwort.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'app');
require(path.join(app,'test/_ki_belegung')).pruefeBelegung('testbestand');
process.loadEnvFile(path.join(app,'.env.local'));
process.env.SUPABASE_TOKEN=fs.readFileSync('/Users/henrik.dikta/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/2.Gehirn.md/04 Ressourcen/Zugangsdaten/Supabase.md','utf8').match(/sbp_[A-Za-z0-9_-]{20,}/)[0];
const {frage}=require(path.join(app,'test/_aufraeumen')),{createClient}=require(path.join(app,'node_modules/@supabase/supabase-js'));
const url=process.env.EXPO_PUBLIC_SUPABASE_URL,anon=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const {TESTKONTO_PASS,PRUEFKONTO_PASS}=require(path.join(app,'test/_testpasswoerter'));
const konten=[{name:'A',mail:'test@all-media.app',pass:TESTKONTO_PASS},{name:'B',mail:'all.media.prueflauf@web.de',pass:PRUEFKONTO_PASS}];
const lauf=crypto.randomUUID(),chats=[{id:crypto.randomUUID(),isGroup:false,bereich:'messenger'},{id:crypto.randomUUID(),isGroup:true,bereich:'messenger'}];
let server,queue=[],nr=0,results=new Map(),bereit=false,endet=false;
const manifest={lauf,chats:chats.map(c=>c.id),rest:null};
function sichern(){fs.writeFileSync(path.join(__dirname,'native-fixtures.json'),JSON.stringify(manifest,null,2));}
async function cleanup(){if(endet)return;endet=true;const ids=chats.map(c=>"'"+c.id+"'").join(',');
 const r=await frage(`begin;delete from messages where chat_id in (${ids});delete from chat_members where chat_id in (${ids});delete from chats where id in (${ids}) and name='P7 Stumm ${lauf}';commit;select (select count(*) from chats where id in (${ids}))+(select count(*) from chat_members where chat_id in (${ids}))+(select count(*) from messages where chat_id in (${ids})) rest`);manifest.rest=r[0].rest;sichern();console.log('Fixture-Rest',manifest.rest);for(const s of konten){s.client?.auth.stopAutoRefresh();await s.client?.removeAllChannels();}}
async function command(body){const n=++nr;queue.push({...body,nr:n});const end=Date.now()+20000;while(!results.has(n)&&Date.now()<end)await new Promise(r=>setTimeout(r,30));if(!results.has(n))throw Error('Native Befehlszeitgrenze '+body.art);const r=results.get(n);results.delete(n);return r;}
(async()=>{for(const s of konten){s.client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await s.client.auth.signInWithPassword({email:s.mail,password:s.pass});if(error)throw error;s.id=data.user.id;s.session=data.session;}
 sichern();const a=konten[0];await frage(`begin;insert into chats(id,name,is_group,bereich,created_by,anfrage_zustand) values ${chats.map(c=>`('${c.id}','P7 Stumm ${lauf}',${c.isGroup},'messenger','${a.id}','angenommen')`).join(',')};insert into chat_members(chat_id,user_id) values ${chats.flatMap(c=>konten.map(s=>`('${c.id}','${s.id}')`)).join(',')};commit;select 1 ok`);
 server=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');try{let raw='';for await(const b of req){raw+=b;if(raw.length>50000)throw Error('Zu groß');}const d=raw?JSON.parse(raw):{};let out={ok:true};
 if(req.url==='/start')out={url,anon,chats,konten:konten.map(s=>({id:s.id,name:s.name,sitzung:{access_token:s.session.access_token,refresh_token:s.session.refresh_token}}))};
 else if(req.url==='/bereit'){bereit=true;console.log('NATIVE BEREIT');}
 else if(req.url==='/status')out={bereit,manifest};
 else if(req.url==='/poll')out=queue.shift()||null;
 else if(req.url==='/result')results.set(d.nr,d);
 else if(req.url==='/cmd')out=await command(d);
 else if(req.url==='/remote'){const s=konten[d.konto||0];const r=await s.client.from('chat_members').update({notifications_off:d.wert}).eq('chat_id',chats[d.gruppe?1:0].id).eq('user_id',s.id);if(r.error)throw r.error;}
 else if(req.url==='/db'){const r=await frage(`select chat_id,user_id,notifications_off from chat_members where chat_id in (${chats.map(c=>"'"+c.id+"'").join(',')}) order by chat_id,user_id`);out={rows:r};}
 else if(req.url==='/ende'){await cleanup();res.end(JSON.stringify({ok:true,rest:manifest.rest}));server.close();return;}
 else throw Error('Unbekannt');res.end(JSON.stringify(out));
 }catch(e){console.log('BRUECKE FEHLER',e.message);res.statusCode=500;res.end(JSON.stringify({fehler:e.message}));}});
 await new Promise(r=>server.listen(3302,'127.0.0.1',r));console.log('BRUECKE BEREIT 3302',lauf);
})().catch(async e=>{console.error(e.message);try{await cleanup();}finally{process.exit(1);}});
process.on('SIGTERM',async()=>{try{await cleanup();}finally{process.exit(1);}});
