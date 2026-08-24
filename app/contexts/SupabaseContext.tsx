import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants/supabase';

interface SupabaseContextType {
  supabase: ReturnType<typeof createClient> | null;
  isReady: boolean;
  error: string | null;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      setSupabase(client);
      setIsReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize Supabase');
      console.warn('⚠️ Supabase not available (expected in local dev without config)');
      setIsReady(true); // Still continue with mock data fallback
    }
  }, []);

  return (
    <SupabaseContext.Provider value={{ supabase, isReady, error }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider');
  }
  return context;
}
