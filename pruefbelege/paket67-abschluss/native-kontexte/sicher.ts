import * as S from 'expo-secure-store';
export * from 'expo-secure-store';
let prefix='paket67-kontexte-uninitialisiert.';
export const bereich=(lauf:string)=>{prefix='paket67-kontexte.'+lauf+'.';};
export const getItemAsync=(k:string,o?:any)=>S.getItemAsync(prefix+k,o);
export const setItemAsync=(k:string,v:string,o?:any)=>S.setItemAsync(prefix+k,v,o);
export const deleteItemAsync=(k:string,o?:any)=>S.deleteItemAsync(prefix+k,o);
