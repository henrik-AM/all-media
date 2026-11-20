import React,{useEffect,useState} from 'react';
import {Modal,View,Text,Pressable,StyleSheet} from 'react-native';
import {uploadBeobachten,UploadStand} from '../lib/medien';
import * as MedienUpload from '../../gemeinsam/upload';

/*
 * Paket 9 (20.11.2026): iOS zeigt kein zweites Modal über einem schon
 * offenen (Formularblatt „Neues Reel“). Die Anzeige erschien deshalb beim
 * Veröffentlichen nie — kein Fortschritt, kein Abbrechen. Darum gibt es sie
 * zweimal: eingebettet in jedem SheetRahmen (als Schicht im selben Fenster)
 * und an der Wurzel nur, solange kein Blatt offen ist.
 */
let offeneBlaetter=0;
const blattHoerer=new Set<(n:number)=>void>();
export function blattOffen(an:boolean){offeneBlaetter=Math.max(0,offeneBlaetter+(an?1:-1));blattHoerer.forEach(f=>f(offeneBlaetter));}

function Karte({stand}:{stand:UploadStand}){
 return <View style={{backgroundColor:'#fff',borderRadius:16,padding:24,gap:16}}>
  <Text accessibilityRole="header" style={{color:'#111',fontSize:18}}>Aufnahme hochladen</Text>
  <Text accessibilityLiveRegion="polite" style={{color:'#111'}}>{MedienUpload.text(stand)}</Text>
  <View accessibilityRole="progressbar" accessibilityValue={stand.gesamt?{min:0,max:stand.gesamt,now:stand.geladen}:undefined} style={{height:6,backgroundColor:'#ddd'}}>
   <View style={{height:6,backgroundColor:'#1261d7',width:`${stand.gesamt?Math.min(100,100*stand.geladen/stand.gesamt):0}%`}}/>
  </View>
  <Pressable accessibilityRole="button" onPress={()=>stand.abbrechen()} style={{padding:12}}><Text style={{color:'#1261d7'}}>Hochladen abbrechen</Text></Pressable>
 </View>;
}

/** Sichtbar auch über Formularblättern; Abbruch meldet keinen Veröffentlichungserfolg. */
export function UploadAnzeige({eingebettet=false}:{eingebettet?:boolean}){
 const [stand,setStand]=useState<UploadStand|null>(null);
 const [blaetter,setBlaetter]=useState(offeneBlaetter);
 useEffect(()=>uploadBeobachten(setStand),[]);
 useEffect(()=>{if(eingebettet)return;blattHoerer.add(setBlaetter);return ()=>{blattHoerer.delete(setBlaetter);};},[eingebettet]);
 if(eingebettet){
  if(!stand)return null;
  return <View style={[StyleSheet.absoluteFill,{backgroundColor:'#0009',justifyContent:'center',padding:24,zIndex:50}]}><Karte stand={stand}/></View>;
 }
 return <Modal visible={!!stand&&blaetter===0} transparent animationType="fade" onRequestClose={()=>stand?.abbrechen()}>
  <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:24}}>{stand&&<Karte stand={stand}/>}</View>
 </Modal>;
}
