import React,{createContext,useContext} from 'react';
export const Konto=createContext<any>(null);
export const AuthContext=createContext<any>({user:null});
export const useSupabase=()=>({supabase:useContext(Konto).client,isConfigured:true});
export const useEinstellungen=()=>({an:()=>false,einstellungen:{},setzen:async()=>true});
