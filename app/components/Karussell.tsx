import React,{useRef,useState} from 'react';
import {View,Text,Image,FlatList,Pressable,Modal,useWindowDimensions} from 'react-native';
import * as K from '../../gemeinsam/karussell';
import {Videoflaeche} from './Videoflaeche';
function Streifen({medien,sichtbar,voll=false,start=0,onPosition}:{medien:K.Medium[];sichtbar:boolean;voll?:boolean;start?:number;onPosition?:(i:number)=>void}){
 const {width:fenster,height}=useWindowDimensions(),[breite,setBreite]=useState(fenster),[bei,setBei]=useState(start),[spielt,setSpielt]=useState(false);
 const liste=useRef<FlatList<K.Medium>>(null);
 const springen=(i:number)=>{const ziel=Math.max(0,Math.min(medien.length-1,i));setBei(ziel);onPosition?.(ziel);setSpielt(false);liste.current?.scrollToOffset({offset:ziel*breite,animated:true});};
 return <View onLayout={e=>setBreite(e.nativeEvent.layout.width)} style={{width:'100%',height:voll?height-150:undefined,aspectRatio:voll?undefined:1}}>
  <FlatList ref={liste} data={medien} horizontal pagingEnabled initialNumToRender={1} windowSize={3} maxToRenderPerBatch={2} showsHorizontalScrollIndicator={false}
   initialScrollIndex={start} getItemLayout={(_,i)=>({length:breite,offset:breite*i,index:i})} keyExtractor={(_,i)=>String(i)}
   onMomentumScrollEnd={e=>{const i=Math.round(e.nativeEvent.contentOffset.x/breite);setBei(i);onPosition?.(i);setSpielt(false);}}
   renderItem={({item,index})=><View style={{width:breite,height:'100%',backgroundColor:'#111'}}>
    {sichtbar&&Math.abs(index-bei)<=1&&(item.typ==='image'?<Image source={{uri:item.url}} resizeMode="contain" style={{width:'100%',height:'100%'}}/>:
     <Videoflaeche id={`karussell-${index}`} quelle={item.url} laden={sichtbar&&index===bei} laeuft={sichtbar&&index===bei&&spielt} stumm={false} fuellen="contain" style={{width:'100%',height:'100%'}}/>)}
    {item.typ==='video'&&index===bei&&<Pressable accessibilityRole="button" accessibilityLabel={spielt?'Video pausieren':'Video abspielen'} onPress={()=>setSpielt(v=>!v)} style={{position:'absolute',bottom:50,left:20,padding:10,backgroundColor:'#fff'}}><Text style={{color:'#111'}}>{spielt?'Pause':'Abspielen'}</Text></Pressable>}
   </View>}/>
  <View style={{position:'absolute',bottom:8,left:8,right:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
   <Pressable disabled={bei===0} accessibilityLabel="Vorheriges Medium" onPress={()=>springen(bei-1)}><Text style={{color:'white',padding:10}}>‹</Text></Pressable>
   <Text accessibilityLiveRegion="polite" style={{color:'white',backgroundColor:'#0008',padding:6}}>{bei+1}/{medien.length}</Text>
   <Pressable disabled={bei===medien.length-1} accessibilityLabel="Nächstes Medium" onPress={()=>springen(bei+1)}><Text style={{color:'white',padding:10}}>›</Text></Pressable>
  </View>
 </View>;
}
export function Karussell({beitrag,sichtbar}:{beitrag:Parameters<typeof K.liste>[0];sichtbar:boolean}){
 const medien=K.liste(beitrag),[voll,setVoll]=useState(false),[bei,setBei]=useState(0);
 return <View style={{width:'100%'}}>
  <Streifen medien={medien} sichtbar={sichtbar&&!voll} onPosition={setBei}/>
  <Pressable accessibilityRole="button" accessibilityLabel="Medien im Vollbild öffnen" onPress={()=>setVoll(true)} style={{position:'absolute',top:8,right:8,padding:10,backgroundColor:'#0009'}}><Text style={{color:'white'}}>Vollbild</Text></Pressable>
  <Modal visible={voll} animationType="fade" onRequestClose={()=>setVoll(false)}>
   <View style={{flex:1,backgroundColor:'#111',justifyContent:'center'}}>
    <Pressable accessibilityRole="button" onPress={()=>setVoll(false)} style={{padding:24,paddingTop:60}}><Text style={{color:'white'}}>Vollbild schließen</Text></Pressable>
    {voll&&<Streifen medien={medien} sichtbar voll start={bei}/>}
   </View>
  </Modal>
 </View>;
}
