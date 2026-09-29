/**
 * Der Spendenweg — Kasten 13.2/13.3 (Feedback 21.09.2026).
 *
 * Henrik: „Gespendet wird über einen personalisierten Code, den der Nutzer
 * selbst festlegt; spätestens beim Spenden zu einem Spendenziel oder im
 * Livestream." Und: eine Zahlungsmethode (PayPal, Apple Pay, Google Pay,
 * Karte) gehört dazu.
 *
 * Jede Spende läuft durch dieses Blatt. `useAktionen().spenden` ruft
 * `spenden()` hier auf und bekommt erst dann `true`, wenn die Datenbank die
 * Spende angenommen hat. So muss kein Bildschirm — weder der Clip-Player
 * noch die Spendenziel-Ansicht aus Kasten 12 — selbst an Code und
 * Zahlungsmethode denken: fehlt etwas, fragt das Blatt danach und macht dann
 * mit derselben Spende weiter.
 *
 * Aus den Einstellungen öffnet `verwalten()` dasselbe Blatt ohne Spende:
 * Code festlegen oder ändern, Methoden anlegen, Standard wählen, löschen.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { SpendenFreigabe } from '../lib/aktionen';
import { SpendenwegSheet } from '../components/SpendenwegSheet';

export interface SpendenAnfrage {
  empfaengerId: string;
  empfaengerName?: string;
  betragCent: number;
  /** Führt die Spende mit Code und Methode aus. Wirft SpendenFehler. */
  ausfuehren: (freigabe: SpendenFreigabe) => Promise<unknown>;
}

export type Verwaltung = 'code' | 'methoden';

interface SpendenwegWert {
  /** Blatt öffnen, fragen was fehlt, spenden. true, wenn die Spende steht. */
  spenden: (anfrage: SpendenAnfrage) => Promise<boolean>;
  /** Blatt aus den Einstellungen öffnen. */
  verwalten: (bereich?: Verwaltung) => void;
  /** Gibt es das Blatt überhaupt (steht ein Provider darüber)? */
  bereit: boolean;
}

export const SpendenwegContext = createContext<SpendenwegWert>({
  // Ohne Provider gibt es keinen Code — die Spende fällt dann mit
  // „kein_code" durch, statt still ohne Prüfung durchzugehen.
  spenden: async (anfrage) => {
    await anfrage.ausfuehren({ code: '' });
    return true;
  },
  verwalten: () => {},
  bereit: false,
});

export const useSpendenweg = () => useContext(SpendenwegContext);

interface Offen {
  art: 'spende' | 'verwalten';
  anfrage?: SpendenAnfrage;
  bereich?: Verwaltung;
  nr: number;
}

export const SpendenwegProvider = ({ children }: { children: React.ReactNode }) => {
  const [offen, setOffen] = useState<Offen | null>(null);
  const erledigt = useRef<((ok: boolean) => void) | null>(null);
  const zaehler = useRef(0);

  const schliessen = useCallback((ok: boolean) => {
    setOffen(null);
    const fertig = erledigt.current;
    erledigt.current = null;
    fertig?.(ok);
  }, []);

  const spenden = useCallback(
    (anfrage: SpendenAnfrage) =>
      new Promise<boolean>((resolve) => {
        // Eine zweite Spende, während die erste noch fragt: die erste gilt
        // als abgebrochen.
        erledigt.current?.(false);
        erledigt.current = resolve;
        zaehler.current += 1;
        const nr = zaehler.current;
        /*
         * Meist kommt der Aufruf aus einem Auswahlblatt, das sich gerade
         * schließt. Zwei Modals, die sich auf iOS überschneiden, verschlucken
         * das zweite — deshalb erst öffnen, wenn das erste weg ist.
         */
        setTimeout(() => setOffen({ art: 'spende', anfrage, nr }), 350);
      }),
    []
  );

  const verwalten = useCallback((bereich?: Verwaltung) => {
    zaehler.current += 1;
    const nr = zaehler.current;
    setTimeout(() => setOffen({ art: 'verwalten', bereich, nr }), 350);
  }, []);

  const wert = useMemo(() => ({ spenden, verwalten, bereit: true }), [spenden, verwalten]);

  return (
    <SpendenwegContext.Provider value={wert}>
      {children}
      <SpendenwegSheet
        key={offen?.nr ?? 0}
        visible={Boolean(offen)}
        anfrage={offen?.art === 'spende' ? offen.anfrage : undefined}
        bereich={offen?.bereich}
        onFertig={schliessen}
      />
    </SpendenwegContext.Provider>
  );
};
