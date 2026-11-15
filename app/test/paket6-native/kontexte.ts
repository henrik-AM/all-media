import {daten,supabase} from './bestand';
export const useDaten=()=>daten;
export const useSupabase=()=>({supabase});
const nichts=()=>{};
const profil:any={markierte:[],favoriten:[],chatStumm:[],geleerteChats:[],istBlockiert:()=>false,markieren:nichts,
 favoritUmschalten:nichts,chatStummUmschalten:nichts,chatStummAnzeige:(_id:string,w:boolean)=>w,chatLeeren:nichts,blockieren:nichts};
export const useProfil=()=>profil;
const einstellungen={an:(k:string)=>k==='entersenden',einstellungen:{},setzen:async()=>true};
export const useEinstellungen=()=>einstellungen;
