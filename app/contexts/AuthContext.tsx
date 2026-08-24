import React, { createContext, useState } from 'react';
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
 */

export const AuthContext = createContext<{
  user: AuthUser | null;
  isLoggedIn: boolean;
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
        isLoggedIn: !!user,
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
