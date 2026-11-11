import * as Crypto from 'expo-crypto';
const K=require('../../../gemeinsam/krypto');
K.zufallsquelleSetzen((x:Uint8Array,n:number)=>x.set(Crypto.getRandomBytes(n)));
export const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const peer=K.schluesselpaarErzeugen();
export const chat:any={id:'offline-zwei',userId:B,name:'Offline B',isGroup:false,initials:'B',color:'#7e76a8',preview:'Offline',time:'19:00',requestState:'accepted',bereich:'messenger'};
export const db:any={chats:[{id:chat.id,is_group:false}],chat_members:[{chat_id:chat.id,user_id:A},{chat_id:chat.id,user_id:B}],
  krypto_schluessel:[{id:'offline-b',user_id:B,oeffentlich:peer.oeffentlich}],messages:[],message_keys:[],
  profiles:[{id:A,name:'Offline A'},{id:B,name:'Offline B'}],contacts:[{user_id:A,contact_id:B,status:'friend'}]};
export const modus={stoerung:false};
export const supabase:any={rpc:async()=>({data:true,error:null}),from(table:string){
 const filter:((z:any)=>boolean)[]=[];let art='lesen',wert:any,einzeln=false,range:number[]|null=null,lim=1000,sort='';
 const q:any={
  select:()=>q,eq:(s:string,v:any)=>{filter.push(z=>z[s]===v);return q;},
  neq:(s:string,v:any)=>{filter.push(z=>z[s]!==v);return q;},in:(s:string,v:any[])=>{filter.push(z=>v.includes(z[s]));return q;},
  gt:(s:string,v:any)=>{filter.push(z=>Number(z[s])>v);return q;},order:(s:string)=>{sort=s;return q;},
  range:(a:number,b:number)=>{range=[a,b];return q;},limit:(n:number)=>{lim=n;return q;},
  single:()=>{einzeln=true;return q;},maybeSingle:()=>{einzeln=true;return q;},
  insert:(w:any)=>{art='insert';wert=w;return q;},upsert:(w:any)=>{art='upsert';wert=w;return q;},
  update:(w:any)=>{art='update';wert=w;return q;},delete:()=>{art='delete';return q;},
  then:(res:any,rej:any)=>Promise.resolve().then(()=>{
   if(modus.stoerung&&table==='krypto_schluessel')return {data:null,error:{message:'Simulierter Schlüssel-/Netzfehler'},count:null};
   const t=db[table]||=[];
   if(art==='upsert'){
    let z=t.find((r:any)=>r.user_id===wert.user_id&&r.geraet===wert.geraet);
    if(z)Object.assign(z,wert);else{z={id:Crypto.randomUUID(),...wert};t.push(z);}
    return {data:z,error:null};
   }
   if(art==='insert'){
    const rows=(Array.isArray(wert)?wert:[wert]).map((z:any)=>({id:Crypto.randomUUID(),created_at:new Date().toISOString(),...z}));
    t.push(...rows);return {data:einzeln?rows[0]:rows,error:null};
   }
   let rows=t.filter((z:any)=>filter.every(f=>f(z)));
   if(art==='update')rows.forEach((z:any)=>Object.assign(z,wert));
   if(art==='delete')db[table]=t.filter((z:any)=>!rows.includes(z));
   const count=rows.length;if(sort)rows=rows.slice().sort((a:any,b:any)=>String(a[sort]).localeCompare(String(b[sort])));
   rows=range?rows.slice(range[0],range[1]+1):rows.slice(0,lim);
   return {data:einzeln?rows[0]||null:rows,error:null,count};
  }).then(res,rej),
 };return q;
}};
export const daten:any={users:{[A]:{id:A,name:'Offline A',initials:'A',handle:'offlinea',color:'#767'},[B]:{id:B,name:'Offline B',initials:'B',handle:'offlineb',color:'#767'}},
 profile:{[B]:{name:'Offline B',bio:'Simuliertes Konto',links:[]}},contacts:[{id:B,name:'Offline B',status:'friend'}],ichId:A,
 communities:[],chats:[chat],communityChats:[],kontaktBilder:{},neuLaden:async()=>{},chatsNeuLaden:async()=>{},personenNachladen:async()=> 'fertig'};
