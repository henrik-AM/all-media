import {createClient} from '@supabase/supabase-js';
import * as K from '../../lib/krypto';
import {bereich} from './sicher';
export const basis='http://127.0.0.1:3302';
export const zustand:any={client:null,daten:null,konten:[],index:0,chat:null,stoerung:false};
export async function steuerung(art:string,daten:any={}){
 const r=await fetch(basis+'/'+art,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(daten)});
 if(!r.ok)throw Error('Prüfsteuerung '+r.status);return r.json();
}
export async function starten(){
 const r=await fetch(basis+'/start');if(!r.ok)throw Error('Kein exklusiver Prüfstand');const b=await r.json();
 bereich(b.lauf);zustand.konten=b.konten;zustand.chat=b.chat;
 for(const s of zustand.konten){
  s.client=createClient(b.url,b.anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await s.client.auth.setSession(s.sitzung);delete s.sitzung;if(error)throw error;
  s.key=await K.meinSchluessel(s.client,s.id);if(!s.key)throw Error('Nativer Schlüsselbund fehlt');
  await steuerung('key',{konto:s.id,id:s.key.id,oeffentlich:s.key.oeffentlich});
 }
 wechseln(0);await steuerung('bereit');
}
export function wechseln(index:number){
 zustand.index=index;const a=zustand.konten[index],b=zustand.konten[1-index];zustand.client=a.client;
 zustand.chat={...zustand.chat,userId:b.id,name:'Paket 6 Live '+(index?'A':'B')};
 zustand.daten={users:Object.fromEntries(zustand.konten.map((s:any)=>[s.id,{id:s.id,name:s.name,initials:s.name,handle:s.name,color:'#767'}]).concat([['me',{id:'me',name:a.name,initials:a.name,handle:a.name,color:'#767'}]])),
  profile:{[b.id]:{name:b.name,bio:'Erlaubtes Testkonto',links:[]}},contacts:[{id:b.id,name:b.name,status:'friend'}],ichId:a.id,
  communities:[],chats:[zustand.chat],communityChats:[],kontaktBilder:{},neuLaden:async()=>{},chatsNeuLaden:async()=>{},personenNachladen:async()=> 'fertig'};
}
export async function nummer(){
 const a=zustand.konten[zustand.index],b=zustand.konten[1-zustand.index];
 const keys=await K.kontoSchluessel(a.client,b.id);const n=K.sicherheitsnummer(keys.map((x:any)=>x.oeffentlich));
 await steuerung('nummer',{konto:b.id,...n});return n;
}
