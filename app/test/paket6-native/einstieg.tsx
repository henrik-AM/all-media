import './sperre';
import React,{useEffect,useState} from 'react';
import {registerRootComponent} from 'expo';
import {View,Text,Pressable,StyleSheet,Keyboard,LogBox} from 'react-native';
import {SafeAreaProvider,useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChatDetailScreen} from '../../screens/messenger/ChatDetailScreen';
import {ContactProfileScreen} from '../../screens/messenger/ContactProfileScreen';
import {A,B,chat,db,modus} from './bestand';
import {netz} from './sperre';
const K=require('../../../gemeinsam/krypto');
// Nur die erwartete, abgefangene Fehlersimulation darf keinen Dev-LogBox-
// Hinweis über die Produktmeldung legen. Unerwartete Fehler bleiben sichtbar.
LogBox.ignoreLogs(['Nachricht senden fehlgeschlagen:']);
function Pruefstand(){
 const [seite,setSeite]=useState('chat'),[stand,neu]=useState(0),[notice,melden]=useState(''),[zahlen,setZahlen]=useState('');
 const insets=useSafeAreaInsets();
 useEffect(()=>{const u=setInterval(()=>setZahlen(`Zeilen ${db.messages.length}; Chiffren ${db.messages.filter((m:any)=>m.krypto>0).length}; extern gesperrt ${netz.verweigert}`),500);return()=>clearInterval(u);},[]);
 const knopf=(text:string,tun:()=>void)=><Pressable key={text} accessibilityRole="button" accessibilityLabel={text} onPress={tun} style={s.knopf}><Text>{text}</Text></Pressable>;
 const falsch:any={id:'offline-falsch',chatId:chat.id,senderId:B,text:'Simulierter fremder Absenderschlüssel',time:'19:00',date:'Heute',nichtPruefbar:true};
 return <View style={[s.root,{paddingTop:insets.top}]}>
  <Text style={s.kopf}>OFFLINE · Paket 6 · echte App-Bildschirme</Text>
  <View style={s.leiste}>
   {knopf('Prüfstand Chat',()=>{setSeite('chat');neu(stand+1);})}
   {knopf('Prüfstand Kontakt',()=>{setSeite('kontakt');neu(stand+1);})}
   {knopf('Netzfehler umschalten',()=>{modus.stoerung=!modus.stoerung;melden(modus.stoerung?'Simulierter Schlüssel-/Netzfehler aktiv':'Simulation wieder erreichbar');})}
   {knopf('Tastatur schließen',()=>Keyboard.dismiss())}
  </View>
  <Text style={s.status} accessibilityLabel={zahlen}>{zahlen}</Text>
  {!!notice&&<Text accessibilityLabel={notice} style={s.hinweis}>{notice}</Text>}
  <View style={s.inhalt}>
   {seite==='chat'?<ChatDetailScreen key={'chat'+stand} chat={chat} extraMessages={[falsch]} onBack={()=>setSeite('kontakt')} onCall={()=>{}} onCamera={()=>{}} onOpenProfile={()=>setSeite('kontakt')} onNotice={melden}/>
    :<ContactProfileScreen key={'kontakt'+stand} userId={B} chat={chat} onBack={()=>setSeite('chat')} onMessage={()=>setSeite('chat')} onCall={()=>{}} onNotice={melden} startVersatz={520}/>}
  </View>
  {/* Außerhalb der echten ScrollView: deren iOS-AX-Gruppen melden sonst
      transparente Bereiche als darüberliegend. Nur der Prüfstandsregler. */}
  <Pressable accessibilityRole="button" accessibilityLabel="Zweites Gerät"
    style={[s.knopf,{position:'absolute',top:insets.top+80,left:8,zIndex:10000,backgroundColor:'#fff'}]}
    onPress={()=>{db.krypto_schluessel.push({id:'offline-zweit-'+stand,user_id:B,oeffentlich:K.schluesselpaarErzeugen().oeffentlich});neu(stand+1);}}>
    <Text>Zweites Gerät</Text>
  </Pressable>
 </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#fff'},kopf:{marginTop:116,fontSize:12,fontWeight:'700',padding:6},leiste:{flexDirection:'row',flexWrap:'wrap',padding:4,gap:5},knopf:{padding:6,borderWidth:1,borderColor:'#aaa',borderRadius:6},status:{fontSize:11,padding:4},hinweis:{fontSize:13,color:'#b00020',padding:6},inhalt:{flex:1}});
registerRootComponent(()=> <SafeAreaProvider><Pruefstand/></SafeAreaProvider>);
