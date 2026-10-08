/**
 * Die Inhalte der App — aus Supabase, für alle Bildschirme.
 *
 * Vorher las jeder Bildschirm einzeln aus `app/mocks/index.ts`. Sechsund-
 * zwanzig Dateien, ein fester Bestand, der sich nie änderte und mit dem, was
 * die Website zeigte, nichts zu tun hatte.
 *
 * Jetzt wird einmal beim Anmelden geladen und hier bereitgehalten. `useDaten()`
 * gibt jedem Bildschirm dieselben Listen — dieselben, die auch die Website
 * über /api/bootstrap bekommt.
 *
 * Wer etwas ändert, ruft danach `neuLaden()`. Das ist absichtlich einfach
 * gehalten: eine Änderung geht in die Datenbank und wird von dort neu geholt,
 * statt an zwei Stellen mitgeführt zu werden. Was man sieht, steht damit
 * wirklich in der Datenbank — der häufigste Weg, wie Anzeige und Wirklichkeit
 * auseinander laufen, ist damit zu.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AlleDaten, ladeAlles, ladeChatlisten, ladeChatlistenStand } from '../lib/daten';
import { meinSchluessel } from '../lib/krypto';
import { AuthContext } from './AuthContext';
import { useSupabase } from './SupabaseContext';
import * as Aktion from '../lib/aktionen';
const ChatAbgleich = require('../../gemeinsam/chatabgleich') as typeof import('../../gemeinsam/chatabgleich');

const LEER: AlleDaten = {
  users: {},
  profile: {},
  contacts: [],
  chats: [],
  archivierteChats: [],
  communityChats: [],
  stories: [],
  storiesVideos: [],
  storiesVideosAlle: [],
  posts: [],
  videos: [],
  clips: [],
  communities: [],
  hashtags: [],
  sounds: [],
  places: [],
  friendPins: [],
  mitteilungen: [],
  gefolgt: [],
  blockiert: [],
  stummgeschaltet: [],
  markierte: [],
  favoriten: [],
  eigenesProfil: { name: '', bio: '', link: '' },
  highlights: [],
  playlists: [],
  spende: null,
  insights: [],
  insightStreaks: {},
  insightZiele: [],
  sichtbarkeit: {},
  keinInteresse: [],
  ichId: '',
  geladen: '',
};

interface DatenWert extends AlleDaten {
  /** Läuft gerade ein Ladevorgang? Beim ersten Mal steht der Bildschirm noch leer. */
  laedt: boolean;
  /**
   * Was schiefging. Nicht null zu lassen ist Absicht: ein Fehler, der still
   * zu einer leeren Liste wird, sieht aus wie „es gibt nichts" — und genau
   * das hat monatelang verborgen, dass gar nichts ankam.
   */
  fehler: string | null;
  neuLaden: () => Promise<void>;
  /**
   * Nur die Chatlisten neu holen (Kasten 27) — nach dem Zurueckkehren aus
   * einem Chat und im Takt, wenn sich ihr Stand in der Datenbank geaendert
   * hat. `neuLaden` holt alles und waere dafuer zu schwer.
   */
  chatsNeuLaden: () => Promise<void>;
  /**
   * Nimmt einen Beitrag sofort aus dem Feed, ohne alles neu zu laden. Das
   * Schreiben in die Datenbank macht das Drei-Punkte-Menue (BeitragOptionen).
   */
  keinInteresseMerken: (beitragId: string) => void;
}

const DatenContext = createContext<DatenWert | null>(null);

export const useDaten = () => {
  const wert = useContext(DatenContext);
  if (!wert) throw new Error('useDaten braucht den DatenProvider');
  return wert;
};

