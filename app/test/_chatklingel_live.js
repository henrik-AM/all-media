/** Paket 7: echte private Broadcasts, zwei erlaubte Konten, kein Reset.
 * Gegenlesen jeder Änderung, Zeitmessung ab VOR dem Schreiben.
 * Cleanup ausschließlich eigene Lauf-Chat-IDs; anschließend Restkontrolle.
 */
require('./_ki_belegung').pruefeBelegung('testbestand');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {TESTKONTO_PASS,PRUEFKONTO_PASS}=require('./_testpasswoerter');
const {frage}=require('./_aufraeumen');
const C=require('../../gemeinsam/chatabgleich');
process.loadEnvFile(path.join(__dirname,'../.env.local'));
const URL=process.env.EXPO_PUBLIC_SUPABASE_URL,KEY=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const lauf=crypto.randomUUID(),chatIds=[],hoerer=[],konten=[],OUT=path.resolve(__dirname,'../../pruefbelege/paket-7');
let gut=0,schlecht=0,leseVorher,leseGesichert=false,kontaktVorher,kontaktFilter;
const warte=ms=>new Promise(r=>setTimeout(r,ms));
const check=(name,b,extra='')=>{b?gut++:schlecht++;console.log(new Date().toISOString(),b?'OK':'FEHL',name,extra);};
async function daten(q){const r=await q;if(r.error)throw Error(r.error.message);return r.data;}
async function bis(fn,ms=6000){const ab=Date.now();while(Date.now()-ab<ms){if(await fn())return Date.now()-ab;await warte(25);}throw Error('Erwartung nach '+ms+' ms nicht erfüllt');}
async function hoeren(client,thema,erlaubt=true){
 const h={n:0,verbunden:false,art:[]};
 h.aus=C.klingelHoeren(client,thema,()=>h.n++,v=>h.verbunden=v);hoerer.push(h);
 if(erlaubt){await bis(()=>h.verbunden,10000);await warte(C.KLINGEL_BUENDELN_MS+100);h.n=0;}else await warte(1800);
 return h;
}
async function mutation(name,h,fn){const n=h.n,ab=Date.now();await fn();await bis(()=>h.n>n);const ms=Date.now()-ab;check(name,ms<2000,ms+' ms ab Schreibbeginn');}
(async()=>{
 assert.ok(process.env.SUPABASE_TOKEN,'Managementtoken für geprüfte Bereinigung erforderlich');
 for(const [email,password] of [['test@all-media.app',TESTKONTO_PASS],['all.media.prueflauf@web.de',PRUEFKONTO_PASS]]){
  const client=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(15000)})}});
  const r=await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;konten.push({client,id:r.data.user.id});
 }
 const [a,b]=konten;
 assert.equal(a.id,'3baafacd-bbdb-40fb-8ef4-a4e365ae00c4');assert.equal(b.id,'62616c1d-82e2-4ee4-aab9-950e40e438a4');
 kontaktFilter=`((user_id='${a.id}' and contact_id='${b.id}') or (user_id='${b.id}' and contact_id='${a.id}'))`;
 kontaktVorher=await frage(`select id,user_id,contact_id,status from contacts where ${kontaktFilter}`);
 await frage(`begin;insert into contacts(user_id,contact_id,status) values('${a.id}','${b.id}','friend'),('${b.id}','${a.id}','friend') on conflict(user_id,contact_id) do update set status='friend';commit;select 1 ok`);
 leseVorher=await daten(b.client.from('user_settings').select('wert').eq('user_id',b.id).eq('schluessel','lesebestaetigung'));leseGesichert=true;
 await daten(b.client.from('user_settings').upsert({user_id:b.id,schluessel:'lesebestaetigung',wert:'an'},{onConflict:'user_id,schluessel'}));
 for(const gruppe of [false,true]){
  const id=crypto.randomUUID();chatIds.push(id);fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'live-fixtures.json'),JSON.stringify({lauf,chatIds}));
  await daten(a.client.from('chats').insert({id,name:'P7 '+lauf,is_group:gruppe,bereich:'community',created_by:a.id}));
  await daten(a.client.from('chat_members').insert([{chat_id:id,user_id:a.id},{chat_id:id,user_id:b.id}]));
  const zustand=await daten(b.client.from('chats').select('anfrage_zustand').eq('id',id).single());
  if(zustand.anfrage_zustand!=='angenommen')await daten(b.client.from('chats').update({anfrage_zustand:'angenommen'}).eq('id',id).select('id').single());
  const hb=await hoeren(b.client,'chat:'+id),ha=await hoeren(a.client,'chat:'+id),hl=await hoeren(b.client,'nutzer:'+b.id);
  check((gruppe?'Gruppe':'Zweierchat')+' beide privaten Kanäle verbunden',hb.verbunden&&ha.verbunden&&hl.verbunden);
  const mid=crypto.randomUUID(),ln=hl.n;
  await mutation('Neue Nachricht bei B',hb,()=>daten(a.client.from('messages').insert({id:mid,chat_id:id,sender_id:a.id,text:'Paket7 '+lauf})));
  await bis(()=>hl.n>ln);check('Liste des Empfängers klingelt',hl.n>ln);
  const z=await daten(b.client.from('messages').select('id,text').eq('id',mid).single());check('Empfänger liest genau gesendeten Text',z.text==='Paket7 '+lauf);
  await mutation('Lesebestätigung bei A',ha,async()=>{const n=await daten(b.client.rpc('chat_gelesen',{p_chat:id}));assert.equal(n,1);});
  check('Gelesen tatsächlich gespeichert',!!(await daten(a.client.from('messages').select('read_at').eq('id',mid).single())).read_at);
  await mutation('Reaktion hinzufügen',ha,()=>daten(b.client.from('message_reactions').insert({message_id:mid,user_id:b.id,emoji:'👍'})));
  await mutation('Reaktion ändern',ha,()=>daten(b.client.from('message_reactions').update({emoji:'❤️'}).eq('message_id',mid).eq('user_id',b.id).select('emoji').single()));
  await mutation('Reaktion entfernen',ha,()=>daten(b.client.from('message_reactions').delete().eq('message_id',mid).eq('user_id',b.id).select('message_id').single()));
  await mutation('Nachricht bearbeiten',hb,()=>daten(a.client.from('messages').update({text:'P7 geändert',edited_at:new Date().toISOString()}).eq('id',mid).select('id').single()));
  check('Bearbeitung tatsächlich lesbar',(await daten(b.client.from('messages').select('text').eq('id',mid).single())).text==='P7 geändert');
  await mutation('Nachricht zurücknehmen',hb,()=>daten(a.client.from('messages').update({deleted_at:new Date().toISOString()}).eq('id',mid).select('id').single()));
  await mutation('Nachricht löschen',hb,()=>daten(a.client.from('messages').delete().eq('id',mid).select('id').single()));
  check('Gelöschte Nachricht weg',(await daten(b.client.from('messages').select('id').eq('id',mid))).length===0);
  await mutation('Eigene Listeneinstellung',hl,()=>daten(b.client.from('chat_members').update({is_favorite:true}).eq('chat_id',id).eq('user_id',b.id).select('user_id').single()));
  // Wiederverbinden holt Änderungen nach: Kanal neu eröffnen, ohne Polling.
  hb.aus();await daten(a.client.from('messages').insert({chat_id:id,sender_id:a.id,text:'Funkloch '+lauf}));
  const wieder=await hoeren(b.client,'chat:'+id);const nach=await daten(b.client.from('messages').select('id,text,created_at').eq('chat_id',id).order('created_at'));
  check('Nach Wiederverbinden genau eine Nachricht nachladbar',wieder.verbunden&&nach.length===1&&new Set(nach.map(z=>z.id)).size===1&&nach[0].text==='Funkloch '+lauf);
  for(const h of [ha,hl,wieder])h.aus();
 }
 const fremd=await hoeren(b.client,'nutzer:'+a.id,false);check('Fremde Nutzerliste verweigert',!fremd.verbunden);
 const leer=await hoeren(b.client,'chat:'+crypto.randomUUID(),false);check('Unbekannter Chat verweigert',!leer.verbunden);
 const anon=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});konten.push({client:anon});const ohne=await hoeren(anon,'nutzer:'+a.id,false);check('Anonym privater Kanal verweigert',!ohne.verbunden);
 const denied=await b.client.rpc('chat_klingeln',{thema:'nutzer:'+a.id,art:'liste'});check('Nutzer darf Klingelfunktion nicht aufrufen',!!denied.error);
 const publik=await frage("select count(*) n from pg_publication_tables where pubname='supabase_realtime'");check('Realtime-Veröffentlichung weiterhin leer',Number(publik[0].n)===0);
})().catch(e=>{schlecht++;console.error('FEHLER',e.message);}).finally(async()=>{
 try{
  hoerer.forEach(h=>h.aus());
  for(const s of konten)await s.client.removeAllChannels();
  if(kontaktVorher){
   const ids=kontaktVorher.map(z=>"'"+z.id+"'").join(',');
   const restores=kontaktVorher.map(z=>`update contacts set status='${z.status}' where id='${z.id}';`).join('');
   await frage(`begin;delete from contacts where ${kontaktFilter}${ids?` and id not in (${ids})`:''};${restores}commit;select 1 ok`);
   const jetzt=await frage(`select id,user_id,contact_id,status from contacts where ${kontaktFilter} order by id`);
   check('Kontakt-Grundstand wiederhergestellt',JSON.stringify(jetzt)===JSON.stringify([...kontaktVorher].sort((a,b)=>a.id.localeCompare(b.id))));
  }
  if(leseGesichert){const b=konten[1];if(leseVorher.length)await daten(b.client.from('user_settings').upsert({user_id:b.id,schluessel:'lesebestaetigung',wert:leseVorher[0].wert},{onConflict:'user_id,schluessel'}));else await daten(b.client.from('user_settings').delete().eq('user_id',b.id).eq('schluessel','lesebestaetigung'));}
  if(chatIds.length){const ids=chatIds.map(id=>"'"+id+"'").join(',');const r=await frage(`begin;delete from messages where chat_id in (${ids});delete from chat_members where chat_id in (${ids});delete from chats where id in (${ids}) and name='P7 ${lauf}';commit;select (select count(*) from chats where id in (${ids}))+(select count(*) from messages where chat_id in (${ids}))+(select count(*) from chat_members where chat_id in (${ids})) rest`);check('Eigene Chatfixtures vollständig entfernt',Number(r[0].rest)===0);fs.writeFileSync(path.join(OUT,'live-fixtures.json'),JSON.stringify({lauf,chatIds,rest:r[0].rest}));}
 }catch(e){schlecht++;console.error('BEREINIGUNG FEHL',e.message);}
 for(const s of konten)s.client.auth.stopAutoRefresh();
 console.log(`${gut}/${gut+schlecht} bestanden`);process.exit(schlecht?1:0);
});
