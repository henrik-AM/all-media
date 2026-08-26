import React, { createContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser } from '../types';
import { mockCurrentUser } from '../mocks';

/*
 * Mehrere Konten nebeneinander, wie man es von Instagram kennt.
 *
 * Henrik meinte mit "Profil wechseln" ausdruecklich nicht den Wechsel
 * zwischen Messenger-, Video- und Community-Profil desselben Kontos, sondern
 * ein zweites eigenstaendiges Konto, auf das man umschaltet.
 *
 * Angemeldete Konten bleiben angemeldet - der Wechsel geht ohne neue
 * Passworteingabe. Nur ein zusaetzliches Konto verlangt eine Anmeldung.
 *
 * Die Sitzung ueberlebt jetzt auch das Schliessen der App. Vorher lag sie nur
 * im Arbeitsspeicher: jeder Neustart landete wieder auf dem Anmeldebildschirm.
 * Das erwartet niemand von einer Messenger-App - und in Expo Go, wo die App
 * bei jeder Codeaenderung neu laedt, war es beim Bauen jedes Mal von vorn.
 *
 * Was gespeichert wird, sind nur die Konten und welches aktiv ist. Ein
 * Passwort wird nicht abgelegt - die Mock-Anmeldung kennt gar keines, und
 * sobald die echte Anmeldung ueber Supabase laeuft, gehoert dessen Token in
 * expo-secure-store und nicht hierher.
 */
const SPEICHER = 'all-media.sitzung.v1';

export const AuthContext = createContext<{
  user: AuthUser | null;
  isLoggedIn: boolean;
  /** Ist die gespeicherte Sitzung schon geholt? Vorher nichts anzeigen. */
  sitzungGeladen: boolean;
  /** Alle angemeldeten Konten. */
  konten: AuthUser[];
  login: (email: string, password: string) => void;
  logout: () => void;
  /** Auf ein bereits angemeldetes Konto umschalten. */
  wechsleZu: (kontoId: string) => void;
  /** Ein weiteres Konto anmelden und direkt dorthin wechseln. */
  kontoHinzufuegen: (email: string, password: string, name?: string) => void;
  /** Ein Konto abmelden. Beim letzten Konto endet die Sitzung ganz. */
  kontoAbmelden: (kontoId: string) => void;
}>({
  user: null,
  isLoggedIn: false,
  sitzungGeladen: false,
  konten: [],
  login: () => {},
  logout: () => {},
  wechsleZu: () => {},
  kontoHinzufuegen: () => {},
  kontoAbmelden: () => {},
});

/** Aus einer Mailadresse einen brauchbaren Anzeigenamen bauen. */
const nameAusMail = (email: string) => {
  const vorn = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return vorn ? vorn.charAt(0).toUpperCase() + vorn.slice(1) : 'Neues Konto';
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [konten, setKonten] = useState<AuthUser[]>([]);
  const [aktivId, setAktivId] = useState<string | null>(null);
  /*
   * Solange die gespeicherte Sitzung noch geholt wird, darf nichts gezeigt
   * werden. Ohne diesen Zustand blitzt der Anmeldebildschirm fuer einen
   * Bildaufbau auf, bevor die Sitzung ankommt - das sieht aus wie ein Fehler.
   */
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const roh = await AsyncStorage.getItem(SPEICHER);
        if (!abgebrochen && roh) {
          const daten = JSON.parse(roh) as { konten?: AuthUser[]; aktivId?: string | null };
          if (Array.isArray(daten.konten) && daten.konten.length > 0) {
            setKonten(daten.konten);
            // Nur uebernehmen, wenn das Konto auch wirklich noch dabei ist.
            const gueltig = daten.konten.some((k) => k.id === daten.aktivId);
            setAktivId(gueltig ? daten.aktivId! : daten.konten[0].id);
          }
        }
      } catch {
        // Kaputter oder alter Eintrag: dann eben anmelden. Ein Fehler beim
        // Lesen darf die App nicht am Starten hindern.
      } finally {
        if (!abgebrochen) setGeladen(true);
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, []);

  // Jede Aenderung sofort sichern. Erst nach dem Laden, sonst wuerde der leere
  // Anfangszustand die gespeicherte Sitzung ueberschreiben.
  useEffect(() => {
    if (!geladen) return;
    AsyncStorage.setItem(SPEICHER, JSON.stringify({ konten, aktivId })).catch(() => {
      // Nicht sichern zu koennen ist aergerlich, aber kein Grund abzubrechen.
    });
  }, [konten, aktivId, geladen]);

  const user = konten.find((k) => k.id === aktivId) ?? null;

  const login = (_email: string, _password: string) => {
    // Mock-Anmeldung — spaeter echte Supabase-Auth
    setKonten([mockCurrentUser]);
    setAktivId(mockCurrentUser.id);
  };

  const logout = () => {
    setKonten([]);
    setAktivId(null);
  };

  const wechsleZu = (kontoId: string) => {
    if (konten.some((k) => k.id === kontoId)) setAktivId(kontoId);
  };

  const kontoHinzufuegen = (email: string, _password: string, name?: string) => {
    const vorhanden = konten.find((k) => k.email.toLowerCase() === email.toLowerCase());
    if (vorhanden) return setAktivId(vorhanden.id);

    const id = `acc${Date.now()}`;
    const anzeige = name?.trim() || nameAusMail(email);
    const konto: AuthUser = {
      id,
      email,
      profile: {
        id,
        name: anzeige,
        handle: '@' + anzeige.toLowerCase().replace(/\s+/g, ''),
        status: 'online',
        about: 'Hey, ich nutze All Media!',
      },
    };
    setKonten((prev) => [...prev, konto]);
    setAktivId(id);
  };

  const kontoAbmelden = (kontoId: string) => {
    const rest = konten.filter((k) => k.id !== kontoId);
    setKonten(rest);
    // War es das aktive Konto, ruecken wir auf das erste verbleibende.
    if (aktivId === kontoId) setAktivId(rest[0]?.id ?? null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        // Solange die gespeicherte Sitzung noch geholt wird, gilt niemand als
        // angemeldet UND niemand als abgemeldet - siehe sitzungGeladen.
        isLoggedIn: !!user,
        sitzungGeladen: geladen,
        konten,
        login,
        logout,
        wechsleZu,
        kontoHinzufuegen,
        kontoAbmelden,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
