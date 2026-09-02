import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Clip,
  Community,
  Mitteilung,
  MitteilungAnzeige,
  MitteilungsBereich,
  Post,
  RasterEintrag,
  Spende,
  User,
  Video,
} from '../types';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import * as Aktion from '../lib/aktionen';
import { ladeHoch } from '../lib/supabaseStorage';

/*
 * Was hinter den drei Knoepfen oben rechts im eigenen Profil steckt:
 * Mitteilungen (Glocke) und die eigenen Inhalte (Plus).
 *
 * Der Zustand liegt hier und nicht im jeweiligen Bildschirm, weil er an
 * mehreren Stellen zugleich gebraucht wird - ein neuer Beitrag muss im Feed
 * *und* im eigenen Raster erscheinen, ein neuer Kanal in der Community-Liste
 * *und* im Community-Profil. Genau daran ist frueher schon das "neue
 * Eintraege tauchen nicht auf" gescheitert.
 *
 * Die Website macht dasselbe auf dem Server (web/server/app.js). Beide
 * Fassungen zeigen deshalb dieselben Mitteilungen.
 */

/*
 * Hier stand bis zum 01.09.2026 eine feste Liste aus dreizehn Mitteilungen:
 * "Anna hat deinen Beitrag geliked", "Elif folgt dir jetzt" und so weiter,
 * mit Kennungen wie u1 und p1, die es in der Datenbank gar nicht gibt.
 *
 * Sie wurde von niemandem mehr gelesen — die Mitteilungen kommen aus
 * `daten.mitteilungen` (lib/daten.ts, ladeMitteilungen). Uebrig war ein
 * Bestand erfundener Namen im Quelltext, der bei der naechsten Aenderung
 * jemanden auf die falsche Faehrte gefuehrt haette. Das war der letzte Rest
 * der alten Beispieldaten in der App.
 */

/** "vor 10 min", "vor 4 h", "vor 5 Tagen", "vor 3 W", "vor 2 M" - wie im Prototyp. */
export const zeitText = (minuten: number) => {
  if (minuten < 60) return `vor ${minuten} min`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `vor ${stunden} h`;
  const tage = Math.floor(stunden / 24);
  if (tage === 1) return 'vor 1 Tag';
  if (tage < 7) return `vor ${tage} Tagen`;
  const wochen = Math.floor(tage / 7);
  if (wochen < 5) return `vor ${wochen} W`;
  return `vor ${Math.floor(tage / 30)} M`;
};

const mitteilungText = (
  m: Mitteilung,
  communities: Community[],
  users: Record<string, User>
) => {
  const name = users[m.userId]?.name ?? 'Jemand';
  const kanal = communities.find((c) => c.id === m.ziel.id)?.name ?? 'einer Community';

  switch (m.art) {
    case 'like':
      return `${name} gefällt dein ${m.ziel.art === 'video' ? 'Video' : 'Beitrag'}.`;
    case 'follow':
      return `${name} folgt dir jetzt.`;
    case 'comment':
      return `${name} hat deinen Beitrag kommentiert.`;
    case 'repost':
      return `${name} hat dein Video repostet.`;
    case 'mention':
      return `${name} hat dich in einem Kommentar erwähnt.`;
    case 'story':
      return `${name} hat auf deine Story geantwortet.`;
    case 'kanal':
      return `${name} hat einen neuen Kanal in „${kanal}“ erstellt.`;
    case 'beitritt':
      return `${name} ist „${kanal}“ beigetreten.`;
    case 'nachricht':
      return `Neue Nachrichten in „${kanal}“.`;
    case 'einladung':
      return `${name} hat dich zu „${kanal}“ eingeladen.`;
  }
};

interface NeuesVideo {
  beschreibung: string;
  ort: string;
  quer: boolean;
  mediaUri?: string;
  /** Punkt 38: gewählte Musik, sonst Originalton. */
  music?: string;
}

interface ProfilWert {
  /* --- Glocke --- */
  mitteilungen: (bereich: MitteilungsBereich) => MitteilungAnzeige[];
  ungelesen: (bereich: MitteilungsBereich) => number;
  alsGelesen: (id: string) => void;
  alleGelesen: (bereich: MitteilungsBereich) => void;

  /* --- Plus: eigene Inhalte --- */
  eigeneBeitraege: Post[];
  eigeneVideos: Video[];
  clips: Clip[];
  highlights: string[];
  playlists: string[];
  spende: Spende | null;
  raster: RasterEintrag[];

  beitragAnlegen: (werte: { beschreibung: string; ort: string; mediaUri?: string; music?: string }) => void;
  videoAnlegen: (werte: NeuesVideo) => void;
  highlightAnlegen: (name: string) => string | null;
  playlistAnlegen: (name: string) => string | null;
  spendeSetzen: (spende: Spende) => void;
  aufzeichnungAnlegen: (sekunden: number, zuschauer: number) => void;

