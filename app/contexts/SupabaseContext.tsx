import React, { createContext, useContext, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured } from '../constants/supabase';

interface SupabaseContextValue {
  supabase: SupabaseClient | null;
  isConfigured: boolean;
}

const SupabaseContext = createContext<SupabaseContextValue>({ supabase: null, isConfigured: false });

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<SupabaseContextValue>(() => {
    if (!isSupabaseConfigured()) {
      return { supabase: null, isConfigured: false };
    }
    return {
      /*
       * Die Anmeldung muss den App-Start ueberleben.
       *
       * Ohne diese Einstellungen legt supabase-js seine Sitzung dorthin, wo
       * ein Browser sie erwartet — localStorage. Das gibt es auf dem Handy
       * nicht, also lag sie nur im Arbeitsspeicher und war bei jedem Start
       * weg.
       *
       * Sichtbar wurde das als leere App: AuthContext merkt sich das Konto
       * selbst in AsyncStorage und meldete also "angemeldet", waehrend
       * supabase-js keine Sitzung mehr hatte. Jede Abfrage lief damit als
       * anonymer Zugriff — und den lassen die Regeln der Datenbank nicht zu.
       * Kein Fehler, keine Meldung, nur nichts.
       *
       * detectSessionInUrl gehoert zum Anmelden ueber eine Weiterleitung im
       * Browser; in einer App gibt es keine solche Adresse.
       */
      supabase: createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      }),
      isConfigured: true,
    };
  }, []);

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  return useContext(SupabaseContext);
}
