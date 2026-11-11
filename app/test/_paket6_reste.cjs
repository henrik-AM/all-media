/** Wiederaufnahme nur der protokollierten Paket-6-Fixtures, ohne Reset. */
require('./_ki_belegung').pruefeBelegung('testbestand');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(process.env.AM_ENV_DATEI)process.loadEnvFile(process.env.AM_ENV_DATEI);
const {TESTKONTO_PASS,PRUEFKONTO_PASS}=require('./_testpasswoerter');
const {createClient}=require('@supabase/supabase-js');
const datei=path.resolve(__dirname,'../../pruefbelege/paket-6/live-fixtures.json');
const m=JSON.parse(fs.readFileSync(datei));
const ids=['3baafacd-bbdb-40fb-8ef4-a4e365ae00c4','62616c1d-82e2-4ee4-aab9-950e40e438a4'];
const konten=[['test@all-media.app',TESTKONTO_PASS],['all.media.prueflauf@web.de',PRUEFKONTO_PASS]];
const q=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data;};
(async()=>{
 assert.match(m.chatId,/^[a-f0-9-]{36}$/);assert.match(m.lauf,/^[a-f0-9-]{36}$/);
 const clients=[];
 try{
  for(let i=0;i<2;i++){
   const c=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(c);
   const r=await c.auth.signInWithPassword({email:konten[i][0],password:konten[i][1]});if(r.error)throw r.error;assert.equal(r.data.user.id,ids[i]);
  }
  const a=clients[0];const ch=await q(a.from('chats').select('id,name,created_by').eq('id',m.chatId).maybeSingle());
  if(ch){assert.equal(ch.name,'Paket 6 '+m.lauf);assert.equal(ch.created_by,ids[0]);}
  for(let i=0;i<2;i++){
   const weg=await q(clients[i].from('messages').delete().eq('chat_id',m.chatId).eq('sender_id',ids[i]).select('id'));console.log('Eigene Nachrichten entfernt',i,weg.length);
  }
  await q(clients[1].from('chat_members').delete().eq('chat_id',m.chatId).eq('user_id',ids[1]).select('user_id'));
  const weg=await q(a.from('chats').delete().eq('id',m.chatId).select('id'));console.log('Eigener Chat entfernt',weg.length);
  let rest=0;
  for(let i=0;i<2;i++){
   const keys=m.schluessel.filter(k=>k.konto===ids[i]).map(k=>k.id);
   if(keys.length){await q(clients[i].from('krypto_schluessel').delete().in('id',keys).eq('user_id',ids[i]).select('id'));rest+=(await q(clients[i].from('krypto_schluessel').select('id').in('id',keys))).length;}
   for(const t of ['chats','messages','chat_members'])rest+=(await q(clients[i].from(t).select(t==='chat_members'?'user_id':'id').eq(t==='chats'?'id':'chat_id',m.chatId))).length;
  }
  console.log('Geprüfter Rest',rest);m.rest=rest;m.nachbereinigung=new Date().toISOString();fs.writeFileSync(datei,JSON.stringify(m,null,2));assert.equal(rest,0);
 }finally{for(const c of clients)await c.auth.signOut({scope:'local'});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
