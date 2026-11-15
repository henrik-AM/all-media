import React,{createContext,useContext} from 'react';
export const Konto=createContext<any>(null);
export const useDaten=()=>useContext(Konto).daten;
export const useSupabase=()=>({supabase:useContext(Konto).client});
const nichts=()=>{};
export const useProfil=()=>({markierte:[],favoriten:[],chatStumm:[],geleerteChats:[],istBlockiert:()=>false,markieren:nichts,favoritUmschalten:nichts,chatStummUmschalten:nichts,chatStummAnzeige:(_id:string,w:boolean)=>w,chatLeeren:nichts,blockieren:nichts});
export const useEinstellungen=()=>({an:(k:string)=>k==='entersenden',einstellungen:{},setzen:async()=>true});
