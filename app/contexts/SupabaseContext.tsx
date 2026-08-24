import React, { createContext, useContext, useMemo } from 'react';
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
      supabase: createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey),
      isConfigured: true,
    };
  }, []);

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  return useContext(SupabaseContext);
}
