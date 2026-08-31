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

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlleDaten, ladeAlles } from '../lib/daten';
import { AuthContext } from './AuthContext';
import { useSupabase } from './SupabaseContext';

const LEER: AlleDaten = {
  users: {},
  profile: {},
  contacts: [],
  chats: [],
  archivierteChats: [],
  communityChats: [],
  stories: [],
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

  const wert = useMemo<DatenWert>(
    () => ({ ...daten, laedt, fehler, neuLaden: laden }),
    [daten, laedt, fehler, laden]
  );

  return <DatenContext.Provider value={wert}>{children}</DatenContext.Provider>;
};
