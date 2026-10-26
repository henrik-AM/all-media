/** Lokale Supabase-/Storage-Gegenstellen für den E2E-Nachweis. Kein Produkt-Testschalter. */
const {nachbauStarten}=require('./_bunny_einheit');
const A='ab260026-0000-4000-8000-000000000001',B='ab260026-0000-4000-8000-000000000002';
async function starten(){
 const nachbau=await nachbauStarten();Object.assign(process.env,nachbau.umgebung,{MEDIEN_ANBIETER:'bunny'});
 const originalFetch=global.fetch;global.fetch=(url,opts)=>{
  const u=new URL(url);if(!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Externer Abruf im Offline-Test gesperrt');return originalFetch(url,opts);
 };
 const register=new Map(),alt=new Map(),belege=[];
 const lage={freigegeben:true,schreibfehler:false,rechtefehler:false,oeffentlich:new Set(),anfragen:0,posts:[]};
 function dienstTabelle(t){
  if(t==='video_upload_belege')return {insert:async b=>{belege.push(b);return {error:null};}};
  if(t!=='medien_objekte')throw Error('Unerwartete Diensttabelle '+t);
  const builder={filter:{},aktion:'lesen',eq(k,v){this.filter[k]=v;return this;},select(){return this;},maybeSingle:async function(){return {data:[...register.values()].find(z=>Object.entries(this.filter).every(([k,v])=>z[k]===v))||null};},
   delete(){this.aktion='loeschen';return this;},then(ok,nein){return (async()=>{for(const [p,z] of register)if(Object.entries(this.filter).every(([k,v])=>z[k]===v))register.delete(p);return {error:null};})().then(ok,nein);},
   insert:async b=>{if(lage.schreibfehler)return {error:Error('Probe')};register.set(b.pfad,b);return {error:null};}};
  return builder;
 }
 function client(wer){return {nutzerId:wer,auth:{getUser:async()=>({data:{user:{id:wer}}})},
  rpc:async(name,args)=>{lage.anfragen++;if(lage.rechtefehler)return {error:Error('Probe')};
   const owner=p=>register.get(p)?.owner_id===wer||alt.get(p)?.owner===wer;
   const provider=p=>register.has(p)?'bunny':'supabase';
   if(name==='medium_upload_erlaubt')return {data:lage.freigegeben};
   if(name==='medien_leseliste')return {data:lage.freigegeben?args.p_pfade.filter(p=>!p.startsWith('instants/')&&(owner(p)||lage.oeffentlich.has(p))).map(p=>({pfad:p,anbieter:provider(p)})):[]};
   if(name==='medium_loeschrecht')return {data:lage.freigegeben&&owner(args.p_pfad)?provider(args.p_pfad):null};
   if(name==='medium_anbieter')return {data:provider(args.p_pfad)};
   throw Error('Unerwartetes RPC '+name);
  },from:t=>{if(t==='posts')return {insert:b=>({select:()=>({single:async()=>{const z={...b,id:'lokaler-post-'+(lage.posts.length+1)};lage.posts.push(z);for(const m of b.medien||[])lage.oeffentlich.add(m.url.split('/storage/v1/object/public/media/')[1]);return {data:z};}})})};if(t==='instants')return {select:()=>({eq:(_k,p)=>({single:async()=>({data:register.get(p)?.owner_id===wer?{bild_pfad:p}:null})})})};return dienstTabelle(t);},
  storage:{from:()=>({
   upload:async(p,b)=>{alt.set(p,{inhalt:b,owner:wer});return {data:{id:'altes-objekt'}};},
   remove:async pfade=>{for(const p of pfade)if(alt.get(p)?.owner===wer)alt.delete(p);return {error:null};},
   getPublicUrl:p=>({data:{publicUrl:`https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/${p}`}}),
   createSignedUrl:async p=>({data:{signedUrl:`http://localhost:3300/alt/${p}`}}),
   createSignedUrls:async pfade=>({data:pfade.filter(p=>alt.get(p)?.owner===wer||lage.oeffentlich.has(p)).map(path=>({path,signedUrl:`http://localhost:3300/alt/${path}`}))}),
  })}};}
 const S=require('../../web/server/supabase');const altFuer=S.clientFuer;S.clientFuer=t=>t==='lokal-a'?client(A):t==='lokal-b'?client(B):null;
 const V=require('../../web/server/videopruefung'),altDienst=V.dienstclient;V.dienstclient=()=>({from:dienstTabelle});
 const api=require('../../web/server/supabase-api');
 api.ladeBeitraege=async(_c,_u,optionen={})=>lage.posts.filter(p=>!optionen.nurIds||optionen.nurIds.includes(p.id)).map(p=>({...p,userId:'me',mediaUrl:p.media_url,description:p.description,medien:p.medien||[],kind:p.kind}));
 const app=require('../../web/server/app');
 app.get('/alt/:ordner/:datei',(req,res)=>{const e=alt.get(`${req.params.ordner}/${req.params.datei}`);e?res.type('image/jpeg').send(e.inhalt):res.sendStatus(404);});
 const server=await new Promise((resolve,reject)=>{const s=app.listen(3300,'127.0.0.1',()=>resolve(s));s.on('error',reject);});
 return {A,B,nachbau,register,alt,belege,lage,client,
  stop:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await nachbau.stop();global.fetch=originalFetch;S.clientFuer=altFuer;V.dienstclient=altDienst;}};
}
module.exports={starten,A,B};
