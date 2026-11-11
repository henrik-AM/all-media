import '../../app/test/paket6-native/sperre';
import React,{useState,useEffect} from 'react';
import {registerRootComponent} from 'expo';
import {View,Text,Pressable} from 'react-native';
import {SafeAreaProvider,useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChatDetailScreen} from '../../app/screens/messenger/ChatDetailScreen';
import {ContactProfileScreen} from '../../app/screens/messenger/ContactProfileScreen';
import {B,chat} from '../../app/test/paket6-native/bestand';
import {netz} from '../../app/test/paket6-native/sperre';
function Stand(){
 const [seite,setSeite]=useState('chat'),[info,melden]=useState(''),[n,neu]=useState(0);const ins=useSafeAreaInsets();
 useEffect(()=>{const t=setInterval(()=>neu(x=>x+1),500);return()=>clearInterval(t);},[]);
 const falsch:any={id:'quer-falsch',chatId:chat.id,senderId:B,text:'Simulierter fremder Absenderschlüssel',time:'20:20',date:'Heute',nichtPruefbar:true};
 return <View style={{flex:1,backgroundColor:'white',paddingLeft:ins.left,paddingRight:ins.right}}>
  <View style={{height:28,flexDirection:'row',gap:14,alignItems:'center'}}>
   <Text>OFFLINE quer · extern {netz.verweigert}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Prüfstand Chat" onPress={()=>setSeite('chat')}><Text>Chat</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Prüfstand Kontakt" onPress={()=>setSeite('kontakt')}><Text>Kontakt</Text></Pressable>
   {!!info&&<Text>{info}</Text>}
  </View>
  <View style={{flex:1}}>{seite==='chat'?<ChatDetailScreen chat={chat} extraMessages={[falsch]} onBack={()=>setSeite('kontakt')} onCall={()=>{}} onCamera={()=>{}} onOpenProfile={()=>setSeite('kontakt')} onNotice={melden}/>
   :<ContactProfileScreen userId={B} chat={chat} onBack={()=>setSeite('chat')} onMessage={()=>setSeite('chat')} onCall={()=>{}} onNotice={melden} startVersatz={520}/>}</View>
 </View>;
}
registerRootComponent(()=> <SafeAreaProvider><Stand/></SafeAreaProvider>);
