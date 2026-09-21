/*
 * Eine Quelle für die Einstellungen — für die ganze App.
 *
 * Vorher lud jeder Bildschirm sie selbst: `App.tsx` (nur das Design),
 * `SettingsScreen` (alle) und `MessengerProfileScreen` (nur die
 * Lesebestätigung). Drei Abfragen, drei Kopien, und keine wusste von den
 * anderen. Wer in den Einstellungen etwas umlegte, sah die Wirkung anderswo
 * erst nach einem Neustart — genau die Art Lücke, um die es am 17.09.2026
 * ging: gespeichert ist nicht dasselbe wie überall angekommen.
 *
 * Jetzt lädt dieser Kontext einmal, gibt die Werte an alle weiter und schreibt
 * beim Umlegen durch: erst anzeigen, dann speichern, bei einem Fehler
 * zurückdrehen. Dieselbe Reihenfolge wie beim Herz.
 *
 * Gegenstück auf der Website ist `state.einstellungen` in `web/public/app.js`
 * — die hatte von Anfang an eine gemeinsame Quelle, der App fehlte sie.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { AuthContext } from './AuthContext';
import { useSupabase } from './SupabaseContext';
import { einstellungSetzen as schreibeEinstellung } from '../lib/aktionen';
import { ladeEinstellungen } from '../lib/daten';
import { vibrationSetzen } from '../lib/haptics';
import { toeneSetzen } from '../lib/toene';

type Werte = Record<string, string>;

/*
 * Der Auslieferungszustand jedes Schalters. Was in `user_settings` steht,
 * sticht ihn; was fehlt, gilt als dieser Wert. So braucht eine neue
 * Einstellung keine Nachtraege fuer bestehende Konten.
 *
 * Stand bis zum 17.09.2026 im `SettingsScreen` — also genau dort, wo ihn
 * niemand sonst lesen konnte. Gegenstueck ist `SCHALTER_STANDARD` in
 * web/public/app.js; die beiden Tabellen muessen gleich bleiben.
 */
export const SCHALTER_STANDARD: Record<string, boolean> = {
  videoPrivate: false,
  commPrivate: false,
  bildschirmsperre: false,
  toene: true,
  vibration: true,
  vorschau: true,
  lesebestaetigung: true,
  entersenden: true,
  datensparen: false,
};

type EinstellungenWert = {
  /** `null`, solange nicht geladen — vorher wäre jeder Schalter eine Behauptung. */
  einstellungen: Werte | null;
  /** Ein Wert mit Rückfall auf den Auslieferungszustand. */
  wert: (schluessel: string, standard?: string) => string;
  /** Ein Schalter als Ja/Nein. In `user_settings` steht Text: 'an' oder 'aus'. */
  an: (schluessel: string, standard?: boolean) => boolean;
  /** Umlegen und durchschreiben. Gibt `false`, wenn nichts gespeichert wurde. */
  setzen: (schluessel: string, neuerWert: string) => Promise<boolean>;
};

const leer: EinstellungenWert = {
  einstellungen: null,
  wert: (_s, standard = '') => standard,
  an: (s, standard) => standard ?? SCHALTER_STANDARD[s] ?? false,
  setzen: async () => false,
};

export const EinstellungenContext = createContext<EinstellungenWert>(leer);

