/**
 * Wer angemeldet ist — und unter welchem Konto die Datenbank arbeitet.
 *
 * WAS AM 07.09.2026 GEÄNDERT WURDE
 *
 * Drei Dinge, die alle dasselbe Muster hatten: die Anzeige sagte etwas, das
 * in der Datenbank nicht galt.
 *
 * 1. Die Anmeldung ging über einen eigenen Supabase-Client (siehe
 *    lib/supabaseAuth.ts). Die Sitzung landete dort und nie in dem Client,
 *    mit dem die App liest und schreibt.
 * 2. Ein fehlgeschlagenes Anmelden setzte nur `error` und kehrte zurück. Der
 *    Aufrufer wartete auf eine Ausnahme, bekam keine — und meldete
 *    „Konto erstellt", während unten der englische Fehler von Supabase
 *    stand. Jetzt wird geworfen.
 * 3. `wechsleZu` setzte eine andere Kennung als aktiv und sonst nichts. Die
 *    Sitzung blieb die alte. Wie das jetzt geht, steht in
 *    lib/kontenspeicher.ts.
 */

import React, { createContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../types';
import {
  signUpWithEmail,
  signInWithEmail,
  signOut,
  resetPasswordForEmail,
  passwortPruefen,
} from '../lib/supabaseAuth';
import {
  alleVergessen,
  sitzungSichern,
  sitzungVergessen,
  sitzungWechseln,
  werIstAngemeldet,
} from '../lib/kontenspeicher';
import { useSupabase } from './SupabaseContext';

// Dieselben Regeln wie auf der Website — siehe gemeinsam/ und lib/registrierung.ts.
import { Benutzername, NeuesKonto, metadatenFuer } from '../lib/registrierung';

const SPEICHER = 'all-media.sitzung.v2';

/*
 * FRUEHERE KONTEN (Stand 09.09.2026)
 *
 * Henrik am 07.09.2026: „Fruehere Accounts sollen beim Kontowechsel als
 * Ein-Klick-Option erscheinen (wie Instagram)."
 *
 * Was vorher passierte: `konten` sind nur die Konten mit gueltiger Sitzung im
 * Schluesselbund. Meldete man eines ab — oder lief seine Sitzung aus —,
 * verschwand es restlos. Beim naechsten Mal musste man E-Mail *und* Passwort
 * neu tippen, obwohl man dieses Konto auf diesem Geraet schon benutzt hatte.
 *
 * Instagram merkt sich stattdessen, wer hier schon einmal angemeldet war,
 * zeigt Bild und Namen und fragt beim Antippen nur noch das Passwort. Genau
 * das steht jetzt hier. Gespeichert wird bewusst *kein* Passwort und kein
 * Token — nur Kennung, Name und E-Mail, damit die Zeile etwas anzuzeigen hat
 * und die E-Mail vorbelegt werden kann.
 */
const FRUEHER = 'all-media.fruehereKonten.v1';

export interface FruehesKonto {
  id: string;
  email: string;
  name: string;
}

export const AuthContext = createContext<{
  user: AuthUser | null;
  isLoggedIn: boolean;
  sitzungGeladen: boolean;
  konten: AuthUser[];
  /** Wer auf diesem Geraet schon einmal angemeldet war — ohne Sitzung. */
  frueher: FruehesKonto[];
  /** Ein frueheres Konto aus der Liste nehmen. */
  frueheresVergessen: (kontoId: string) => void;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Gibt zurueck, ob der Wechsel geklappt hat. Bei false ist neu anzumelden. */
  wechsleZu: (kontoId: string) => Promise<boolean>;
  /**
   * Ohne `neu`: ein bestehendes Konto anmelden und dazunehmen.
   * Mit `neu`: ein Konto anlegen — Benutzername, Telefon und Geburtsdatum
   * sind dann Pflicht (Henrik 07.09. und 22.09.2026), siehe lib/registrierung.ts.
   */
  kontoHinzufuegen: (email: string, password: string, neu?: NeuesKonto) => Promise<void>;
  kontoAbmelden: (kontoId: string) => Promise<void>;
  sendPasswordResetCode: (email: string) => Promise<boolean>;
}>({
  user: null,
  isLoggedIn: false,
  sitzungGeladen: false,
  konten: [],
  frueher: [],
  frueheresVergessen: () => {},
  error: null,
  login: async () => {},
  logout: async () => {},
  wechsleZu: async () => false,
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

/*
 * Das eigene, echte Profil nachladen.
 *
 * BUG, GEFUNDEN AM 20.09.2026
 *
 * `login()` und `kontoHinzufuegen()` haben den angezeigten Namen bisher nie
 * aus `public.profiles` gelesen, sondern aus der eingegebenen E-Mail-Adresse
 * geraten (`nameAusMail`/`handleAusMail`). Für ein bestehendes Konto ist das
 * fast nie der wirkliche Name — Henriks Testkonto etwa heisst in der
 * Datenbank "Tanti", angemeldet über die normale Maske (kein Namensfeld dort)
 * wäre daraus "Tanti" durch Zufall richtig, "all.media.prueflauf@web.de"
 * würde aber als Name "All.media.prueflauf" zeigen.
 *
 * Der Kontenspeicher (`all-media.sitzung.v2`) merkt sich diesen geratenen
 * Namen dauerhaft pro Kennung und liest ihn bei jedem App-Start ungeprueft
 * wieder ein — ein einmal falscher Name blieb also stehen, auch nachdem sich
 * das echte Profil längst geändert hatte. Jedes Konto bekommt jetzt seinen
 * echten, individuellen Namen direkt aus der Datenbank.
 */
async function profilLaden(
  client: SupabaseClient,
  id: string,
  fallbackName: string,
  fallbackHandle: string
) {
  try {
    const { data } = await client
      .from('profiles')
      .select('name, handle')
      .eq('id', id)
      .maybeSingle();
    if (data?.name && data?.handle) {
      return { name: data.name as string, handle: data.handle as string };
    }
  } catch (e) {
    console.warn('Profil liess sich nicht laden:', e);
  }
  // Trigger noch nicht durchgelaufen (frisch registriert) oder Netzfehler.
  return { name: fallbackName, handle: fallbackHandle };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { supabase, isConfigured } = useSupabase();
  const [konten, setKonten] = useState<AuthUser[]>([]);
  const [frueher, setFrueher] = useState<FruehesKonto[]>([]);
  const [aktivId, setAktivId] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Die Merkliste steht in einem eigenen Schluessel: sie soll das Abmelden
  // ueberleben, `all-media.sitzung.v2` wird dabei geloescht.
  useEffect(() => {
    AsyncStorage.getItem(FRUEHER)
      .then((roh) => {
        if (!roh) return;
        const liste = JSON.parse(roh);
        if (Array.isArray(liste)) setFrueher(liste);
      })
      .catch(() => undefined);
  }, []);

  /** Ein Konto in die Merkliste aufnehmen — jung zuerst, ohne Doppelte. */
  const merken = useCallback((konto: AuthUser) => {
    setFrueher((prev) => {
      const eintrag: FruehesKonto = { id: konto.id, email: konto.email, name: konto.profile.name };
      const neu = [eintrag, ...prev.filter((k) => k.id !== konto.id)].slice(0, 8);
      AsyncStorage.setItem(FRUEHER, JSON.stringify(neu)).catch(() => undefined);
      return neu;
    });
  }, []);

  const frueheresVergessen = useCallback((kontoId: string) => {
    setFrueher((prev) => {
      const neu = prev.filter((k) => k.id !== kontoId);
      AsyncStorage.setItem(FRUEHER, JSON.stringify(neu)).catch(() => undefined);
      return neu;
    });
  }, []);

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
            let angemeldetId: string | null = null;
            if (supabase) angemeldetId = await werIstAngemeldet(supabase);

            if (!supabase || angemeldetId) {
              setKonten(daten.konten);

              /*
               * Aktiv ist, wer wirklich in der Sitzung steckt.
               *
               * Vorher wurde die gemerkte Kennung genommen, ohne nachzusehen.
               * Stand dort ein anderes Konto als in der Sitzung, zeigte die
               * App dessen Namen und schrieb unter dem anderen — der stille
               * Fall, den niemand bemerkt, weil beides plausibel aussieht.
               */
              const gemerkt = daten.konten.some((k) => k.id === daten.aktivId)
                ? daten.aktivId!
                : daten.konten[0].id;

              if (!angemeldetId || angemeldetId === gemerkt) {
                setAktivId(gemerkt);
              } else if (daten.konten.some((k) => k.id === angemeldetId)) {
                setAktivId(angemeldetId);
              } else {
                // Die Sitzung gehoert zu einem Konto, das die Liste nicht
                // kennt. Dann gilt die Sitzung, nicht die Liste.
                setKonten([]);
                setAktivId(null);
                await AsyncStorage.removeItem(SPEICHER);
              }

              // Die laufende Sitzung gehoert in den Kontenspeicher, sonst ist
              // der Rueckweg nach dem ersten Wechsel zu.
              if (supabase) await sitzungSichern(supabase).catch(() => null);
            } else {
              await AsyncStorage.removeItem(SPEICHER);
              await alleVergessen().catch(() => undefined);
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

  /*
   * Jede neue Sitzung sofort in den Kontenspeicher.
   *
   * supabase-js tauscht das Erneuerungstoken im Betrieb aus — etwa stuendlich
   * beim Auffrischen und nach jeder Passwortaenderung. Das alte ist danach
   * verbraucht; Supabase gibt jedes nur einmal her. Ohne diesen Zuhoerer
   * stuende im Kontenspeicher irgendwann ein Token, mit dem sich nicht mehr
   * zurueckwechseln laesst — und der Wechsel scheiterte scheinbar grundlos.
   *
   * Deshalb an einer Stelle statt nach jedem einzelnen Aufruf: die
   * Auffrischung passiert von selbst, ohne dass hier jemand etwas aufruft.
   */
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((ereignis) => {
      if (ereignis === 'SIGNED_IN' || ereignis === 'TOKEN_REFRESHED' || ereignis === 'USER_UPDATED') {
        void sitzungSichern(supabase).catch(() => null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!geladen) return;
    AsyncStorage.setItem(SPEICHER, JSON.stringify({ konten, aktivId })).catch(() => {
      // Ignoriert
    });
  }, [konten, aktivId, geladen]);

  const user = konten.find((k) => k.id === aktivId) ?? null;

  /**
   * Meldet den Fehler an beiden Wegen: als `error` fuer Bildschirme, die ihn
   * aus dem Context lesen, und als Ausnahme fuer die, die `await` benutzen.
   *
   * Nur `error` zu setzen war die Ursache fuer „Konto erstellt" ueber einem
   * fehlgeschlagenen Anlegen — KontoWechsel wartete auf eine Ausnahme, die nie
   * kam.
   */
  const scheitern = (grund: string): never => {
    setError(grund);
    throw new Error(grund);
  };

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);

      if (!isConfigured || !supabase) {
        // Mock-Login für Testmodus
        if (!email) scheitern('Bitte gebe eine E-Mail-Adresse ein');
        const schwach = passwortPruefen(password);
        if (schwach) scheitern(schwach);

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

      const result = await signInWithEmail(supabase, email, password);
      if (!result.success || !result.user) {
        scheitern(result.error || 'Anmeldung fehlgeschlagen');
      }

      const angemeldet = result.user!;
      const echt = await profilLaden(
        supabase,
        angemeldet.id,
        email.split('@')[0],
        handleAusMail(email)
      );
      const konto: AuthUser = {
        id: angemeldet.id,
        email: angemeldet.email || email,
        profile: {
          id: angemeldet.id,
          name: echt.name,
          handle: echt.handle,
          status: 'online',
          about: '',
        },
      };

      await sitzungSichern(supabase).catch(() => null);

      setKonten((prev) => {
        const existiert = prev.find((k) => k.id === angemeldet.id);
        return existiert ? prev.map((k) => (k.id === angemeldet.id ? konto : k)) : [...prev, konto];
      });
      merken(konto);
      setAktivId(angemeldet.id);
    },
    [supabase, isConfigured, merken]
  );

  const logout = useCallback(async () => {
    setError(null);
    if (supabase) {
      await signOut(supabase);
    }
    await alleVergessen().catch(() => undefined);
    setKonten([]);
    setAktivId(null);
  }, [supabase]);

  /**
   * Auf ein anderes eigenes Konto umschalten — samt Sitzung.
   *
   * Klappt der Wechsel der Sitzung nicht (abgelaufen, anderswo beendet),
   * bleibt die Anzeige, wo sie war, und das Konto fliegt aus der Liste. Ein
   * Konto, unter dem sich nichts lesen laesst, in der Liste stehen zu lassen,
   * hiesse es beim naechsten Antippen wieder zu versuchen.
   */
  const wechsleZu = useCallback(
    async (kontoId: string) => {
      if (!konten.some((k) => k.id === kontoId)) return false;
      if (kontoId === aktivId) return true;

      if (!supabase) {
        setAktivId(kontoId);
        return true;
      }

      const geklappt = await sitzungWechseln(supabase, kontoId);
      if (!geklappt) {
        setKonten((prev) => prev.filter((k) => k.id !== kontoId));
        setError('Die Anmeldung dieses Kontos ist abgelaufen. Bitte melde es neu an.');
        return false;
      }

      setAktivId(kontoId);

      /*
       * Heilt nebenbei einen veralteten Eintrag: stand hier durch den
       * frueheren Rateweg (siehe profilLaden) einmal ein falscher Name, zieht
       * spaetestens der naechste Wechsel auf dieses Konto den echten nach.
       */
      const bisher = konten.find((k) => k.id === kontoId);
      if (bisher) {
        const echt = await profilLaden(supabase, kontoId, bisher.profile.name, bisher.profile.handle);
        if (echt.name !== bisher.profile.name || echt.handle !== bisher.profile.handle) {
          setKonten((prev) =>
            prev.map((k) =>
              k.id === kontoId ? { ...k, profile: { ...k.profile, name: echt.name, handle: echt.handle } } : k
            )
          );
        }
      }

      return true;
    },
    [supabase, konten, aktivId]
  );

  const kontoHinzufuegen = useCallback(
    async (email: string, password: string, neu?: NeuesKonto) => {
      setError(null);

      const existiert = konten.find((k) => k.email.toLowerCase() === email.toLowerCase());
      if (existiert) {
        // Schon in der Liste — dann ist das ein Wechsel, keine Anmeldung.
        if (supabase && !(await sitzungWechseln(supabase, existiert.id))) {
          scheitern('Die Anmeldung dieses Kontos ist abgelaufen. Bitte melde es neu an.');
        }
        setAktivId(existiert.id);
        return;
      }

      const schwach = passwortPruefen(password);
      if (schwach) scheitern(schwach);

      if (!isConfigured || !supabase) {
        // Mock-Registrierung für Testmodus
        if (!email) scheitern('Bitte gebe eine E-Mail-Adresse ein');

        const userId = `user-${Date.now()}`;
        const anzeige = neu?.name?.trim() || neu?.handle || nameAusMail(email);
        const handle = neu ? '@' + Benutzername.normal(neu.handle) : handleAusMail(email);

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

      /*
       * Das laufende Konto sichern, bevor die Anmeldung seine Sitzung
       * ueberschreibt. Ohne diesen Schritt war das erste Konto in dem
       * Augenblick verloren, in dem ein zweites dazukam — und der Wechsel
       * zurueck fuehrte in eine leere App.
       */
      await sitzungSichern(supabase).catch(() => null);

      /*
       * Anlegen nur, wenn wirklich ein neues Konto gewollt ist.
       *
       * Bis zum 22.09.2026 hiess ein fehlgeschlagenes Anmelden hier immer
       * „dann eben registrieren" — mit einem Benutzernamen, der aus der
       * E-Mail geraten war. Ein Tippfehler in der Adresse beim Dazunehmen
       * eines bestehenden Kontos legte so still ein fremdes neues an, ohne
       * Telefonnummer und Geburtsdatum. Jetzt legt nur an, wer die Felder
       * dafuer ausgefuellt hat; alles dahinter prueft die Datenbank selbst
       * (Schema 34 und 52).
       */
      let result = await signInWithEmail(supabase, email, password);
      if (!result.success && neu) {
        const angelegt = await signUpWithEmail(supabase, email, password, metadatenFuer(neu));
        if (!angelegt.success || !angelegt.user) {
          // Zurueck auf das Konto, das vorher lief — sonst steht die App nach
          // einem Tippfehler ohne Sitzung da.
          if (aktivId) await sitzungWechseln(supabase, aktivId).catch(() => false);
          scheitern(angelegt.error || result.error || 'Registrierung fehlgeschlagen');
        }
        result = angelegt;
      } else if (!result.success) {
        if (aktivId) await sitzungWechseln(supabase, aktivId).catch(() => false);
        scheitern(result.error || 'Anmeldung fehlgeschlagen');
      }

      const angemeldet = result.user!;
      const anzeige = neu?.name?.trim() || (neu ? Benutzername.normal(neu.handle) : nameAusMail(email));
      const handle = neu ? '@' + Benutzername.normal(neu.handle) : handleAusMail(email);

      await sitzungSichern(supabase).catch(() => null);

      /*
       * Beim Anmelden eines BESTEHENDEN Kontos (Zweig oben, "Bestehendes
       * Konto hinzufuegen") ist `anzeige`/`handle` nur die Vorbelegung aus
       * der E-Mail — nicht der wirkliche Name, der schon im Profil steht.
       * Ohne diesen Abgleich zeigte der Kontowechsel dann einen geratenen
       * statt des eigenen, individuellen Profilnamens.
       */
      const echt = await profilLaden(supabase, angemeldet.id, anzeige, handle);
      const konto: AuthUser = {
        id: angemeldet.id,
        email: angemeldet.email || email,
        profile: {
          id: angemeldet.id,
          name: echt.name,
          handle: echt.handle,
          status: 'online',
          about: 'Hey, ich nutze All Media!',
        },
      };

      setKonten((prev) =>
        prev.some((k) => k.id === konto.id) ? prev.map((k) => (k.id === konto.id ? konto : k)) : [...prev, konto]
      );
      merken(konto);
      setAktivId(angemeldet.id);
    },
    [supabase, isConfigured, konten, aktivId, merken]
  );

  const kontoAbmelden = useCallback(
    async (kontoId: string) => {
      const rest = konten.filter((k) => k.id !== kontoId);

      if (supabase && aktivId === kontoId) {
        await signOut(supabase);
        await sitzungVergessen(kontoId);
        /*
         * Auf das naechste Konto der Liste weiterschalten — mitsamt Sitzung.
         * Klappt das nicht, ist niemand mehr angemeldet, und die Liste muss
         * das auch sagen.
         */
        const naechstes = rest[0];
        if (naechstes && supabase) {
          const geklappt = await sitzungWechseln(supabase, naechstes.id);
          setKonten(geklappt ? rest : []);
          setAktivId(geklappt ? naechstes.id : null);
          return;
        }
        setKonten(rest);
        setAktivId(null);
        return;
      }

      await sitzungVergessen(kontoId);
      setKonten(rest);
    },
    [supabase, aktivId, konten]
  );

  const sendPasswordResetCode = useCallback(
    async (email: string) => {
      setError(null);
      const result = await resetPasswordForEmail(supabase, email);
      if (!result.success) {
        setError(result.error ?? 'Fehler beim Versenden des Codes');
        return false;
      }
      return true;
    },
    [supabase]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        sitzungGeladen: geladen,
        konten,
        frueher,
        frueheresVergessen,
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
