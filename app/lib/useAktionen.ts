/**
 * Der Weg vom Antippen in die Datenbank.
 *
 * `lib/aktionen.ts` kann schreiben, weiß aber nichts von Bildschirmen. Hier
 * kommt beides zusammen: der angemeldete Zugang, der eigene Nutzer und die
 * Frage, was passieren soll, wenn es schiefgeht.
 *
 * Die Bildschirme schalten sofort um — ein Herz, das erst nach einer halben
 * Sekunde rot wird, fühlt sich kaputt an. Deshalb bekommt jede Aktion einen
 * Rückweg mit: klappt das Schreiben nicht, wird die Anzeige zurückgestellt
 * und der Grund gemeldet. Vorher gab es beides nicht — weder das Schreiben
 * noch den Rückweg.
 */

import { useCallback, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import * as A from './aktionen';
import { useSupabase } from '../contexts/SupabaseContext';
import { useDaten } from '../contexts/DatenContext';

/** Stellt die Anzeige wieder auf den Stand von vorher. */
type Rueckweg = () => void;

export interface Aktionen {
  like: (beitragId: string, zurueck: Rueckweg) => Promise<void>;
  speichern: (beitragId: string, zurueck: Rueckweg) => Promise<void>;
  repost: (beitragId: string, zurueck: Rueckweg) => Promise<void>;
  hinweis: (beitragId: string, zurueck: Rueckweg) => Promise<void>;
  folgen: (userId: string, zurueck: Rueckweg) => Promise<void>;
  kommentarLike: (kommentarId: string, zurueck: Rueckweg) => Promise<void>;
  storyGesehen: (storyId: string, zurueck: Rueckweg) => Promise<void>;
  teilen: (beitragId: string, empfaenger: string[], vorschau?: string) => Promise<boolean>;
  /** Ist überhaupt jemand angemeldet? Ohne das schreibt hier nichts. */
  bereit: boolean;
}

export function useAktionen(melden?: (text: string) => void): Aktionen {
  const { supabase } = useSupabase();
  const { ichId } = useDaten();

  const schreiben = useCallback(
    async (was: string, tun: (c: SupabaseClient, ich: string) => Promise<unknown>, zurueck: Rueckweg) => {
      if (!supabase || !ichId) {
        zurueck();
        melden?.('Dafür musst du angemeldet sein');
        return;
      }
      try {
        await tun(supabase, ichId);
      } catch (e: any) {
        // Zurückstellen und sagen warum. Eine Anzeige, die etwas behauptet,
        // was nicht in der Datenbank steht, ist der schlimmere Fall.
        zurueck();
        console.error(`${was} fehlgeschlagen:`, e?.message ?? e);
        melden?.(`${was} hat nicht geklappt`);
      }
    },
    [supabase, ichId, melden]
  );

  return useMemo<Aktionen>(
    () => ({
      bereit: Boolean(supabase && ichId),
      like: (id, zurueck) => schreiben('Das Like', (c, i) => A.like(c, i, id), zurueck),
      speichern: (id, zurueck) => schreiben('Das Speichern', (c, i) => A.speichern(c, i, id), zurueck),
      repost: (id, zurueck) => schreiben('Der Repost', (c, i) => A.repost(c, i, id), zurueck),
      hinweis: (id, zurueck) =>
        schreiben('Der Beitragshinweis', (c, i) => A.beitragshinweis(c, i, id), zurueck),
      folgen: (id, zurueck) => schreiben('Das Folgen', (c, i) => A.folgen(c, i, id), zurueck),
      kommentarLike: (id, zurueck) =>
        schreiben('Das Like', (c, i) => A.kommentarLike(c, i, id), zurueck),
      /*
       * Ohne Meldung an den Nutzer. Der Vermerk „gesehen" passiert nebenbei,
       * waehrend man Storys durchblaettert — ein Hinweis darueber, dass er
       * nicht geklappt hat, waere mitten im Betrachter nur im Weg. Ins
       * Protokoll gehoert er trotzdem.
       */
      storyGesehen: async (id, zurueck) => {
        if (!supabase || !ichId) return;
        try {
          await A.storyGesehen(supabase, ichId, id);
        } catch (e: any) {
          console.error('Story als gesehen vermerken fehlgeschlagen:', e?.message ?? e);
          zurueck();
        }
      },
      teilen: async (beitragId, empfaenger, vorschau) => {
        if (!supabase || !ichId) {
          melden?.('Dafür musst du angemeldet sein');
          return false;
        }
        try {
          await A.teilen(supabase, ichId, beitragId, empfaenger, vorschau);
          return true;
        } catch (e: any) {
          console.error('Teilen fehlgeschlagen:', e?.message ?? e);
          melden?.('Das Senden hat nicht geklappt');
          return false;
        }
      },
    }),
    [schreiben, supabase, ichId, melden]
  );
}
