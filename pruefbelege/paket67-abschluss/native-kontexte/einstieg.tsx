// Originale DatenProvider und ProfilProvider; nur Auth/Sitzungen/Fehlersteuerung sind Prüfrahmen.
import React,{useEffect,useState,useRef} from 'react';
import {View,Text,Pressable} from 'react-native';
import {registerRootComponent} from 'expo';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {createClient} from '@supabase/supabase-js';
import {DatenProvider,useDaten} from '../../../app/contexts/DatenContext';
import {ProfilProvider,useProfil} from '../../../app/contexts/ProfilContext';
import {ContactProfileScreen} from '../../../app/screens/messenger/ContactProfileScreen';
import {GroupSettingsScreen} from '../../../app/screens/messenger/GroupSettingsScreen';
import * as Krypto from '../../../app/lib/krypto';
import {Konto,AuthContext} from './kontexte';
import {bereich} from './sicher';
const base='http://127.0.0.1:3302';
async function api(art:string,d:any={}){const r=await fetch(base+'/'+art,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});if(!r.ok)throw Error(await r.text());return r.json();}
let fault=0,delay=0,readUntil=0;const trace:any[]=[];
async function transport(url:any,opts:any){if(Date.now()<readUntil&&String(url).includes('/rest/v1/chat_members')&&(!opts?.method||opts.method==='GET'))return new Response(JSON.stringify({message:'Absichtlicher Listenfehler',code:'P67READ'}),{status:503,headers:{'Content-Type':'application/json'}});
 const update=String(url).includes('/rest/v1/chat_members')&&opts?.method==='PATCH';if(update){trace.push({art:'start',body:opts.body,at:Date.now()});if(delay){const ms=delay;delay=0;await new Promise(r=>setTimeout(r,ms));}if(fault){fault--;trace.push({art:'fehler'});return new Response(JSON.stringify({message:'Absichtlicher Schreibfehler',code:'P67WRITE'}),{status:503,headers:{'Content-Type':'application/json'}});}}
 const r=await fetch(url,opts);if(update)trace.push({art:'ende',status:r.status,at:Date.now()});return r;}
function Innen({s,fixtures,gruppe,setGruppe,wechsel}:any){const daten=useDaten(),profil=useProfil(),aktuell=useRef<any>(null);const [info,melden]=useState('bereit');const alle=[...daten.chats,...daten.communityChats];const chats=fixtures.map((c:any)=>alle.find(x=>x.id===c.id));const geladen=daten.ichId===s.id&&chats.every(Boolean);const chat=chats[gruppe?1:0];aktuell.current={profil,daten,chat,s,chats,geladen};
 useEffect(()=>{if(geladen)api('bereit').catch(()=>{});},[geladen]);
 useEffect(()=>{let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{const c=await api('poll');if(!c)return;const a=aktuell.current;let result:any={};
  if(c.art==='lesen')result={konto:a.s.id,geladen:a.geladen,kontext:'Original DatenProvider + ProfilProvider',gelesenSeit:a.daten.chatsGelesenSeit,chats:a.chats.map((x:any)=>x?({id:x.id,server:x.muted,anzeige:a.profil.chatStummAnzeige(x.id,x.muted)}):null),trace};
  else if(c.art==='tipps'){if(!a.geladen)throw Error('Kontodaten laden');for(let i=0;i<c.n;i++)a.profil.chatStummUmschalten(a.chat.id,a.chat.muted);}
  else if(c.art==='konto')wechsel(c.index);
  else if(c.art==='gruppe')setGruppe(c.wert);
  else if(c.art==='transport'){fault=c.fehler||0;delay=c.delay||0;readUntil=Date.now()+(c.lesefehlerMs||0);}
  else if(c.art==='reload')result={ok:await a.daten.chatsNeuLaden()};
  else throw Error('Unbekannt '+c.art);
  await api('result',{nr:c.nr,...result});
 }catch(e:any){melden('Fehler '+e.message);}finally{busy=false;}},150);return()=>clearInterval(timer);},[]);
 const button=(t:string,f:()=>void)=><Pressable key={t} accessibilityRole="button" accessibilityLabel={t} onPress={f} style={{padding:8,borderWidth:1}}><Text>{t}</Text></Pressable>;
 return <View style={{flex:1,paddingTop:60,backgroundColor:'white'}}><Text>Original DatenProvider + ProfilProvider · {s.name} · {gruppe?'Gruppe':'Kontakt'}</Text><Text>{info}</Text><Text>Benachrichtigungen: {chat&&profil.chatStummAnzeige(chat.id,chat.muted)?'Aus':'An'}</Text><View style={{flexDirection:'row'}}>{button('Kontakt',()=>setGruppe(false))}{button('Gruppe',()=>setGruppe(true))}{button('Konto A',()=>wechsel(0))}{button('Konto B',()=>wechsel(1))}</View>
 {!geladen?<Text>Lade echte Kontodaten</Text>:gruppe?<GroupSettingsScreen chat={chat} onBack={()=>{}} onCall={()=>{}} onOpenMitglied={()=>{}} onVerlassen={()=>{}} onNotice={melden}/>:<ContactProfileScreen userId={s.andere} chat={chat} startVersatz={430} onBack={()=>{}} onMessage={()=>{}} onCall={()=>{}} onNotice={melden}/>}</View>;
}
function Start(){const [konten,setKonten]=useState<any[]>([]),[fixtures,setFixtures]=useState<any[]>([]),[index,setIndex]=useState(0),[gruppe,setGruppe]=useState(false),[info,setInfo]=useState('start');
 useEffect(()=>{(async()=>{const b=await api('start');bereich(b.lauf);const ks=[];for(let i=0;i<2;i++){const k=b.konten[i];k.andere=b.konten[1-i].id;k.client=createClient(b.url,b.anon,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});const r=await k.client.auth.setSession(k.sitzung);if(r.error)throw r.error;delete k.sitzung;const key=await Krypto.meinSchluessel(k.client,k.id);if(!key)throw Error('Native Schlüsselregistrierung fehlgeschlagen');await api('key',{id:key.id,konto:k.id});ks.push(k);}setFixtures(b.chats);setKonten(ks);})().catch(e=>setInfo(e.message));},[]);
 if(!konten.length)return <Text>{info}</Text>;const s=konten[index];return <Konto.Provider value={s}><AuthContext.Provider value={{user:{id:s.id,email:s.email}}}><DatenProvider><ProfilProvider><Innen s={s} fixtures={fixtures} gruppe={gruppe} setGruppe={setGruppe} wechsel={setIndex}/></ProfilProvider></DatenProvider></AuthContext.Provider></Konto.Provider>;
}
registerRootComponent(()=> <SafeAreaProvider><Start/></SafeAreaProvider>);
