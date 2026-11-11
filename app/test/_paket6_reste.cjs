/** Wiederaufnahme nur der protokollierten Paket-6-Fixtures, ohne Reset. */
require('./_ki_belegung').pruefeBelegung('testbestand');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(process.env.AM_ENV_DATEI)process.loadEnvFile(process.env.AM_ENV_DATEI);
const {TESTKONTO_PASS,PRUEFKONTO_PASS}=require('./_testpasswoerter');
const {createClient}=require('@supabase/supabase-js');
const art=process.argv[2]||'live';
if(!['live','native'].includes(art)||process.argv.length>3)throw Error('Nur live oder native als Journalwahl erlaubt');
const datei=path.resolve(__dirname,'../../pruefbelege/paket-6/'+(art==='native'?'native-live-fixtures.json':'live-fixtures.json'));
const m=JSON.parse(fs.readFileSync(datei));
const ids=['3baafacd-bbdb-40fb-8ef4-a4e365ae00c4','62616c1d-82e2-4ee4-aab9-950e40e438a4'];
const konten=[['test@all-media.app',TESTKONTO_PASS],['all.media.prueflauf@web.de',PRUEFKONTO_PASS]];
const {schreiben}=require('./_paket6_journal.cjs');
const q=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data;};
(async()=>{
 const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
 if(m.chatId!==null)assert.match(m.chatId,uuid);assert.match(m.lauf,uuid);
 assert.equal(m.supabaseUrl,process.env.EXPO_PUBLIC_SUPABASE_URL,'Journal gehört nicht zur aktuellen Datenbank');
 assert.ok(Array.isArray(m.schluessel),'Gerätejournal fehlt');
 for(const k of m.schluessel){assert.ok(ids.includes(k.konto),'Unbekanntes Gerätekonto');assert.match(k.id,uuid);}
 // Alte Journale ohne Grundstand dürfen keinen falschen Leerstand bestätigen.
 for(const id of ids){assert.ok(Array.isArray(m.schluesselVorher?.[id]),'Geräte-Grundstand fehlt; manuelle Prüfung erforderlich');for(const k of m.schluesselVorher[id])assert.match(k,uuid);}
 if(!Array.isArray(m.nachrichten))throw Error('Nachrichtenjournal fehlt');for(const id of m.nachrichten)assert.match(id,uuid);
 for(const id of ids){assert.ok(Array.isArray(m.kontakteVorher?.[id]),'Kontaktgrundstand fehlt; manuelle Prüfung erforderlich');for(const k of m.kontakteVorher[id])assert.match(k,uuid);}

 const clients=[];
 try{
  for(let i=0;i<2;i++){
   const c=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(c);
   const r=await c.auth.signInWithPassword({email:konten[i][0],password:konten[i][1]});if(r.error)throw r.error;assert.equal(r.data.user.id,ids[i]);
  }
  const a=clients[0];
  if(m.chatId!==null){const ch=await q(a.from('chats').select('id,name,created_by').eq('id',m.chatId).maybeSingle());
  if(ch){assert.equal(ch.name,'Paket 6 '+m.lauf);assert.equal(ch.created_by,ids[0]);}
  const vor=await q(a.from('messages').select('id').eq('chat_id',m.chatId));m.nachrichten=[...new Set([...m.nachrichten,...vor.map(n=>n.id)])];schreiben(datei,m,fs);
  for(let i=0;i<2;i++){
   const weg=await q(clients[i].from('messages').delete().eq('chat_id',m.chatId).eq('sender_id',ids[i]).select('id'));console.log('Eigene Nachrichten entfernt',i,weg.length);
  }
  await q(clients[1].from('chat_members').delete().eq('chat_id',m.chatId).eq('user_id',ids[1]).select('user_id'));
  const weg=await q(a.from('chats').delete().eq('id',m.chatId).select('id'));console.log('Eigener Chat entfernt',weg.length);}
  let rest=0;
  for(let i=0;i<2;i++){
   if(m.nachrichten.length)rest+=(await q(clients[i].from('message_keys').select('message_id').in('message_id',m.nachrichten))).length;
   const keys=m.schluessel.filter(k=>k.konto===ids[i]).map(k=>k.id);
   if(keys.length){await q(clients[i].from('krypto_schluessel').delete().in('id',keys).eq('user_id',ids[i]).select('id'));rest+=(await q(clients[i].from('krypto_schluessel').select('id').in('id',keys))).length;}
   rest+=(await q(clients[i].from('krypto_schluessel').select('id').eq('user_id',ids[i]))).filter(k=>!m.schluesselVorher[ids[i]].includes(k.id)).length;
   const neu=(await q(clients[i].from('contacts').select('id').eq('user_id',ids[i]).in('contact_id',ids))).filter(k=>!m.kontakteVorher[ids[i]].includes(k.id));
   if(neu.length){await q(clients[i].from('contacts').delete().eq('user_id',ids[i]).in('id',neu.map(k=>k.id)).select('id'));rest+=(await q(clients[i].from('contacts').select('id').in('id',neu.map(k=>k.id)))).length;}
   if(m.chatId!==null)for(const t of ['chats','messages','chat_members'])rest+=(await q(clients[i].from(t).select(t==='chat_members'?'user_id':'id').eq(t==='chats'?'id':'chat_id',m.chatId))).length;
  }
  console.log('Geprüfter Rest',rest);m.rest=rest;m.nachbereinigung=new Date().toISOString();schreiben(datei,m,fs);assert.equal(rest,0);
 }finally{for(const c of clients)await c.auth.signOut({scope:'local'});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
