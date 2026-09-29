import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { useSupabase } from './SupabaseContext';

/*
 * Was man selbst repostet hat.
 *
 * Der Zustand liegt hier und nicht im jeweiligen Bildschirm, weil er an zwei
 * Stellen gebraucht wird: im Feed faerbt er den Knopf, im eigenen Profil
 * fuellt er den Repost-Reiter. Vorher blieb der Reiter deshalb immer leer.
 *
 * Seit 29.09.2026 laedt er beim Anmelden, was in `reposts` steht. Vorher
 * begann er leer: nach jedem Neustart zeigte der Knopf „Repost", obwohl die
 * Datenbank einen hatte, und ein Tipp loeschte ihn dort (aktionen.repost
 * schaltet um), waehrend der Knopf auf „Repostet" sprang — genau verkehrt.
 */

export interface Repost {
  art: 'post' | 'video';
  id: string;
  /** Kurztext fuer die Anzeige im Profil. */
  text: string;
}

interface RepostWert {
  reposts: Repost[];
  /** true, wenn dieser Beitrag oder dieses Video repostet ist. */
  istRepostet: (art: Repost['art'], id: string) => boolean;
  /** Umschalten. Gibt zurueck, ob es danach repostet ist. */
  umschalten: (art: Repost['art'], id: string, text: string) => boolean;
}

const RepostContext = createContext<RepostWert>({
  reposts: [],
  istRepostet: () => false,
  umschalten: () => false,
});

export const useReposts = () => useContext(RepostContext);

export const RepostProvider = ({ children }: { children: React.ReactNode }) => {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const [reposts, setReposts] = useState<Repost[]>([]);

  useEffect(() => {
    setReposts([]);
    if (!supabase || !user?.id) return;
    let gilt = true;
    supabase
      .from('reposts')
      .select('post_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('Reposts laden fehlgeschlagen:', error.message);
          return;
        }
        if (!gilt) return;
        // Die Art kennt die Tabelle nicht; istRepostet vergleicht deshalb nur
        // die Kennung, die ist ueber Home und Videos hinweg dieselbe.
        setReposts((data ?? []).map((z: any) => ({ art: 'video' as const, id: z.post_id, text: '' })));
      });
    return () => {
      gilt = false;
    };
  }, [supabase, user?.id]);

  const istRepostet = useCallback(
    (_art: Repost['art'], id: string) => reposts.some((r) => r.id === id),
    [reposts]
  );

  const umschalten = useCallback(
    (art: Repost['art'], id: string, text: string) => {
      let danach = false;
      setReposts((prev) => {
        const drin = prev.some((r) => r.id === id);
        danach = !drin;
        return drin
          ? prev.filter((r) => r.id !== id)
          : [{ art, id, text }, ...prev];
      });
      // Der Aufrufer will sofort wissen, was jetzt gilt - setReposts wirkt
      // erst spaeter, deshalb hier selbst nachsehen.
      return !reposts.some((r) => r.id === id);
    },
    [reposts]
  );

  const wert = useMemo(() => ({ reposts, istRepostet, umschalten }), [reposts, istRepostet, umschalten]);

  return <RepostContext.Provider value={wert}>{children}</RepostContext.Provider>;
};
