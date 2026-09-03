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
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** JJJJ-MM-TT fuer den Dateinamen. */
const heute = () => new Date().toISOString().slice(0, 10);

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

  /*
   * Was das Handbuch verlangt — nachgetragen am 01.09.2026.
   *
   * Zur Begriffsklaerung: ein *Insight* ist eine Aufnahme, die an ausgewaehlte
   * Personen geht. Die *Insight Time* zaehlt die Tage in Folge, an denen sich
   * beide Seiten gegenseitig einen geschickt haben. Die "Insights" im
   * Einstellungsmenue sind etwas anderes — Statistik zum eigenen Profil.
   */
  insightSenden: (
    empfaenger: string[],
    felder: A.NeuerInsight
  ) => Promise<{ id: string; streaks: Record<string, number> } | null>;
  insightGesehen: (insightId: string) => Promise<void>;
  insightSpeichern: (insightId: string, behalten: boolean, zurueck: Rueckweg) => Promise<void>;
  insightWiederholen: (insightId: string, empfaenger: string[]) => Promise<boolean>;
  insightZiel: (zielId: string, zurueck: Rueckweg) => Promise<void>;

  nachrichtBearbeiten: (nachrichtId: string, text: string, zurueck: Rueckweg) => Promise<void>;
  nachrichtZuruecknehmen: (nachrichtId: string, zurueck: Rueckweg) => Promise<void>;
  nachrichtWeiterleiten: (nachrichtId: string, chatIds: string[]) => Promise<number | null>;
  nachrichtReaktion: (nachrichtId: string, emoji: string, zurueck: Rueckweg) => Promise<void>;

  /**
   * Einen Beitrag anlegen und seine Kennung zurueckbekommen.
   *
   * Der gewoehnliche Weg geht ueber ProfilContext, der den Beitrag zugleich
   * in den Feed stellt. Hier braucht es beides getrennt: eine Umfrage muss
   * sich an die Kennung haengen koennen, und ein geplanter Beitrag darf
   * gerade nicht im Feed erscheinen.
   */
  beitragMitId: (felder: A.NeuerBeitrag) => Promise<string | null>;

  umfrageAnlegen: (
    traeger: { art: 'post' | 'story' | 'channel'; id: string },
    felder: A.NeueUmfrage
  ) => Promise<string | null>;
  umfrageStimmen: (pollId: string, optionId: string, zurueck: Rueckweg) => Promise<void>;

  sichtbarkeit: (
    bereich: A.SichtbarkeitBereich,
    stufe: A.SichtbarkeitStufe,
    zurueck: Rueckweg
  ) => Promise<void>;
  sichtbarkeitAusnahme: (
    bereich: A.SichtbarkeitBereich,
    zielId: string,
    zurueck: Rueckweg
  ) => Promise<void>;

  altersangabe: (
    geburtsdatum: string,
    guardianHandle?: string
  ) => Promise<{ alter: number; brauchtFreigabe: boolean; guardian: string | null } | null>;
  freigabeEntscheiden: (kindId: string, zustimmen: boolean, zurueck: Rueckweg) => Promise<void>;

  /** Gibt das beanstandete Wort zurueck, oder null. */
  wortfilter: (text: string) => Promise<{ wort: string; schwere: string } | null>;

  /** Ist der Community-Name noch frei? Bei Zweifeln true — siehe unten. */
  communityNameFrei: (name: string) => Promise<boolean>;
  /** Community stumm/laut. Gibt den Zustand danach zurueck, oder null. */
  communityStumm: (communityId: string) => Promise<boolean | null>;

  /**
   * Eine Einstellung setzen. Gibt den Wert zurueck, oder null bei Fehler —
   * dann stellt der Bildschirm den Schalter wieder zurueck.
   */
  einstellung: (schluessel: string, wert: string) => Promise<string | null>;
  /** Einen fremden Profilaufruf vermerken. Meldet nichts. */
  profilAufruf: (profilId: string) => Promise<void>;
  /**
   * Die eigenen Daten als Datei — Artikel 15 DSGVO.
   *
   * Gibt zurueck, ob es geklappt hat. Auf dem Telefon gibt es keinen
   * Download-Ordner wie im Browser; die Datei landet im Zwischenspeicher
   * und geht von dort ueber das Systemblatt weiter.
   */
  datenauskunft: () => Promise<boolean>;

  pttSenden: (
    communityId: string,
    audioUri: string,
    dauer: number,
    kanalId?: string | null
  ) => Promise<string | null>;

  streamKommentar: (postId: string, text: string) => Promise<string | null>;
  spenden: (
    empfaengerId: string,
    betragCent: number,
    postId?: string | null,
    nachricht?: string
  ) => Promise<boolean>;

  standortAnfragen: (chatId: string, zielId: string) => Promise<string | null>;
  standortAntwort: (
    anfrageId: string,
    annehmen: boolean,
    stunden?: number
  ) => Promise<boolean | null>;

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
      // ------------------------------------------------------- Insights --
      /*
       * Erst hochladen, dann senden — wie bei der Story. Was die Kamera
       * liefert, ist ein Pfad auf diesem Geraet; in der Datenbank waere er
       * fuer die Gegenseite ein kaputtes Bild.
       */
      insightSenden: (empfaenger, felder) =>
        holen('Der Insight', async (c, i) => {
          let adresse = felder.mediaUrl;
          if (adresse && !/^https?:/i.test(adresse)) {
            const endung = felder.mediaTyp === 'video' ? 'mp4' : 'jpg';
            const upload = await ladeHoch(c, adresse, 'insights', `${i}-${Date.now()}.${endung}`);
            if (!upload.success || !upload.url) throw new Error('Die Aufnahme ging nicht durch');
            adresse = upload.url;
          }
          return A.insightSenden(c, i, empfaenger, { ...felder, mediaUrl: adresse });
        }),
      /*
       * Ohne Meldung, wie beim Vermerk an einer Story: das passiert beim
       * Durchblaettern nebenbei. Ins Protokoll gehoert es trotzdem.
       */
      insightGesehen: async (id) => {
        if (!supabase || !ichId) return;
        try {
          await A.insightGesehen(supabase, ichId, id);
        } catch (e: any) {
          console.error('Insight als gesehen vermerken fehlgeschlagen:', e?.message ?? e);
        }
      },
      insightSpeichern: (id, behalten, zurueck) =>
        schreiben('Das Speichern', (c, i) => A.insightSpeichern(c, i, id, behalten), zurueck),
      insightWiederholen: async (id, empfaenger) => {
        const ergebnis = await holen('Das Wiederholen', (c, i) =>
          A.insightWiederholen(c, i, id, empfaenger)
        );
        return Boolean(ergebnis);
      },
      insightZiel: (zielId, zurueck) =>
        schreiben('Die Empfängerliste', (c, i) => A.insightZiel(c, i, zielId), zurueck),

      // -------------------------------------------- Nachrichten-Werkzeuge --
      nachrichtBearbeiten: (id, text, zurueck) =>
        schreiben('Das Bearbeiten', (c, i) => A.nachrichtBearbeiten(c, i, id, text), zurueck),
      nachrichtZuruecknehmen: (id, zurueck) =>
        schreiben('Das Zurücknehmen', (c, i) => A.nachrichtZuruecknehmen(c, i, id), zurueck),
      nachrichtWeiterleiten: (id, chatIds) =>
        holen('Das Weiterleiten', (c, i) => A.nachrichtWeiterleiten(c, i, id, chatIds)),
      nachrichtReaktion: (id, emoji, zurueck) =>
        schreiben('Die Reaktion', (c, i) => A.nachrichtReaktion(c, i, id, emoji), zurueck),

      beitragMitId: (felder) =>
        holen('Der Beitrag', async (c, i) => {
          let adresse = felder.mediaUrl;
          if (adresse && !/^https?:/i.test(adresse)) {
            const endung = felder.art === 'post' ? 'jpg' : 'mp4';
            const upload = await ladeHoch(c, adresse, 'posts', `${i}-${Date.now()}.${endung}`);
            adresse = upload.success ? upload.url ?? undefined : undefined;
          }
          return A.beitragAnlegen(c, i, { ...felder, mediaUrl: adresse });
        }),

      // -------------------------------------------------------- Umfragen --
      umfrageAnlegen: (traeger, felder) =>
        holen('Die Umfrage', (c, i) => A.umfrageAnlegen(c, i, traeger, felder)),
      umfrageStimmen: (pollId, optionId, zurueck) =>
        schreiben('Die Stimme', (c, i) => A.umfrageStimmen(c, i, pollId, optionId), zurueck),

      // ---------------------------------------------------- Sichtbarkeit --
      sichtbarkeit: (bereich, stufe, zurueck) =>
        schreiben('Die Einstellung', (c, i) => A.sichtbarkeitSetzen(c, i, bereich, stufe), zurueck),
      sichtbarkeitAusnahme: (bereich, zielId, zurueck) =>
        schreiben(
          'Die Ausnahme',
          (c, i) => A.sichtbarkeitAusnahme(c, i, bereich, zielId),
          zurueck
        ),

      // ---------------------------------------------------- Altersschutz --
      altersangabe: (geburtsdatum, guardianHandle) =>
        holen('Die Altersangabe', (c, i) => A.altersangabe(c, i, geburtsdatum, guardianHandle)),
      freigabeEntscheiden: (kindId, zustimmen, zurueck) =>
        schreiben(
          'Die Entscheidung',
          (c, i) => A.freigabeEntscheiden(c, i, kindId, zustimmen),
          zurueck
        ),

      /*
       * Der Wortfilter meldet nichts von sich aus — er gibt nur zurueck, was
       * er gefunden hat. Was daraus folgt, entscheidet der Bildschirm: im
       * Chat ein Hinweis, beim Beitrag eine Ablehnung.
       */
      wortfilter: async (text) => {
        if (!supabase) return null;
        try {
          return await A.wortfilter(supabase, ichId, text);
        } catch (e: any) {
          console.error('Wortfilter fehlgeschlagen:', e?.message ?? e);
          return null;
        }
      },

      /*
       * Bei einem Fehler gilt der Name als frei. Andersherum waere es
       * schlimmer: eine Stoerung der Verbindung wuerde dann jedes Anlegen
       * verhindern, mit der Begruendung, es gebe die Community schon.
       */
      communityStumm: (communityId) =>
        holen('Das Stummschalten', (c, i) => A.communityStumm(c, i, communityId)),

      datenauskunft: async () => {
        if (!supabase || !ichId) {
          melden?.('Dafür musst du angemeldet sein');
          return false;
        }
        try {
          const daten = await A.meineDaten(supabase, ichId);
          const text = JSON.stringify(daten, null, 2);

          const datei = new File(Paths.cache, `all-media-daten-${heute()}.json`);
          // Ein zweiter Aufruf am selben Tag soll die Datei ersetzen, nicht
          // an einer bestehenden scheitern.
          if (datei.exists) datei.delete();
          datei.create();
          datei.write(text);

          if (!(await Sharing.isAvailableAsync())) {
            melden?.('Auf diesem Gerät lässt sich die Datei nicht weitergeben');
            return false;
          }
          await Sharing.shareAsync(datei.uri, {
            mimeType: 'application/json',
            dialogTitle: 'Deine All-Media-Daten',
          });
          return true;
        } catch (e: any) {
          console.error('Datenauskunft fehlgeschlagen:', e?.message ?? e);
          melden?.(e?.message || 'Die Auskunft hat nicht geklappt');
          return false;
        }
      },

      einstellung: (schluessel, wert) =>
        holen('Die Einstellung', (c, i) => A.einstellungSetzen(c, i, schluessel, wert)),

      /*
       * Ohne Meldung. Ein Profilaufruf wird nebenbei vermerkt, waehrend man
       * ein Profil oeffnet — ein Hinweis darueber, dass die Zaehlung nicht
       * geklappt hat, waere dort nur im Weg. Gleiches Vorgehen wie bei
       * storyGesehen.
       */
      profilAufruf: async (profilId) => {
        if (!supabase || !ichId) return;
        try {
          await A.profilAufrufVermerken(supabase, ichId, profilId);
        } catch (e: any) {
          console.error('Profilaufruf nicht vermerkt:', e?.message ?? e);
        }
      },

      communityNameFrei: async (name) => {
        if (!supabase) return true;
        try {
          return await A.communityNameFrei(supabase, name);
        } catch (e: any) {
          console.error('Namensprüfung fehlgeschlagen:', e?.message ?? e);
          return true;
        }
      },

      // ----------------------------------------------------- Push-to-Talk --
      pttSenden: (communityId, audioUri, dauer, kanalId) =>
        holen('Die Sprachnachricht', async (c, i) => {
          let adresse = audioUri;
          if (adresse && !/^https?:/i.test(adresse)) {
            const upload = await ladeHoch(c, adresse, 'ptt', `${i}-${Date.now()}.m4a`);
            if (!upload.success || !upload.url) throw new Error('Die Aufnahme ging nicht durch');
            adresse = upload.url;
          }
          const zeile = await A.pttSenden(c, i, communityId, adresse, dauer, kanalId);
          return zeile.id;
        }),

      // ------------------------------------------------------- Livestream --
      streamKommentar: async (postId, text) => {
        const zeile = await holen('Der Kommentar', (c, i) =>
          A.streamKommentar(c, i, postId, text)
        );
        return zeile?.id ?? null;
      },
      spenden: async (empfaengerId, betragCent, postId, nachricht) => {
        const zeile = await holen('Die Spende', (c, i) =>
          A.spenden(c, i, empfaengerId, betragCent, postId, nachricht)
        );
        return Boolean(zeile);
      },

      // ---------------------------------------------------- Standortanfrage --
      standortAnfragen: async (chatId, zielId) => {
        const zeile = await holen('Die Anfrage', (c, i) =>
          A.standortAnfragen(c, i, chatId, zielId)
        );
        return zeile?.id ?? null;
      },
      standortAntwort: (anfrageId, annehmen, stunden) =>
        holen('Die Antwort', (c, i) => A.standortAntwort(c, i, anfrageId, annehmen, stunden)),

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
