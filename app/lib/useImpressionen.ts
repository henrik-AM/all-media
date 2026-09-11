/**
 * Der Weg vom Bildschirm in die Impressionstabelle.
 *
 * `lib/impressionen.ts` misst, `lib/aktionen.ts` schreibt — hier kommt
 * beides mit dem Bildschirm zusammen, so wie `useAktionen` es fuer Like und
 * Folgen tut.
 *
 * Ein Bildschirm braucht davon zwei Zeilen:
 *
 *     const { sichtbarWechsel, sichtbarkeit } = useImpressionen('feed');
 *     <FlatList onViewableItemsChanged={sichtbarWechsel}
 *               viewabilityConfig={sichtbarkeit} />
 *
 * Was in der App der ViewToken ist, ist im Browser der
 * IntersectionObserver; `web/public/impressionen.js` fuehrt dieselbe
 * Rechnung mit denselben Zahlen aus.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import type { ViewToken } from 'react-native';
import { Impressionssammler, type Impressionsquelle } from './impressionen';
import { impressionenVermerken } from './aktionen';
import { useSupabase } from '../contexts/SupabaseContext';

/**
 * Ab 60 Prozent Flaeche gilt ein Beitrag als gesehen — dieselbe Schwelle,
 * bei der der VideoFeedScreen ein Reel anlaufen laesst und bei der die
 * Website ihre Reels startet. Zwei verschiedene Schwellen fuer "zu sehen"
 * waeren zwei verschiedene Wahrheiten.
 */
const SCHWELLE = 60;

export function useImpressionen(quelle: Impressionsquelle) {
  const { supabase } = useSupabase();

  // Der Sammler wird einmal gebaut, der Zugang kann spaeter kommen: die
  // Anmeldung laeuft noch, waehrend der Feed schon steht. Deshalb ueber ein
  // Ref und nicht ueber den Wert im Abschluss.
  const supabaseRef = useRef(supabase);
  supabaseRef.current = supabase;

  const sammler = useRef<Impressionssammler | null>(null);
  if (!sammler.current) {
    sammler.current = new Impressionssammler(quelle, async (eintraege) => {
      // Ohne Anmeldung gibt es niemanden, dem die Sichtung gehoert. Dann
      // wird sie verworfen statt aufgehoben: Beispieldaten sind keine
      // Sichtungen.
      if (!supabaseRef.current) return;
      await impressionenVermerken(supabaseRef.current, eintraege);
    });
  }

  const sichtbarWechsel = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const ids = viewableItems
        .map((v) => (v.item as { id?: string })?.id)
        .filter((id): id is string => Boolean(id));
      sammler.current?.sichtbar(ids);
    },
    []
  );

  const sichtbarkeit = useMemo(() => ({ itemVisiblePercentThreshold: SCHWELLE }), []);

  useEffect(() => {
    /*
     * Der Wechsel in den Hintergrund ist der haeufigste Abschluss einer
     * Sitzung — niemand verlaesst den Feed ordentlich, man legt das Telefon
     * weg. Ohne diese Zeile ginge genau die laengste Sichtung verloren.
     */
    const horcher = AppState.addEventListener('change', (zustand) => {
      if (zustand !== 'active') void sammler.current?.abgeben();
    });

    return () => {
      horcher.remove();
      void sammler.current?.abgeben();
    };
  }, []);

  return { sichtbarWechsel, sichtbarkeit };
}
