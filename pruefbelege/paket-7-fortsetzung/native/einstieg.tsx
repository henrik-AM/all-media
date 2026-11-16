// Echte ProfilProvider- und Info-Komponenten; Testgerüst stellt nur Konto/Chatdaten bereit.
import React,{useEffect,useState,useRef,useCallback} from 'react';
import {View,Text,Pressable} from 'react-native';
import {registerRootComponent} from 'expo';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {createClient} from '@supabase/supabase-js';
import {ProfilProvider,useProfil} from '../../../app/contexts/ProfilContext';
import {ContactProfileScreen} from '../../../app/screens/messenger/ContactProfileScreen';
import {GroupSettingsScreen} from '../../../app/screens/messenger/GroupSettingsScreen';
import {Konto} from './kontexte';
const base='http://127.0.0.1:3302';
async function api(art:string,d:any={}){const r=await fetch(base+'/'+art,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});if(!r.ok)throw Error(await r.text());return r.json();}
let fault=0,delay=0,reads=0,readFault=0;const trace:any[]=[];
async function transport(url:any,opts:any){if(readFault&&String(url).includes('/rest/v1/chat_members')&&(!opts?.method||opts.method==='GET')){readFault--;return new Response(JSON.stringify({message:'Absichtlicher Listenfehler',code:'P7READ'}),{status:503,headers:{'Content-Type':'application/json'}});}const update=String(url).includes('/rest/v1/chat_members')&&opts?.method==='PATCH';
 if(update){trace.push({art:'start',body:opts.body,at:Date.now()});if(delay){const ms=delay;delay=0;await new Promise(r=>setTimeout(r,ms));}if(fault){fault--;trace.push({art:'fehler'});return new Response(JSON.stringify({message:'Absichtlicher Schreibfehler',code:'P7TEST'}),{status:503,headers:{'Content-Type':'application/json'}});}}
 const r=await fetch(url,opts);if(update)trace.push({art:'ende',status:r.status,at:Date.now()});return r;}
function Innen({s,gruppe,setGruppe,wechsel}:any){const profil=useProfil();const aktuell=useRef<any>();const [info,melden]=useState('bereit');const chat=s.daten.chats[gruppe?1:0];
 aktuell.current={profil,chat,s};
 useEffect(()=>{let busy=false,aus=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{const c=await api('poll');if(!c)return;const a=aktuell.current;let result:any={};
  if(c.art==='lesen')result={konto:a.s.id,chats:a.s.daten.chats.map((x:any)=>({id:x.id,server:x.muted,anzeige:a.profil.chatStummAnzeige(x.id,x.muted)})),trace,reads};
  else if(c.art==='tipps'){for(let i=0;i<c.n;i++)a.profil.chatStummUmschalten(a.chat.id,a.chat.muted);}
  else if(c.art==='konto')wechsel(c.index);
  else if(c.art==='gruppe')setGruppe(c.wert);
  else if(c.art==='transport'){fault=c.fehler||0;delay=c.delay||0;readFault=c.lesefehler||0;}
  else if(c.art==='reload')await a.s.daten.chatsNeuLaden();
  else throw Error('Unbekannt '+c.art);
  await api('result',{nr:c.nr,...result});
 }catch(e:any){melden('Fehler '+e.message);}finally{busy=false;}},150);return()=>{aus=true;clearInterval(timer);};},[]);
 const button=(t:string,f:()=>void)=><Pressable key={t} accessibilityRole="button" accessibilityLabel={t} onPress={f} style={{padding:8,borderWidth:1}}><Text>{t}</Text></Pressable>;
 return <View style={{flex:1,paddingTop:60,backgroundColor:'white'}}><Text>Original ProfilProvider · {s.name} · {gruppe?'Gruppe':'Kontakt'}</Text><Text>{info}</Text><Text>Stumm: {profil.chatStummAnzeige(chat.id,chat.muted)?'Aus':'An'}</Text><View style={{flexDirection:'row'}}>{button('Kontakt',()=>setGruppe(false))}{button('Gruppe',()=>setGruppe(true))}{button('Konto A',()=>wechsel(0))}{button('Konto B',()=>wechsel(1))}</View>
 {gruppe?<GroupSettingsScreen chat={chat} onBack={()=>{}} onCall={()=>{}} onOpenMitglied={()=>{}} onVerlassen={()=>{}} onNotice={melden}/>:<ContactProfileScreen userId={s.andere} chat={chat} startVersatz={430} onBack={()=>{}} onMessage={()=>{}} onCall={()=>{}} onNotice={melden}/>}</View>;
}
function Start(){const [konten,setKonten]=useState<any[]>([]),[index,setIndex]=useState(0),[gruppe,setGruppe]=useState(false),[info,setInfo]=useState('start');const [,render]=useState(0);const ref=useRef<any[]>([]);
 useEffect(()=>{let timer:any; (async()=>{const b=await api('start');const ks=[];
 for(let i=0;i<2;i++){const k=b.konten[i];k.andere=b.konten[1-i].id;k.client=createClient(b.url,b.anon,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});const r=await k.client.auth.setSession(k.sitzung);if(r.error)throw r.error;delete k.sitzung;
 const chats=b.chats.map((c:any)=>({...c,name:c.isGroup?'P7 Stumm Gruppe':'P7 Stumm Kontakt',userId:k.andere,muted:false,memberIds:[k.andere],initials:'P7',preview:'',time:'',requestState:'accepted'}));
 k.daten={ichId:k.id,chats,communityChats:[],contacts:[],users:{[k.andere]:{id:k.andere,name:'P7 Gegenüber',initials:'P7'},me:{id:k.id,name:k.name}},profile:{},kontaktBilder:{},communities:[],neuLaden:async()=>{},personenNachladen:async()=>[]};
 k.daten.chatsNeuLaden=async()=>{const r=await k.client.from('chat_members').select('chat_id,is_muted').eq('user_id',k.id).in('chat_id',chats.map((c:any)=>c.id));if(r.error)throw r.error;reads++;const neu=k.daten.chats.map((c:any)=>({...c,muted:!!r.data?.find((z:any)=>z.chat_id===c.id)?.is_muted}));if(neu.some((c:any,j:number)=>c.muted!==k.daten.chats[j].muted)){k.daten={...k.daten,chats:neu};render(n=>n+1);}};ks.push(k);}
 ref.current=ks;setKonten(ks);timer=setInterval(()=>{for(const k of ks)k.daten.chatsNeuLaden().catch((e:any)=>setInfo(e.message));},500);setInfo('bereit');await api('bereit');})().catch(e=>setInfo(e.message));return()=>clearInterval(timer);},[]);
 if(!konten.length)return <Text>{info}</Text>;const s=konten[index];return <Konto.Provider value={s}><ProfilProvider><Innen s={s} gruppe={gruppe} setGruppe={setGruppe} wechsel={setIndex}/></ProfilProvider></Konto.Provider>;
}
registerRootComponent(()=> <SafeAreaProvider><Start/></SafeAreaProvider>);
