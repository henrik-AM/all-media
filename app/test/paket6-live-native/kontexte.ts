import {zustand} from './bestand';
export const useDaten=()=>zustand.daten;
export const useSupabase=()=>({supabase:zustand.client});
const nichts=()=>{};
const profil:any={markierte:[],favoriten:[],chatStumm:[],geleerteChats:[],istBlockiert:()=>false,markieren:nichts,
 favoritUmschalten:nichts,chatStummUmschalten:nichts,chatLeeren:nichts,blockieren:nichts};
export const useProfil=()=>profil;
const einstellungen={an:(k:string)=>k==='entersenden',einstellungen:{},setzen:async()=>true};
export const useEinstellungen=()=>einstellungen;