  /** Like, Merken oder Repost bei einem Querformat-Video umschalten. */
  clipUmschalten: (id: string, was: 'like' | 'save' | 'repost') => void;

  /* --- Kontaktinfo (Prototyp "MC + Kontakteinstellungen") --- */
  /** Mit einem Stern markierte Nachrichten. */
  markierte: string[];
  markieren: (messageId: string) => boolean;
  /** Favoriten und stummgeschaltete Chats. */
  favoriten: string[];
  favoritUmschalten: (userId: string) => boolean;
  chatStumm: string[];
  chatStummUmschalten: (chatId: string) => boolean;
  /** Geleerte Chats - ihre Nachrichten werden nicht mehr angezeigt. */
  geleerteChats: string[];
  chatLeeren: (chatId: string) => void;

  /* --- Weitere Optionen im Profil einer Person --- */
  istStumm: (userId: string) => boolean;
  istBlockiert: (userId: string) => boolean;
  meldeGrund: (userId: string) => string | undefined;
  /** Umschalten. Gibt zurueck, was danach gilt. */
  stummSchalten: (userId: string) => boolean;
  blockieren: (userId: string) => boolean;
  melden: (userId: string, grund: string) => void;

  /* --- Teilen --- */
  /** Wie oft dieser Beitrag oder dieses Video von hier aus gesendet wurde. */
  geteiltZaehler: Record<string, number>;
  geteilt: (id: string) => void;

  /* --- Communitys --- */
  communities: Community[];
  kanalAnlegen: (name: string, thema: string) => string | null;
  /**
   * Eine gerade angelegte Community wieder entfernen.
   *
   * Gebraucht, wenn die Namenspruefung gegen die Datenbank erst nachtraeglich
   * zurueckkommt und ergibt, dass es sie schon gibt.
   */
  kanalEntfernenNachName: (name: string) => void;
  /** Unterthema in einer Community anlegen. Gibt einen Fehlertext zurueck. */
  unterthemaAnlegen: (communityId: string, name: string) => string | null;
  kanalBeitreten: (id: string) => void;
  /** Beim Oeffnen: die ungelesenen Nachrichten des Kanals auf null setzen. */
  kanalGelesen: (id: string) => void;

  /* --- Folgen --- */
  /*
   * Henrik: "Follower/Follows muessen ueberall synchronisiert werden: Home,
   * Kurzvideos, normale Videos, Suche, Profile usw."
   *
   * Vorher hing der Zustand am einzelnen Beitrag (post.following). Wer im
   * Feed auf "Folgen" tippte, aenderte damit nur diesen einen Beitrag - ein
   * zweiter Beitrag derselben Person zeigte weiter "Folgen", und im Profil
   * stand auch nichts anderes. Jetzt haengt er an der Person und gilt damit
   * an jeder Stelle gleich.
   */
  gefolgt: string[];
  folgtPerson: (userId: string) => boolean;
  /** Umschalten. Gibt zurueck, ob man der Person danach folgt. */
  folgenUmschalten: (userId: string) => boolean;

  /* --- Eigenes Profil bearbeiten --- */
  /*
   * Henrik: "Profilbild, Name, Info/Bio, Link usw. ueber eine
   * Bearbeitungseinstellung aendern koennen."
   *
   * In den Einstellungen gab es zwar ein Formular, es hat den Namen aber
   * nirgends hingeschrieben - nur einen Hinweis eingeblendet. Der Wert liegt
   * jetzt hier, damit ihn Profil, Einstellungen und Feed gleich sehen.
   */
  eigenesProfil: EigenesProfil;
  profilSpeichern: (werte: Partial<EigenesProfil>) => void;
}

export interface EigenesProfil {
  name: string;
  bio: string;
  link: string;
  /** Selbst gewaehltes Bild. Liegt nur auf diesem Geraet. */
  bildUri?: string;
}

const GRUND_RASTER: RasterEintrag[] = [
  'image', 'video', 'image', 'video', 'image', 'image',
  'video', 'image', 'video', 'image', 'video', 'image',
].map((kind, i) => ({ id: `me_g${i}`, kind: kind as 'image' | 'video' }));

const ProfilContext = createContext<ProfilWert | null>(null);

export const useProfil = () => {
  const wert = useContext(ProfilContext);
  if (!wert) throw new Error('useProfil braucht den ProfilProvider');
  return wert;
};

const zweistellig = (n: number) => String(n).padStart(2, '0');

