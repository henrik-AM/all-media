import React,{useState} from 'react';
import {Modal,View,Text,Pressable,FlatList,Image} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as K from '../../gemeinsam/karussell';
import * as Reel from '../../gemeinsam/reel';
import * as Story from '../../gemeinsam/story';
export function KarussellEditor({start,onFertig,onClose}:{start:K.Medium[];onFertig:(m:K.Medium[])=>void;onClose:()=>void}){
 const [medien,setMedien]=useState(start),[fehler,setFehler]=useState(''),[busy,setBusy]=useState(false);
 const hinzufuegen=async()=>{setBusy(true);setFehler('');try{
  const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],allowsMultipleSelection:true,selectionLimit:0,orderedSelection:true,quality:.8});
  if(r.canceled)return;
  const neu:K.Medium[]=[];
  for(const a of r.assets){const video=a.type==='video';const sekunden=(a.duration||0)/1000;
   const grund=video?(Reel.pruefen(sekunden)||Story.videoPruefen({bytes:a.fileSize??0})):null;
   if(grund)throw new Error(grund);
   neu.push({url:a.uri,typ:video?'video':'image',mime:a.mimeType,sekunden:video?sekunden:undefined});}
  setMedien(m=>[...m,...neu]);
 }catch(e:any){setFehler(e.message||'Die Auswahl ließ sich nicht öffnen.');}finally{setBusy(false);}};
 return <Modal visible animationType="slide" onRequestClose={onClose}>
  <View style={{flex:1,padding:24,paddingTop:60,backgroundColor:'#fff',gap:16}}>
   <Text accessibilityRole="header" style={{fontSize:24,color:'#111'}}>Medien auswählen</Text>
   <Text style={{color:'#111'}}>{medien.length} Aufnahmen · Reihenfolge von oben nach unten</Text>
   <FlatList data={medien} keyExtractor={(_,i)=>String(i)} renderItem={({item,index})=><View style={{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:10}}>
    {item.typ==='image'?<Image source={{uri:item.url}} style={{width:54,height:54}}/>:<Text style={{color:'#111'}}>Video</Text>}
    <Text style={{flex:1,color:'#111'}}>{index+1}. {item.typ==='video'?'Video':'Bild'}</Text>
    <Pressable disabled={index===0||busy} accessibilityLabel={`Medium ${index+1} nach vorn`} onPress={()=>setMedien(m=>K.verschieben(m,index,index-1))}><Text style={{color:'#1261d7',padding:8}}>↑</Text></Pressable>
    <Pressable disabled={index===medien.length-1||busy} accessibilityLabel={`Medium ${index+1} nach hinten`} onPress={()=>setMedien(m=>K.verschieben(m,index,index+1))}><Text style={{color:'#1261d7',padding:8}}>↓</Text></Pressable>
    <Pressable disabled={busy} accessibilityLabel={`Medium ${index+1} entfernen`} onPress={()=>setMedien(m=>K.entfernen(m,index))}><Text style={{color:'#1261d7',padding:8}}>×</Text></Pressable>
   </View>}/>
   {!!fehler&&<Text accessibilityRole="alert" style={{color:'#a11'}}>{fehler}</Text>}
   <Pressable accessibilityRole="button" disabled={busy} onPress={hinzufuegen}><Text style={{color:'#1261d7',padding:12}}>Bilder und Videos hinzufügen</Text></Pressable>
   <Pressable accessibilityRole="button" disabled={busy||!medien.length} onPress={()=>onFertig(medien)}><Text style={{color:'#1261d7',padding:12}}>Weiter zur Beschreibung</Text></Pressable>
   <Pressable accessibilityRole="button" disabled={busy} onPress={onClose}><Text style={{color:'#1261d7',padding:12}}>Abbrechen</Text></Pressable>
  </View>
 </Modal>;
}
