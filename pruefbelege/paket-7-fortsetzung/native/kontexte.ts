import React,{createContext,useContext} from 'react';
export const Konto=createContext<any>(null);
export const useDaten=()=>useContext(Konto).daten;
export const useSupabase=()=>({supabase:useContext(Konto).client});
export const useEinstellungen=()=>({an:()=>false,einstellungen:{},setzen:async()=>true});