export const ProfilProvider = ({ children }: { children: React.ReactNode }) => {
  /*
   * Der Ausgangsstand kommt aus der Datenbank, nicht aus einer Liste im
   * Quelltext. Was der Nutzer hier ändert, wird sofort angezeigt und
   * gleichzeitig gespeichert; beim nächsten Laden kommt es von dort zurück.
   */
  const daten = useDaten();
  const { supabase } = useSupabase();

  /*
   * Schreiben, was hier umgeschaltet wird.
   *
   * Bis zum 01.09.2026 lebten Like, Speichern, Repost und Folgen nur in
   * diesem Zustand. Nach einem Neustart der App war alles weg, und auf der
   * Website erschien es nie. Der Zustand hier bleibt — er macht die Anzeige
   * sofort richtig — aber er ist nicht mehr das Einzige, was passiert.
   */
  const schreiben = useCallback(
    (was: string, tun: (c: any, ich: string) => Promise<unknown>, zurueck: () => void) => {
      if (!supabase || !daten.ichId) return;
      tun(supabase, daten.ichId).catch((e: any) => {
        console.error(`${was} fehlgeschlagen:`, e?.message ?? e);
        zurueck();
      });
    },
    [supabase, daten.ichId]
  );

  const [alle, setAlle] = useState<Mitteilung[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);

  const [eigeneBeitraege, setEigeneBeitraege] = useState<Post[]>([]);
  const [eigeneVideos, setEigeneVideos] = useState<Video[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<string[]>([]);
  const [spende, setSpende] = useState<Spende | null>(null);
  const [raster, setRaster] = useState<RasterEintrag[]>([]);
  const [geteiltZaehler, setGeteiltZaehler] = useState<Record<string, number>>({});
  const [stumm, setStumm] = useState<string[]>([]);
  const [blockiert, setBlockiert] = useState<string[]>([]);
  const [gemeldet, setGemeldet] = useState<Record<string, string>>({});
  const [markierte, setMarkierte] = useState<string[]>([]);
  const [favoriten, setFavoriten] = useState<string[]>([]);
  const [chatStumm, setChatStumm] = useState<string[]>([]);
  const [geleerteChats, setGeleerteChats] = useState<string[]>([]);

  /*
   * Wem man folgt - eine Liste fuer die ganze App, siehe ProfilWert.
   *
   * Sie steht in der Tabelle `follows`. Vorher hing der Zustand am einzelnen
   * Beitrag: wer im Feed auf "Folgen" tippte, aenderte damit nur diesen einen.
   */
  const [gefolgt, setGefolgt] = useState<string[]>([]);

  const folgtPerson = useCallback((userId: string) => gefolgt.includes(userId), [gefolgt]);

  const [eigenesProfil, setEigenesProfil] = useState<EigenesProfil>({
    name: '',
    bio: '',
    link: '',
  });

  /*
   * Sobald die Inhalte da sind (oder nach neuLaden()), wird alles hier
   * uebernommen. `daten.geladen` ist der Zeitstempel des Ladevorgangs - er
   * aendert sich bei jedem Laden und nur dann.
   */
  useEffect(() => {
    if (!daten.geladen) return;
    setAlle(daten.mitteilungen);
    setCommunities(daten.communities);
    setClips(daten.clips);
    setHighlights(daten.highlights);
    setPlaylists(daten.playlists);
    // Die Spendenaktion stand bisher nur im Arbeitsspeicher der App: nach
    // einem Neustart war sie weg, obwohl sie in der Datenbank stand.
    setSpende(daten.spende);
    setGefolgt(daten.gefolgt);
    setStumm(daten.stummgeschaltet);
    setBlockiert(daten.blockiert);
    setMarkierte(daten.markierte);
    setFavoriten(daten.favoriten);
    setEigenesProfil(daten.eigenesProfil);
    // Das Raster zeigt, was man selbst veroeffentlicht hat - nicht mehr eine
    // erfundene Kachelfolge.
    setRaster(
      [...daten.posts, ...daten.videos, ...daten.clips]
        .filter((e) => e.userId === 'me')
        .map((e) => ({
          id: e.id,
          kind: daten.posts.some((p) => p.id === e.id) ? 'image' : 'video',
          eigen: true,
          mediaUri: (e as { mediaUri?: string }).mediaUri,
          standbild: (e as { standbild?: string }).standbild,
        }))
    );
    setEigeneBeitraege([]);
    setEigeneVideos([]);
  }, [daten.geladen]);

  const profilSpeichern = useCallback(
    (werte: Partial<EigenesProfil>) => {
      const vorherStand = eigenesProfil;
      setEigenesProfil((vorher) => ({ ...vorher, ...werte }));

      /*
       * Und in die Datenbank. Henrik wollte ausdruecklich „Name, Info/Bio,
       * Link ueber eine Bearbeitungseinstellung aendern koennen" — das
       * Formular gab es, gespeichert wurde aber nichts. Nach dem naechsten
       * Start stand wieder der alte Name da.
       *
       * `bildUri` bleibt draussen: das ist ein Pfad auf diesem Geraet und
       * gehoert nicht in eine Spalte, die andere Geraete lesen.
       */
      const { bildUri, ...felder } = werte;
      if (Object.keys(felder).length === 0) return;

      schreiben('Das Profil', (c, ich) => Aktion.profilAendern(c, ich, felder), () =>
        setEigenesProfil(vorherStand)
      );
    },
    [eigenesProfil, schreiben]
  );

  const folgenUmschalten = useCallback(
    (userId: string) => {
      const danach = !gefolgt.includes(userId);
      setGefolgt((prev) => (danach ? [...prev, userId] : prev.filter((id) => id !== userId)));

      // Und in die Datenbank, damit es den App-Start ueberlebt und auf der
      // Website ankommt. Scheitert es, wird zurueckgestellt.
      schreiben('Das Folgen', (c, ich) => Aktion.folgen(c, ich, userId), () =>
        setGefolgt((prev) => (danach ? prev.filter((id) => id !== userId) : [...prev, userId]))
      );

      return danach;
    },
    [gefolgt, schreiben]
  );

  const mitteilungen = useCallback(
    (bereich: MitteilungsBereich): MitteilungAnzeige[] =>
      alle
        .filter((m) => m.bereich === bereich)
        .sort((a, b) => a.minuten - b.minuten)
        .map((m) => ({
          id: m.id,
          text: mitteilungText(m, communities, daten.users),
          zeit: zeitText(m.minuten),
          gelesen: m.gelesen,
          ziel: m.ziel,
        })),
    [alle, communities, daten.users]
  );

  const ungelesen = useCallback(
    (bereich: MitteilungsBereich) => alle.filter((m) => m.bereich === bereich && !m.gelesen).length,
    [alle]
  );

  const alsGelesen = useCallback(
    (id: string) => {
      setAlle((prev) => prev.map((m) => (m.id === id ? { ...m, gelesen: true } : m)));
      // Sonst steht der rote Punkt beim naechsten Start wieder da.
      schreiben('Mitteilung als gelesen', (c, ich) => Aktion.mitteilungGelesen(c, ich, id), () =>
        setAlle((prev) => prev.map((m) => (m.id === id ? { ...m, gelesen: false } : m)))
      );
    },
    [schreiben]
  );

  const alleGelesen = useCallback(
    (bereich: MitteilungsBereich) => {
      // Welche vorher ungelesen waren — nur die duerfen zurueckgedreht werden.
      let vorher: string[] = [];
      setAlle((prev) => {
        vorher = prev.filter((m) => m.bereich === bereich && !m.gelesen).map((m) => m.id);
        return prev.map((m) => (m.bereich === bereich ? { ...m, gelesen: true } : m));
      });

      schreiben(
        'Alle als gelesen',
        (c, ich) => Aktion.alleMitteilungenGelesen(c, ich, bereich),
        () => setAlle((prev) => prev.map((m) => (vorher.includes(m.id) ? { ...m, gelesen: false } : m)))
      );
    },
    [schreiben]
  );

  const nummer = () => `e${Date.now()}${Math.floor(Math.random() * 1000)}`;

  /*
   * Einen angelegten Beitrag nachtraeglich auf seine echte Kennung umstellen.
   *
   * Die App vergibt beim Anlegen eine vorlaeufige Kennung („p_1756…"), damit
   * die Kachel sofort dasteht. Die Datenbank vergibt ihre eigene. Solange
   * beide auseinander liefen, zeigte auf einen frisch angelegten Beitrag
   * weder Liken noch Kommentieren noch Loeschen — es gab ihn unter dieser
   * Kennung nirgends.
   */
  const kennungTauschen = useCallback((vorlaeufig: string, echt: string) => {
    setEigeneBeitraege((prev) => prev.map((b) => (b.id === vorlaeufig ? { ...b, id: echt } : b)));
    setEigeneVideos((prev) => prev.map((v) => (v.id === vorlaeufig ? { ...v, id: echt } : v)));
    setClips((prev) => prev.map((c) => (c.id === vorlaeufig ? { ...c, id: echt } : c)));
    setRaster((prev) => prev.map((r) => (r.id === vorlaeufig ? { ...r, id: echt } : r)));
  }, []);

  /** Einen gerade angelegten Eintrag wieder wegnehmen, wenn er nicht ankam. */
  const eintragZuruecknehmen = useCallback((id: string) => {
    setEigeneBeitraege((prev) => prev.filter((b) => b.id !== id));
    setEigeneVideos((prev) => prev.filter((v) => v.id !== id));
    setClips((prev) => prev.filter((c) => c.id !== id));
    setRaster((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /**
   * Den Beitrag in die Datenbank legen und die Kennung nachziehen.
   *
   * Die Anzeige steht schon; hier geht es nur noch darum, dass er auch
   * wirklich existiert. Klappt das nicht, verschwindet die Kachel wieder —
   * eine Kachel, die es nur auf diesem Bildschirm gibt, ist irrefuehrender
   * als gar keine.
   */
  const inDatenbank = useCallback(
    (vorlaeufig: string, felder: Aktion.NeuerBeitrag) => {
      if (!supabase || !daten.ichId) return;

      (async () => {
        /*
         * Erst die Aufnahme hochladen, dann den Beitrag anlegen.
         *
         * Was die Kamera liefert, ist ein Pfad auf diesem Geraet
         * („file:///var/…"). Er gilt nur hier. Stuende er in der Datenbank,
         * saehe die Website an dieser Stelle ein kaputtes Bild, und auf einem
         * zweiten Geraet auch. Gespeichert wird deshalb die oeffentliche
         * Adresse aus dem Speicher von Supabase.
         *
         * Klappt der Upload nicht, wird der Beitrag trotzdem angelegt — nur
         * ohne Bild. Ein Beitrag ohne Bild ist immer noch besser als eine
         * Kachel, die es nur auf diesem Bildschirm gibt.
         */
        let adresse = felder.mediaUrl;
        if (adresse && !/^https?:/i.test(adresse)) {
          const endung = felder.art === 'post' ? 'jpg' : 'mp4';
          const upload = await ladeHoch(
            supabase,
            adresse,
            'posts',
            `${daten.ichId}-${Date.now()}.${endung}`
          );
          adresse = upload.success ? upload.url ?? undefined : undefined;
        }

        const echt = await Aktion.beitragAnlegen(supabase, daten.ichId, {
          ...felder,
          mediaUrl: adresse,
        });
        kennungTauschen(vorlaeufig, echt);
      })().catch((e: any) => {
        console.error('Beitrag anlegen fehlgeschlagen:', e?.message ?? e);
        eintragZuruecknehmen(vorlaeufig);
      });
    },
    [supabase, daten.ichId, kennungTauschen, eintragZuruecknehmen]
  );

  const beitragAnlegen: ProfilWert['beitragAnlegen'] = useCallback(({ beschreibung, ort, mediaUri, music }) => {
    const id = `p_${nummer()}`;
    setEigeneBeitraege((prev) => [
      {
        id,
        userId: 'me',
        location: ort || '',
        music: music || 'Originalton',
        description: beschreibung,
        likedBy: '',
        likes: 0,
        comments: 0,
        liked: false,
        saved: false,
        following: false,
        notify: false,
        reposts: 0,
        reposted: false,
        mediaUri,
      },
      ...prev,
    ]);
    setRaster((prev) => [{ id, kind: 'image', eigen: true, mediaUri }, ...prev]);

    inDatenbank(id, {
      art: 'post',
      beschreibung,
      ort: ort || '',
      musik: music || 'Originalton',
      mediaUrl: mediaUri,
    });
  }, [inDatenbank]);

  const videoAnlegen: ProfilWert['videoAnlegen'] = useCallback(({ beschreibung, ort, quer, mediaUri, music }) => {
    const id = quer ? `q_${nummer()}` : `v_${nummer()}`;

    if (quer) {
      setClips((prev) => [
        { id, userId: 'me', title: beschreibung, duration: '00:15', views: 0, age: 'gerade eben', art: 'standard' },
        ...prev,
      ]);
    } else {
      setEigeneVideos((prev) => [
        {
          id,
          userId: 'me',
          description: beschreibung,
          location: ort || '',
          music: music || 'Originalton',
          likes: 0,
          comments: 0,
          shares: 0,
          liked: false,
          saved: false,
          reposted: false,
          notify: true,
          mediaUri,
        },
        ...prev,
      ]);
    }
    setRaster((prev) => [{ id, kind: 'video', eigen: true, mediaUri }, ...prev]);

    // Querformat ist ein „clip", Hochformat ein „reel" — dieselbe Einteilung
    // wie in der Datenbank und auf der Website.
    inDatenbank(id, {
      art: quer ? 'clip' : 'reel',
      titel: quer ? beschreibung : '',
      beschreibung,
      ort: ort || '',
      musik: music || 'Originalton',
      mediaUrl: mediaUri,
      dauer: quer ? '00:15' : undefined,
    });
  }, [inDatenbank]);

  /*
   * Highlights und Playlists sind zwei Textlisten in der eigenen Profilzeile.
   * Sie standen in der App nur hier im Zustand: nach dem naechsten Start
   * waren sie weg, obwohl die Website sie laengst speicherte (handleProfilListe).
   */
  /** Gibt einen Fehlertext zurueck, wenn es nicht geklappt hat - sonst null. */
  const highlightAnlegen = useCallback(
    (name: string) => {
      if (highlights.includes(name)) return 'Dieses Highlight gibt es schon';
      setHighlights((prev) => [...prev, name]);
      schreiben('Das Highlight', (c, ich) => Aktion.profilListe(c, ich, 'highlights', name), () =>
        setHighlights((prev) => prev.filter((h) => h !== name))
      );
      return null;
    },
    [highlights, schreiben]
  );

  const playlistAnlegen = useCallback(
    (name: string) => {
      if (playlists.includes(name)) return 'Diese Playlist gibt es schon';
      setPlaylists((prev) => [...prev, name]);
      schreiben('Die Playlist', (c, ich) => Aktion.profilListe(c, ich, 'playlists', name), () =>
        setPlaylists((prev) => prev.filter((p) => p !== name))
      );
      return null;
    },
    [playlists, schreiben]
  );

  /*
   * Das Spendenziel wurde beim Laden aus der Datenbank geholt (siehe oben,
   * setSpende(daten.spende)) — aber nie hineingeschrieben. Wer es in der App
   * setzte, sah es bis zum naechsten Start und danach nie wieder.
   */
  const spendeSetzen = useCallback(
    (neu: Spende) => {
      const vorher = spende;
      setSpende(neu);
      schreiben('Das Spendenziel', (c, ich) => Aktion.spendeSetzen(c, ich, neu as any), () =>
        setSpende(vorher)
      );
    },
    [spende, schreiben]
  );

  const aufzeichnungAnlegen = useCallback((sekunden: number, zuschauer: number) => {
    const id = `q_${nummer()}`;
    setClips((prev) => [
      {
        id,
        userId: 'me',
        title: 'Livestream-Aufzeichnung',
        duration: `${zweistellig(Math.floor(sekunden / 60))}:${zweistellig(sekunden % 60)}`,
        views: zuschauer,
        age: 'gerade eben',
        // Die Aufzeichnung ist ein normales Video, kein laufender Stream -
        // sie gehoert unter "Standard", nicht unter "Live".
        art: 'standard',
      },
      ...prev,
    ]);
    setRaster((prev) => [{ id, kind: 'video', eigen: true }, ...prev]);
  }, []);

  /** Die angelegte Community in die Datenbank bringen und die Kennung nachziehen. */
  const inDatenbankCommunity = useCallback(
    (vorlaeufig: string, name: string, thema: string) => {
      if (!supabase || !daten.ichId) return;
      Aktion.communityAnlegen(supabase, daten.ichId, name, thema || '', true)
        .then((echt) =>
          setCommunities((prev) =>
            prev.map((c) =>
              c.id === vorlaeufig
                ? {
                    ...c,
                    id: echt,
                    unterthemen: (c.unterthemen ?? []).map((u) => ({
                      ...u,
                      id: `${echt}-allgemein`,
                    })),
                  }
                : c
            )
          )
        )
        .catch((e: any) => {
          console.error('Community anlegen fehlgeschlagen:', e?.message ?? e);
          setCommunities((prev) => prev.filter((c) => c.id !== vorlaeufig));
        });
    },
    [supabase, daten.ichId]
  );

  const kanalAnlegen = useCallback(
    (name: string, thema: string) => {
      if (communities.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return 'Diesen Kanal gibt es schon';
      }
      const vorlaeufig = `k${Date.now()}`;
      setCommunities((prev) => [
        {
          id: vorlaeufig,
          name,
          topic: thema || 'Ohne Beschreibung',
          members: 1,
          visibility: 'private',
          joined: true,
          unreadCount: 0,
          // Selbst angelegt: sie laesst sich nicht verlassen, und sie faengt
          // mit dem einen Unterthema an, das jede Community hat.
          eigen: true,
          bio: thema || '',
          link: '',
          unterthemen: [{ id: `${vorlaeufig}-allgemein`, name: 'Allgemein', themen: [] }],
        },
        ...prev,
      ]);

      /*
       * Und wirklich anlegen. Vorher lebte eine selbst angelegte Community
       * nur in diesem Zustand: nach dem naechsten Start war sie weg, und
       * niemand sonst konnte ihr beitreten.
       */
      inDatenbankCommunity(vorlaeufig, name, thema);
      return null;
    },
    [communities, inDatenbankCommunity]
  );

  /*
   * Ein Unterthema in einer Community anlegen.
   * Prototyp-Frame "CH + Unterthema erstellen" - auf der Community-Seite gab
   * es dafuer bis zum 26.08.2026 keinen Weg.
   */

  const kanalEntfernenNachName = useCallback((name: string) => {
    setCommunities((prev) => prev.filter((c) => c.name.toLowerCase() !== name.toLowerCase()));
  }, []);
  const unterthemaAnlegen = useCallback((communityId: string, name: string) => {
    const sauber = name.trim();
    if (!sauber) return 'Bitte einen Namen eingeben';

    const community = communities.find((c) => c.id === communityId);
    if (!community) return 'Diese Community gibt es nicht mehr';
    if ((community.unterthemen ?? []).some((u) => u.name.toLowerCase() === sauber.toLowerCase())) {
      return 'Dieses Unterthema gibt es schon';
    }

    const vorlaeufig = `${communityId}-${Date.now()}`;
    setCommunities((prev) =>
      prev.map((c) =>
        c.id === communityId
          ? {
              ...c,
              unterthemen: [...(c.unterthemen ?? []), { id: vorlaeufig, name: sauber, themen: [] }],
            }
          : c
      )
    );

    /*
     * Und wirklich anlegen. Vorher stand das Unterthema nur hier: es tauchte
     * auf der Website nie auf, und in der App war es nach dem naechsten Start
     * wieder verschwunden. Die Kennung aus der Datenbank wird nachgezogen —
     * unter der vorlaeufigen liesse sich spaeter nichts hineinschreiben.
     */
    if (supabase && daten.ichId) {
      Aktion.kanalAnlegen(supabase, daten.ichId, communityId, sauber)
        .then((echt) =>
          setCommunities((prev) =>
            prev.map((c) =>
              c.id === communityId
                ? {
                    ...c,
                    unterthemen: (c.unterthemen ?? []).map((u) =>
                      u.id === vorlaeufig ? { ...u, id: echt } : u
                    ),
                  }
                : c
            )
          )
        )
        .catch((e: any) => {
          console.error('Das Unterthema anlegen fehlgeschlagen:', e?.message ?? e);
          setCommunities((prev) =>
            prev.map((c) =>
              c.id === communityId
                ? { ...c, unterthemen: (c.unterthemen ?? []).filter((u) => u.id !== vorlaeufig) }
                : c
            )
          );
        });
    }
    return null;
  }, [communities, supabase, daten.ichId]);

  const kanalBeitreten = useCallback(
    (id: string) => {
      const drehen = () =>
        setCommunities((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, joined: !c.joined, members: c.members + (c.joined ? -1 : 1) } : c
          )
        );

      drehen();
      // Und in die Datenbank — sonst ist man nach dem naechsten Start wieder
      // draussen, und die Website sieht den Beitritt nie.
      schreiben('Der Beitritt', (c, ich) => Aktion.communityBeitritt(c, ich, id), drehen);
    },
    [schreiben]
  );

  const clipUmschalten = useCallback(
    (id: string, was: 'like' | 'save' | 'repost') => {
      const drehen = () =>
        setClips((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            if (was === 'like') {
              const jetzt = !c.liked;
              return { ...c, liked: jetzt, likes: Math.max(0, (c.likes ?? 0) + (jetzt ? 1 : -1)) };
            }
            if (was === 'save') return { ...c, saved: !c.saved };
            return { ...c, reposted: !c.reposted };
          })
        );

      drehen();

      // Dasselbe noch einmal umschalten stellt den alten Stand wieder her.
      const tun =
        was === 'like'
          ? Aktion.like
          : was === 'save'
            ? Aktion.speichern
            : Aktion.repost;
      schreiben(was === 'like' ? 'Das Like' : was === 'save' ? 'Das Speichern' : 'Der Repost',
        (c, ich) => tun(c, ich, id), drehen);
    },
    [schreiben]
  );

  /** Umschalten. Gibt zurueck, was danach gilt. */
  const umschalter = (liste: string[], setzen: (f: (p: string[]) => string[]) => void) => (id: string) => {
    const danach = !liste.includes(id);
    setzen((prev) => (danach ? [...prev, id] : prev.filter((x) => x !== id)));
    return danach;
  };

  /*
   * Sterne an Nachrichten und Lieblingskontakte wurden aus der Datenbank
   * gelesen (lib/daten.ts, ladeEigeneListen), aber nie hineingeschrieben.
   * Ein gesetzter Stern war nach dem naechsten Start wieder weg — und weil
   * er beim Laden aus der Datenbank kam, sah es aus, als haette die App ihn
   * "vergessen".
   */
  /*
   * Der Rueckweg wird ausgeschrieben, statt umschalter() ein zweites Mal
   * aufzurufen: das liest `liste` aus der Umgebung von vorhin und wuerde
   * denselben Zustand noch einmal setzen, statt ihn umzudrehen.
   */
  const mitRueckweg = (
    liste: string[],
    setzen: (f: (p: string[]) => string[]) => void,
    was: string,
    tun: (c: any, ich: string, id: string) => Promise<unknown>
  ) => (id: string) => {
    const drin = liste.includes(id);
    setzen((prev) => (drin ? prev.filter((x) => x !== id) : [...prev, id]));
    schreiben(was, (c, ich) => tun(c, ich, id), () =>
      setzen((prev) => (drin ? [...prev, id] : prev.filter((x) => x !== id)))
    );
    return !drin;
  };

  const markieren = useCallback(
    mitRueckweg(markierte, setMarkierte, 'Der Stern', Aktion.nachrichtMarkieren),
    [markierte, schreiben]
  );

  const favoritUmschalten = useCallback(
    mitRueckweg(favoriten, setFavoriten, 'Der Lieblingskontakt', Aktion.kontaktFavorit),
    [favoriten, schreiben]
  );
  /*
   * Stumm und Geleert gehoeren an chat_members — pro Mitglied, nicht pro
   * Chat. Beides lief in der App nur in der Anzeige: der stummgeschaltete
   * Chat klingelte nach dem Neustart wieder, der geleerte war wieder voll.
   * Die Website macht es in handleChatAction und handleClearChat.
   */
  const chatStummUmschalten = useCallback(
    mitRueckweg(chatStumm, setChatStumm, 'Das Stummschalten', (c, ich, id) =>
      Aktion.chatEinstellung(c, ich, id, 'stumm')
    ),
    [chatStumm, schreiben]
  );

  const chatLeeren = useCallback(
    (chatId: string) => {
      setGeleerteChats((prev) => (prev.includes(chatId) ? prev : [...prev, chatId]));
      schreiben('Das Leeren', (c, ich) => Aktion.chatLeeren(c, ich, chatId), () =>
        setGeleerteChats((prev) => prev.filter((id) => id !== chatId))
      );
    },
    [schreiben]
  );

  const istStumm = useCallback((id: string) => stumm.includes(id), [stumm]);
  const istBlockiert = useCallback((id: string) => blockiert.includes(id), [blockiert]);
  const meldeGrund = useCallback((id: string) => gemeldet[id], [gemeldet]);

  const stummSchalten = useCallback(
    (id: string) => {
      const danach = !stumm.includes(id);
      setStumm((prev) => (danach ? [...prev, id] : prev.filter((x) => x !== id)));
      schreiben('Das Stummschalten', (c, ich) => Aktion.stummschalten(c, ich, id), () =>
        setStumm((prev) => (danach ? prev.filter((x) => x !== id) : [...prev, id]))
      );
      return danach;
    },
    [stumm, schreiben]
  );

  const blockieren = useCallback(
    (id: string) => {
      const danach = !blockiert.includes(id);
      setBlockiert((prev) => (danach ? [...prev, id] : prev.filter((x) => x !== id)));

      /*
       * Eine Blockierung, die nur hier steht, ist nach dem naechsten Start
       * der App wieder weg — und die Person kann einem weiter schreiben,
       * ohne dass man es ahnt. Deshalb geht sie in die Datenbank.
       */
      schreiben('Das Blockieren', (c, ich) => Aktion.blockieren(c, ich, id), () =>
        setBlockiert((prev) => (danach ? prev.filter((x) => x !== id) : [...prev, id]))
      );
      return danach;
    },
    [blockiert, schreiben]
  );

  const melden = useCallback(
    (id: string, grund: string) => {
      setGemeldet((prev) => ({ ...prev, [id]: grund }));
      // Eine Meldung nimmt man nicht zurueck — es gibt hier keinen Rueckweg,
      // ausser dem Vermerk, dass gemeldet wurde.
      /*
       * Gemeldet wird hier immer eine Person: alle drei Aufrufer
       * (ContactProfileScreen, ProfilOptionenSheet, StoryOptionenSheet)
       * uebergeben eine Nutzerkennung. Stuende hier 'post', wiese die
       * Datenbank die Zeile ab — target_id waere dann gar keine Beitrags-
       * kennung.
       */
      schreiben('Das Melden', (c, ich) => Aktion.melden(c, ich, id, grund, 'user'), () =>
        setGemeldet((prev) => {
          const ohne = { ...prev };
          delete ohne[id];
          return ohne;
        })
      );
    },
    [schreiben]
  );

  const geteilt = useCallback((id: string) => {
    setGeteiltZaehler((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const kanalGelesen = useCallback((id: string) => {
    setCommunities((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }, []);

  const wert = useMemo<ProfilWert>(
    () => ({
      mitteilungen,
      ungelesen,
      alsGelesen,
      alleGelesen,
      eigeneBeitraege,
      eigeneVideos,
      clips,
      highlights,
      playlists,
      spende,
      raster,
      beitragAnlegen,
      videoAnlegen,
      highlightAnlegen,
      playlistAnlegen,
      spendeSetzen,
      aufzeichnungAnlegen,
      clipUmschalten,
      markierte,
      markieren,
      favoriten,
      favoritUmschalten,
      chatStumm,
      chatStummUmschalten,
      geleerteChats,
      chatLeeren,
      istStumm,
      istBlockiert,
      meldeGrund,
      stummSchalten,
      blockieren,
      melden,
      geteiltZaehler,
      geteilt,
      communities,
      kanalAnlegen,
      kanalEntfernenNachName,
      unterthemaAnlegen,
      kanalBeitreten,
      kanalGelesen,
      gefolgt,
      folgtPerson,
      folgenUmschalten,
      eigenesProfil,
      profilSpeichern,
    }),
    [
      mitteilungen, ungelesen, alsGelesen, alleGelesen,
      eigeneBeitraege, eigeneVideos, clips, highlights, playlists, spende, raster,
      beitragAnlegen, videoAnlegen, highlightAnlegen, playlistAnlegen, spendeSetzen,
      aufzeichnungAnlegen, clipUmschalten, markierte, markieren, favoriten, favoritUmschalten,
      chatStumm, chatStummUmschalten, geleerteChats, chatLeeren, istStumm, istBlockiert, meldeGrund, stummSchalten, blockieren, melden, geteiltZaehler, geteilt, communities, kanalAnlegen, unterthemaAnlegen, kanalBeitreten, kanalGelesen,
      gefolgt, folgtPerson, folgenUmschalten, eigenesProfil, profilSpeichern,
    ]
  );

  return <ProfilContext.Provider value={wert}>{children}</ProfilContext.Provider>;
};
