import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/*
 * Was man selbst repostet hat.
 *
 * Der Zustand liegt hier und nicht im jeweiligen Bildschirm, weil er an zwei
 * Stellen gebraucht wird: im Feed faerbt er den Knopf, im eigenen Profil
 * fuellt er den Repost-Reiter. Vorher blieb der Reiter deshalb immer leer.
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
  const [reposts, setReposts] = useState<Repost[]>([]);

  const istRepostet = useCallback(
    (art: Repost['art'], id: string) => reposts.some((r) => r.art === art && r.id === id),
    [reposts]
  );

  const umschalten = useCallback(
    (art: Repost['art'], id: string, text: string) => {
      let danach = false;
      setReposts((prev) => {
        const drin = prev.some((r) => r.art === art && r.id === id);
        danach = !drin;
        return drin
          ? prev.filter((r) => !(r.art === art && r.id === id))
          : [{ art, id, text }, ...prev];
      });
      // Der Aufrufer will sofort wissen, was jetzt gilt - setReposts wirkt
      // erst spaeter, deshalb hier selbst nachsehen.
      return !reposts.some((r) => r.art === art && r.id === id);
    },
    [reposts]
  );

  const wert = useMemo(() => ({ reposts, istRepostet, umschalten }), [reposts, istRepostet, umschalten]);

  return <RepostContext.Provider value={wert}>{children}</RepostContext.Provider>;
};
