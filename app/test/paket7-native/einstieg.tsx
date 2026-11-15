// Echte Original-Chatkomponenten und SecureStore, isolierte Testkonten-Rahmen.
import React,{useEffect,useState} from 'react';
import {registerRootComponent} from 'expo';
import {View,Text,Pressable,Keyboard} from 'react-native';
import {SafeAreaProvider,useSafeAreaInsets} from 'react-native-safe-area-context';
import {createClient} from '@supabase/supabase-js';
import {ChatDetailScreen} from '../../screens/messenger/ChatDetailScreen';
import * as K from '../../lib/krypto';
import {bereich} from './sicher';
import {Konto} from './kontexte';
const basis='http://127.0.0.1:3302';
async function api(art:string,body:any={}){const r=await fetch(basis+'/'+art,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Steuerung '+r.status);return r.json();}
function Stand(){
 const [konten,setzen]=useState<any[]>([]),[sichtbar,zeigen]=useState(0),[gruppe,wahl]=useState(false),[info,melden]=useState('Start');const ins=useSafeAreaInsets();
 useEffect(()=>{(async()=>{const b=await api('start');bereich(b.lauf);const ks=[];
  for(let i=0;i<2;i++){const s=b.konten[i],andere=b.konten[1-i];s.client=createClient(b.url,b.anon,{auth:{persistSession:false,autoRefreshToken:false}});const r=await s.client.auth.setSession(s.sitzung);delete s.sitzung;if(r.error)throw r.error;
   const key=await K.meinSchluessel(s.client,s.id);if(!key)throw Error('SecureStore-Gerät fehlt');await api('key',{konto:s.id,id:key.id});
   s.chats=b.chats.map((c:any)=>({...c,userId:andere.id,name:c.isGroup?'P7 Gruppe':'P7 Gegenüber',requestState:'accepted',initials:'P7',preview:'',time:''}));
   s.daten={ichId:s.id,users:Object.fromEntries(b.konten.map((k:any)=>[k.id,{id:k.id,name:k.name,handle:k.name,initials:k.name}]).concat([['me',{id:'me',name:s.name,handle:s.name,initials:s.name}]])),profile:{},contacts:[],communities:[],chats:[],communityChats:[],kontaktBilder:{},neuLaden:async()=>{},chatsNeuLaden:async()=>{},personenNachladen:async()=>'fertig'};ks.push(s);
  }setzen(ks);await api('bereit');melden('Paket 7 bereit');})().catch(e=>melden('FEHLER '+e.message));},[]);
 const knopf=(t:string,f:()=>any)=><Pressable key={t} accessibilityRole="button" accessibilityLabel={t} onPress={f} style={{padding:8,borderWidth:1}}><Text>{t}</Text></Pressable>;
 return <View style={{flex:1,paddingTop:ins.top,backgroundColor:'white'}}><Text style={{marginTop:90}}>LIVE Paket 7 · Konto {sichtbar?'B':'A'} · {gruppe?'Gruppe':'verschlüsselt'}</Text>
 <View style={{flexDirection:'row',flexWrap:'wrap'}}>{knopf('Konto A',()=>zeigen(0))}{knopf('Konto B',()=>zeigen(1))}{knopf('Zweierchat',()=>wahl(false))}{knopf('Gruppe',()=>wahl(true))}{knopf('Tastatur schließen',()=>Keyboard.dismiss())}</View><Text>{info}</Text>
 {konten.map((s,i)=><Konto.Provider key={s.id} value={s}><View style={{flex:1,display:i===sichtbar?'flex':'none'}}><ChatDetailScreen key={String(gruppe)} chat={s.chats[gruppe?1:0]} onBack={()=>{}} onCall={()=>{}} onCamera={()=>{}} onOpenProfile={()=>{}} onNotice={melden}/></View></Konto.Provider>)}
 </View>;
}
registerRootComponent(()=> <SafeAreaProvider><Stand/></SafeAreaProvider>);
