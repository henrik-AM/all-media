// Echte Supabase-API und eigener Metro/Prüfsteuerung; keine Cloud-Medien.
import {zustand} from './bestand';
const original=globalThis.fetch;
globalThis.fetch=((url:any,init:any)=>{
 const u=String(typeof url==='string'?url:url?.url);
 if(zustand.stoerung&&/\/rest\/v1\/krypto_schluessel/.test(u))return Promise.reject(Error('Simulierter Schlüsselausfall im Live-Prüfstand'));
 if(!/^https?:\/\/(127\.0\.0\.1|localhost):330[12](\/|$)/.test(u)&&!/^https:\/\/ijztosbjfybdgotpdixw\.supabase\.co\/(auth|rest|realtime)\/v1\//.test(u))return Promise.reject(Error('Prüfstand sperrt externes Medium'));
 return original(url,init);
}) as typeof fetch;