export const EinstellungenProvider = ({ children }: { children: React.ReactNode }) => {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const [einstellungen, setEinstellungen] = useState<Werte | null>(null);

  useEffect(() => {
    if (!supabase || !user?.id) {
      setEinstellungen(null);
      return;
    }
    let gilt = true;

    const holen = () =>
      ladeEinstellungen(supabase, user.id)
        .then((werte) => {
          if (gilt) setEinstellungen(werte);
        })
        .catch((e: any) => {
          console.error('Einstellungen laden fehlgeschlagen:', e?.message ?? e);
          // Leer statt `null`: sonst warten die Schalter für immer auf Werte,
          // die nicht kommen, und zeigen nie ihren Auslieferungszustand.
          if (gilt) setEinstellungen({});
        });

    holen();

    /*
     * Noch einmal holen, sobald die App in den Vordergrund kommt.
     *
     * Ohne das wandert eine Änderung von der Website erst beim nächsten
     * Neustart in die App — genau die Lücke, um die es am 17.09.2026 ging:
     * gespeichert ist nicht dasselbe wie überall angekommen. Ein
     * Echtzeit-Kanal wäre der saubere Weg, den gibt es im Projekt aber
     * nirgends; der Vordergrundwechsel ist der Moment, in dem es zählt.
     *
     * Gleiche Regel in web/public/app.js (`visibilitychange`).
     */
    const horcher = AppState.addEventListener('change', (zustand) => {
      if (zustand === 'active') void holen();
    });

    return () => {
      gilt = false;
      horcher.remove();
    };
  }, [supabase, user?.id]);

  /*
   * `lib/haptics.ts` ist ein Modul und kann keinen Kontext lesen. Der Wert
   * wird ihm deshalb hinterlegt — hier, an einer Stelle, statt in jedem
   * Bildschirm vor jedem `haptic.light()` abgefragt zu werden.
   */
  useEffect(() => {
    if (!einstellungen) return;
    const roh = einstellungen.vibration;
    vibrationSetzen(roh === undefined ? SCHALTER_STANDARD.vibration : roh === 'an');
  }, [einstellungen?.vibration]);

  /* Dasselbe fuer den Nachrichtenton — siehe lib/toene.ts. */
  useEffect(() => {
    if (!einstellungen) return;
    const roh = einstellungen.toene;
    toeneSetzen(roh === undefined ? SCHALTER_STANDARD.toene : roh === 'an');
  }, [einstellungen?.toene]);

  const setzen = useCallback(
    async (schluessel: string, neuerWert: string) => {
      const vorher = einstellungen?.[schluessel];
      setEinstellungen((prev) => ({ ...(prev ?? {}), [schluessel]: neuerWert }));

      if (!supabase || !user?.id) return false;
      try {
        await schreibeEinstellung(supabase, user.id, schluessel, neuerWert);
        /*
         * „Privates Profil" steht zweimal in der Liste — unter Videos
         * (videoPrivate) und unter Communitys (commPrivate). Beide schalten
         * dieselbe Spalte `profiles.privat`, die Schreibschicht setzt deshalb
         * immer beide Schlüssel (aktionen.ts). Hier zieht die Anzeige nach,
         * sonst stünde der zweite Schalter bis zum nächsten Laden auf dem
         * alten Wert. Gleiche Regel in web/public/app.js (einstellungSetzen).
         */
        if (schluessel === 'videoPrivate' || schluessel === 'commPrivate') {
          const anderer = schluessel === 'videoPrivate' ? 'commPrivate' : 'videoPrivate';
          setEinstellungen((prev) => ({ ...(prev ?? {}), [anderer]: neuerWert }));
        }
        return true;
      } catch (e: any) {
        console.error('Einstellung speichern fehlgeschlagen:', e?.message ?? e);
        setEinstellungen((prev) => {
          const kopie = { ...(prev ?? {}) };
          if (vorher === undefined) delete kopie[schluessel];
          else kopie[schluessel] = vorher;
          return kopie;
        });
        return false;
      }
    },
    [supabase, user?.id, einstellungen]
  );

  const inhalt = useMemo<EinstellungenWert>(() => {
    const wert = (schluessel: string, standard = '') => einstellungen?.[schluessel] ?? standard;
    return {
      einstellungen,
      wert,
      an: (schluessel: string, standard?: boolean) => {
        const roh = einstellungen?.[schluessel];
        if (roh !== undefined) return roh === 'an';
        return standard ?? SCHALTER_STANDARD[schluessel] ?? false;
      },
      setzen,
    };
  }, [einstellungen, setzen]);

  return <EinstellungenContext.Provider value={inhalt}>{children}</EinstellungenContext.Provider>;
};

export const useEinstellungen = () => useContext(EinstellungenContext);
