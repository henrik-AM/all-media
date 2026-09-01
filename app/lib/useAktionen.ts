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
import { ladeHoch } from './supabaseStorage';

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

  /*
   * Der zweite Teil: Chats, Kontakte und Storys.
   *
   * Diese hier geben zurueck, was die Datenbank vergeben hat — eine Kennung
   * oder null, wenn es nicht geklappt hat. Anders als beim Herz kann die
   * Anzeige nicht vorlaufen: eine Gruppe ohne Kennung aus der Datenbank ist
   * eine Gruppe, in die sich nichts schreiben laesst.
   */
  gruppeAnlegen: (name: string, mitglieder: string[]) => Promise<string | null>;
  kontaktHinzufuegen: (
    zielId: string,
    privat?: boolean,
    nachricht?: string
  ) => Promise<{ status: string; chatId: string } | null>;
  anfrageAnnehmen: (zielId: string, zurueck: Rueckweg) => Promise<void>;
  chatEinstellung: (
    chatId: string,
    was: A.ChatEinstellung,
    wert: boolean,
    zurueck: Rueckweg
  ) => Promise<void>;
  chatVerlassen: (chatId: string, zurueck: Rueckweg) => Promise<void>;
  nachrichtSenden: (
    chatId: string,
    text: string,
    anhang?: A.Anhang
  ) => Promise<{ id: string; created_at: string } | null>;
  /**
   * Eine eigene Story anlegen. `mediaUrl` darf ein Pfad auf diesem Geraet
   * sein — er wird vorher hochgeladen.
   */
  storyAnlegen: (felder: {
    mediaUrl?: string | null;
    mediaTyp?: string;
    text?: string;
  }) => Promise<string | null>;
  storyLoeschen: (storyId: string, zurueck: Rueckweg) => Promise<void>;
  /** Livestream an (Titel) oder aus (null). Steht in profiles.live. */
  livestream: (titel: string | null) => Promise<void>;
  storyLike: (storyId: string, zurueck: Rueckweg) => Promise<void>;
  /** Gibt den Chat zurueck, in dem die Antwort gelandet ist. */
  storyAntwort: (storyId: string, text: string) => Promise<string | null>;
  kommentarAnlegen: (
    beitragId: string,
    text: string
  ) => Promise<{ id: string; created_at: string } | null>;
  kommentarLoeschen: (kommentarId: string, zurueck: Rueckweg) => Promise<void>;

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

  /*
   * Fuer alles, was ein Ergebnis zurueckbringt — eine Kennung aus der
   * Datenbank. Hier kann die Anzeige nicht vorlaufen und hinterher
   * zurueckgestellt werden; es gibt schlicht nichts anzuzeigen, solange die
   * Kennung fehlt. Geht es schief, kommt null und eine Meldung.
   */
  const holen = useCallback(
    async <T,>(was: string, tun: (c: SupabaseClient, ich: string) => Promise<T>): Promise<T | null> => {
      if (!supabase || !ichId) {
        melden?.('Dafür musst du angemeldet sein');
        return null;
      }
      try {
        return await tun(supabase, ichId);
      } catch (e: any) {
        console.error(`${was} fehlgeschlagen:`, e?.message ?? e);
        melden?.(e?.message || `${was} hat nicht geklappt`);
        return null;
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
      gruppeAnlegen: (name, mitglieder) =>
        holen('Die Gruppe', (c, i) => A.gruppeAnlegen(c, i, name, mitglieder)),
      kontaktHinzufuegen: (zielId, privat, nachricht) =>
        holen('Der Kontakt', (c, i) => A.kontaktHinzufuegen(c, i, zielId, privat, nachricht)),
      anfrageAnnehmen: (zielId, zurueck) =>
        schreiben('Die Anfrage', (c, i) => A.anfrageAnnehmen(c, i, zielId), zurueck),
      chatEinstellung: (chatId, was, wert, zurueck) =>
        schreiben('Die Einstellung', (c, i) => A.chatEinstellung(c, i, chatId, was, wert), zurueck),
      chatVerlassen: (chatId, zurueck) =>
        schreiben('Das Löschen', (c, i) => A.chatVerlassen(c, i, chatId), zurueck),
      nachrichtSenden: (chatId, text, anhang) =>
        holen('Die Nachricht', (c, i) => A.nachrichtSenden(c, i, chatId, text, anhang)),
      /*
        * Erst hochladen, dann anlegen. Was die Kamera liefert, ist ein Pfad
        * auf diesem Geraet („file:///var/…"): er gilt nur hier. Stuende er in
        * der Datenbank, saehe die Website an der Stelle ein kaputtes Bild.
        * Denselben Weg geht ProfilContext fuer Beitraege.
        */
      storyAnlegen: (felder) =>
        holen('Die Story', async (c, i) => {
          let adresse = felder.mediaUrl;
          if (adresse && !/^https?:/i.test(adresse)) {
            const endung = felder.mediaTyp === 'video' ? 'mp4' : 'jpg';
            const upload = await ladeHoch(c, adresse, 'stories', `${i}-${Date.now()}.${endung}`);
            adresse = upload.success ? upload.url ?? null : null;
          }
          return A.storyAnlegen(c, i, { ...felder, mediaUrl: adresse });
        }),
      storyLoeschen: (id, zurueck) =>
        schreiben('Das Löschen', (c, i) => A.storyLoeschen(c, i, id), zurueck),
      /*
       * Ein Livestream ist in der Datenbank ein Feld am eigenen Profil. Ohne
       * es merkte niemand ausserhalb dieses Bildschirms, dass man sendet —
       * auf der Website blieb der Ring grau. Ein Rueckweg gibt es nicht: die
       * Anzeige haengt am Bildschirm selbst, nicht an diesem Feld.
       */
      livestream: (titel) => schreiben('Der Livestream', (c, i) => A.livestreamSetzen(c, i, titel), () => {}),
      storyLike: (id, zurueck) => schreiben('Das Like', (c, i) => A.storyLike(c, i, id), zurueck),
      storyAntwort: (storyId, text) =>
        holen('Die Antwort', (c, i) => A.storyAntwort(c, i, storyId, text)),
      kommentarAnlegen: (beitragId, text) =>
        holen('Der Kommentar', (c, i) => A.kommentarAnlegen(c, i, beitragId, text)),
      kommentarLoeschen: (id, zurueck) =>
        schreiben('Das Löschen', (c, i) => A.kommentarLoeschen(c, i, id), zurueck),
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
    [schreiben, holen, supabase, ichId, melden]
  );
}
