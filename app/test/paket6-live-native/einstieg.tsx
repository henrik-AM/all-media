import './netz';
import React,{useEffect,useState} from 'react';
import {registerRootComponent} from 'expo';
import {View,Text,Pressable,Keyboard,LogBox} from 'react-native';
import {SafeAreaProvider,useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChatDetailScreen} from '../../screens/messenger/ChatDetailScreen';
import {ContactProfileScreen} from '../../screens/messenger/ContactProfileScreen';
import {zustand,starten,wechseln,steuerung,nummer} from './bestand';
LogBox.ignoreLogs(['Nachricht senden fehlgeschlagen:']);
function Stand(){
 const [bereit,setBereit]=useState(false),[info,setInfo]=useState('Starte echten Prüfbestand'),[seite,setSeite]=useState('chat'),[stand,neu]=useState(0);const ins=useSafeAreaInsets();
 useEffect(()=>{starten().then(()=>{setBereit(true);setInfo('Native Schlüssel im echten SecureStore');}).catch(e=>setInfo('FEHLER '+e.message));},[]);
 const tun=(f:()=>any)=>Promise.resolve().then(f).catch(e=>setInfo('FEHLER '+e.message));
 const btn=(t:string,f:()=>any)=><Pressable key={t} accessibilityRole="button" accessibilityLabel={t} onPress={()=>tun(f)} style={{padding:5,borderWidth:1,borderColor:'#888',borderRadius:5}}><Text>{t}</Text></Pressable>;
 if(!bereit)return <Text style={{marginTop:150}}>{info}</Text>;
 return <View style={{flex:1,paddingTop:ins.top,backgroundColor:'white'}}>
  <Text style={{marginTop:95,fontSize:12}}>LIVE · Paket 6 · native Komponenten · Konto {zustand.index?'B':'A'}</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:4,padding:4}}>
   {btn('Konto A',()=>{wechseln(0);setSeite('chat');neu(stand+1);})}{btn('Konto B',()=>{wechseln(1);setSeite('chat');neu(stand+1);})}
   {btn('Prüfstand Chat',()=>{setSeite('chat');neu(stand+1);})}{btn('Prüfstand Kontakt',async()=>{await nummer();setSeite('kontakt');neu(stand+1);})}
   {btn('Tastatur schließen',()=>Keyboard.dismiss())}{btn('Störung',()=>{zustand.stoerung=!zustand.stoerung;setInfo(zustand.stoerung?'Schlüsselausfall aktiv':'Live erreichbar');})}
   {btn('Zweites Gerät',async()=>{await steuerung('extra',{index:zustand.index});await nummer();neu(stand+1);})}
   {btn('Absenderfälschung',async()=>{await steuerung('falsch',{index:zustand.index});setSeite('chat');neu(stand+1);})}
   {btn('Live prüfen',async()=>{const r=await steuerung('pruefen');setInfo(r.text);})}
   {btn('Fertig',async()=>{const r=await steuerung('fertig');setInfo(r.text);})}
  </View>
  <Text accessibilityLabel={info} style={{fontSize:12,padding:3}}>{info}</Text>
  <View style={{flex:1}}>{seite==='chat'?<ChatDetailScreen key={stand} chat={zustand.chat} onBack={()=>setSeite('kontakt')} onCall={()=>{}} onCamera={()=>{}} onOpenProfile={()=>setSeite('kontakt')} onNotice={setInfo}/>
   :<ContactProfileScreen key={stand} userId={zustand.konten[1-zustand.index].id} chat={zustand.chat} onBack={()=>setSeite('chat')} onMessage={()=>setSeite('chat')} onCall={()=>{}} onNotice={setInfo} startVersatz={520}/>}</View>
 </View>;
}
registerRootComponent(()=> <SafeAreaProvider><Stand/></SafeAreaProvider>);
