import React, { createContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser } from '../types';
import { signUpWithEmail, signInWithEmail, signOut, resetPasswordForEmail } from '../lib/supabaseAuth';
import { useSupabase } from './SupabaseContext';

const SPEICHER = 'all-media.sitzung.v2';

export const AuthContext = createContext<{
  user: AuthUser | null;
  isLoggedIn: boolean;
  sitzungGeladen: boolean;
  konten: AuthUser[];
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  wechsleZu: (kontoId: string) => void;
  kontoHinzufuegen: (email: string, password: string, name?: string) => Promise<void>;
  kontoAbmelden: (kontoId: string) => Promise<void>;
  sendPasswordResetCode: (email: string) => Promise<boolean>;
}>({
  user: null,
  isLoggedIn: false,
  sitzungGeladen: false,
  konten: [],
  error: null,
  login: async () => {},
  logout: async () => {},
  wechsleZu: () => {},
  kontoHinzufuegen: async () => {},
  kontoAbmelden: async () => {},
  sendPasswordResetCode: async () => false,
});

const handleAusMail = (email: string) => {
  const teil = email.split('@')[0].replace(/[._-]+/g, '');
  return '@' + teil.toLowerCase();
};

const nameAusMail = (email: string) => {
  const vorn = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return vorn ? vorn.charAt(0).toUpperCase() + vorn.slice(1) : 'Konto';
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { supabase, isConfigured } = useSupabase();
  const [konten, setKonten] = useState<AuthUser[]>([]);
  const [aktivId, setAktivId] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const roh = await AsyncStorage.getItem(SPEICHER);
        if (!abgebrochen && roh) {
          const daten = JSON.parse(roh) as { konten?: AuthUser[]; aktivId?: string | null };
          if (Array.isArray(daten.konten) && daten.konten.length > 0) {
            /*
             * Das gemerkte Konto zaehlt nur, wenn Supabase auch eine Sitzung
             * dazu hat.
             *
             * Beides wird getrennt gespeichert: die Kontenliste hier, das
             * Zugangstoken bei supabase-js. Laeuft das Token ab oder wurde die
             * Sitzung anderswo beendet, sagte diese Liste weiterhin
             * "angemeldet" — und die App zeigte eine leere Oberflaeche, weil
             * jede Abfrage als anonymer Zugriff lief und die Regeln der
             * Datenbank den nicht zulassen. Eine leere App ohne jede Meldung
             * ist die schlechteste aller Antworten; besser ehrlich zurueck zur
             * Anmeldung.
             */
            let sitzung = null;
            if (supabase) {
              const { data } = await supabase.auth.getSession();
              sitzung = data.session;
            }

            if (!supabase || sitzung) {
              setKonten(daten.konten);
              const gueltig = daten.konten.some((k) => k.id === daten.aktivId);
              setAktivId(gueltig ? daten.aktivId! : daten.konten[0].id);
            } else {
              await AsyncStorage.removeItem(SPEICHER);
            }
          }
        }
      } catch (e) {
        console.warn('Fehler beim Laden der Sitzung:', e);
      } finally {
        if (!abgebrochen) setGeladen(true);
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!geladen) return;
    AsyncStorage.setItem(SPEICHER, JSON.stringify({ konten, aktivId })).catch(() => {
      // Ignoriert
    });
  }, [konten, aktivId, geladen]);

  const user = konten.find((k) => k.id === aktivId) ?? null;

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);

      if (!isConfigured || !supabase) {
        // Mock-Login für Testmodus
        if (!email || !password || password.length < 6) {
          setError('Bitte gebe E-Mail und ein Passwort (mindestens 6 Zeichen) ein');
          return;
        }

        const userId = `user-${Date.now()}`;
        const konto: AuthUser = {
          id: userId,
          email,
          profile: {
            id: userId,
            name: email.split('@')[0],
            handle: handleAusMail(email),
            status: 'online',
            about: '',
          },
        };

        setKonten((prev) => {
          const existiert = prev.find((k) => k.email.toLowerCase() === email.toLowerCase());
          return existiert ? prev : [...prev, konto];
        });
        setAktivId(userId);
        return;
      }

      const result = await signInWithEmail(email, password);
      if (!result.success || !result.user) {
        setError(result.error || 'Anmeldung fehlgeschlagen');
        return;
      }

      const konto: AuthUser = {
        id: result.user.id,
        email: result.user.email || email,
        profile: {
          id: result.user.id,
          name: email.split('@')[0],
          handle: handleAusMail(email),
          status: 'online',
          about: '',
        },
      };

      setKonten((prev) => {
        const existiert = prev.find((k) => k.id === result.user.id);
        return existiert ? prev : [...prev, konto];
      });
      setAktivId(result.user.id);
    },
    [supabase, isConfigured]
  );

  const logout = useCallback(async () => {
    setError(null);
    if (supabase) {
      await signOut(supabase);
    }
    setKonten([]);
    setAktivId(null);
  }, [supabase]);

  const wechsleZu = useCallback((kontoId: string) => {
    if (konten.some((k) => k.id === kontoId)) {
      setAktivId(kontoId);
    }
  }, [konten]);

  const kontoHinzufuegen = useCallback(
    async (email: string, password: string, name?: string) => {
      setError(null);

      const existiert = konten.find((k) => k.email.toLowerCase() === email.toLowerCase());
      if (existiert) {
        setAktivId(existiert.id);
        return;
      }

      if (!isConfigured || !supabase) {
        // Mock-Registrierung für Testmodus
        if (!email || !password || password.length < 6) {
          setError('Bitte gebe E-Mail und ein Passwort (mindestens 6 Zeichen) ein');
          return;
        }

        const userId = `user-${Date.now()}`;
        const anzeige = name?.trim() || nameAusMail(email);
        const handle = '@' + anzeige.toLowerCase().replace(/\s+/g, '');

        const konto: AuthUser = {
          id: userId,
          email,
          profile: {
            id: userId,
            name: anzeige,
            handle,
            status: 'online',
            about: 'Hey, ich nutze All Media!',
          },
        };

        setKonten((prev) => [...prev, konto]);
        setAktivId(userId);
        return;
      }

      const result = await signUpWithEmail(email, password);
      if (!result.success || !result.user) {
        setError(result.error || 'Registrierung fehlgeschlagen');
        return;
      }

      const anzeige = name?.trim() || nameAusMail(email);
      const handle = '@' + anzeige.toLowerCase().replace(/\s+/g, '');

      // Profil mit Metadaten aktualisieren, damit es Trigger automatisch anlegt
      try {
        await supabase.auth.updateUser({
          data: { name: anzeige, handle },
        });
      } catch (e) {
        console.warn('Fehler beim Aktualisieren des Profils:', e);
      }

      const konto: AuthUser = {
        id: result.user.id,
        email: result.user.email || email,
        profile: {
          id: result.user.id,
          name: anzeige,
          handle,
          status: 'online',
          about: 'Hey, ich nutze All Media!',
        },
      };

      setKonten((prev) => [...prev, konto]);
      setAktivId(result.user.id);
    },
    [supabase, isConfigured, konten]
  );

  const kontoAbmelden = useCallback(
    async (kontoId: string) => {
      if (supabase && aktivId === kontoId) {
        await signOut(supabase);
      }
      const rest = konten.filter((k) => k.id !== kontoId);
      setKonten(rest);
      if (aktivId === kontoId) {
        setAktivId(rest[0]?.id ?? null);
      }
    },
    [supabase, aktivId, konten]
  );

  const sendPasswordResetCode = useCallback(
    async (email: string) => {
      setError(null);
      const result = await resetPasswordForEmail(email);
      if (!result.success) {
        setError(result.error ?? 'Fehler beim Versenden des Codes');
        return false;
      }
      return true;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        sitzungGeladen: geladen,
        konten,
        error,
        login,
        logout,
        wechsleZu,
        kontoHinzufuegen,
        kontoAbmelden,
        sendPasswordResetCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
