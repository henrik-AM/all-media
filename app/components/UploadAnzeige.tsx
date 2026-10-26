import React,{useEffect,useState} from 'react';
import {Modal,View,Text,Pressable} from 'react-native';
import {uploadBeobachten,UploadStand} from '../lib/medien';
import * as MedienUpload from '../../gemeinsam/upload';
/** Sichtbar auch über Formularblättern; Abbruch meldet keinen Veröffentlichungserfolg. */
export function UploadAnzeige(){
 const [stand,setStand]=useState<UploadStand|null>(null);
 useEffect(()=>uploadBeobachten(setStand),[]);
 return <Modal visible={!!stand} transparent animationType="fade" onRequestClose={()=>stand?.abbrechen()}>
  <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:24}}>
   <View style={{backgroundColor:'#fff',borderRadius:16,padding:24,gap:16}}>
    <Text accessibilityRole="header" style={{color:'#111',fontSize:18}}>Aufnahme hochladen</Text>
    <Text accessibilityLiveRegion="polite" style={{color:'#111'}}>{stand?MedienUpload.text(stand):''}</Text>
    <View accessibilityRole="progressbar" accessibilityValue={stand?.gesamt?{min:0,max:stand.gesamt,now:stand.geladen}:undefined} style={{height:6,backgroundColor:'#ddd'}}>
     <View style={{height:6,backgroundColor:'#1261d7',width:`${stand?.gesamt?Math.min(100,100*stand.geladen/stand.gesamt):0}%`}}/>
    </View>
    <Pressable accessibilityRole="button" onPress={()=>stand?.abbrechen()} style={{padding:12}}><Text style={{color:'#1261d7'}}>Hochladen abbrechen</Text></Pressable>
   </View>
  </View>
 </Modal>;
}
