import * as S from 'expo-secure-store';
export * from 'expo-secure-store';
let prefix='paket6-live-uninitialisiert.';
export const bereich=(lauf:string)=>{prefix='paket6-live.'+lauf+'.';};
export const getItemAsync=(k:string,o?:any)=>S.getItemAsync(prefix+k,o);
export const setItemAsync=(k:string,v:string,o?:any)=>S.setItemAsync(prefix+k,v,o);
export const deleteItemAsync=(k:string,o?:any)=>S.deleteItemAsync(prefix+k,o);