export const DatenProvider = ({ children }: { children: React.ReactNode }) => {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const ichId = user?.id ?? '';

  const [daten, setDaten] = useState<AlleDaten>(LEER);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!supabase || !ichId) {
      setDaten(LEER);
      return;
    }
    setLaedt(true);
    setFehler(null);
    try {
      setDaten(await ladeAlles(supabase, ichId));
    } catch (e: any) {
      // Sichtbar machen, nicht verschlucken.
      console.error('Inhalte laden fehlgeschlagen:', e?.message ?? e);
      setFehler(e?.message ?? 'Die Inhalte ließen sich nicht laden');
    } finally {
      setLaedt(false);
    }
  }, [supabase, ichId]);

  // Beim Anmelden laden, beim Abmelden leeren.
  useEffect(() => {
    laden();
  }, [laden]);

  /*
   * "Ich bin da" — beim Start und danach alle zwei Minuten.
   *
   * Ohne diesen Vermerk bliebe `presence` leer, und "zuletzt online" waere
   * eine Anzeige ohne Daten. Genau das war es bis zum 03.09.2026: im
   * Chatkopf stand fest "Online".
   */
  useEffect(() => {
    if (!supabase || !ichId) return;
    Aktion.hierBinIch(supabase);
    const uhr = setInterval(() => Aktion.hierBinIch(supabase), 120000);
    return () => clearInterval(uhr);
  }, [supabase, ichId]);

  /*
   * Die Chatlisten im Takt nachsehen (Kasten 27, 06.10.2026).
   *
   * Bis hierher wurden sie genau einmal geladen — beim Anmelden. Schrieb A
   * danach, stand bei B in der Liste weiter A's vorletzte Nachricht, ohne
   * Ungelesen-Punkt. Henrik las das als „es kommt ein anderer Text an".
   *
   * Gefragt wird zuerst nur der Stand (ladeChatlistenStand, zwei kleine
   * Abfragen). Nur wenn der sich geaendert hat, werden die Listen neu
   * geholt. Im Hintergrund wird nicht gefragt; beim Zurueckkommen sofort.
   */
  const listenStand = useRef<string | null>(null);

  const chatsNeuLaden = useCallback(async () => {
    if (!supabase || !ichId) return;
    try {
      const listen = await ladeChatlisten(supabase, ichId);
      setDaten((d) => (d.ichId === ichId ? { ...d, ...listen } : d));
    } catch (e: any) {
      console.warn('Chatliste nachladen fehlgeschlagen:', e?.message ?? e);
    }
  }, [supabase, ichId]);

  useEffect(() => {
    if (!supabase || !ichId) return;
    let aus = false;
    let laeuft = false;
    listenStand.current = null;

    const nachsehen = async () => {
      if (aus || laeuft || AppState.currentState !== 'active') return;
      laeuft = true;
      try {
        const stand = await ladeChatlistenStand(supabase, ichId);
        if (aus || stand === null) return;
        const vorher = listenStand.current;
        listenStand.current = stand;
        // Der erste Stand ist der, den ladeAlles gerade geholt hat.
        if (vorher !== null && vorher !== stand) await chatsNeuLaden();
      } finally {
        laeuft = false;
      }
    };

    nachsehen();
    const uhr = setInterval(nachsehen, ChatAbgleich.INTERVALL_LISTE_MS);
    const horcher = AppState.addEventListener('change', (z) => {
      if (z === 'active') nachsehen();
    });
    return () => {
      aus = true;
      clearInterval(uhr);
      horcher.remove();
    };
  }, [supabase, ichId, chatsNeuLaden]);

  /*
   * Den Geraeteschluessel gleich beim Anmelden anlegen, nicht erst beim
   * ersten verschluesselten Chat (Kasten 27). Ein Kuvert bekommt nur, wer
   * im Augenblick des Sendens schon einen Schluessel hat. Bis hierher legte
   * die App ihn erst an, wenn ein Zweierchat geoeffnet wurde — am 04.10.2026
   * vier Sekunden NACH einer eingegangenen Nachricht, die auf diesem Geraet
   * deshalb „nicht lesbar" blieb. Die Website meldet ihren Schluessel schon
   * beim Start an (bootstrap in web/public/app.js).
   */
  useEffect(() => {
    if (!supabase || !ichId) return;
    meinSchluessel(supabase, ichId).catch(() => {
      /* meinSchluessel wirft nicht; ohne Schluessel bleibt es beim Klartext. */
    });
  }, [supabase, ichId]);

  const keinInteresseMerken = useCallback(
    (beitragId: string) =>
      setDaten((d) => (d.keinInteresse.includes(beitragId) ? d : { ...d, keinInteresse: [...d.keinInteresse, beitragId] })),
    []
  );

  const wert = useMemo<DatenWert>(
    () => ({ ...daten, laedt, fehler, neuLaden: laden, chatsNeuLaden, keinInteresseMerken }),
    [daten, laedt, fehler, laden, chatsNeuLaden, keinInteresseMerken]
  );

  return <DatenContext.Provider value={wert}>{children}</DatenContext.Provider>;
};
