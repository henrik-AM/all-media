import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Clip,
  Community,
  Mitteilung,
  MitteilungAnzeige,
  MitteilungsBereich,
  Post,
  RasterEintrag,
  Spende,
  Video,
} from '../types';
import { mockClips, mockCommunities, mockUsers } from '../mocks';

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

const GRUND_MITTEILUNGEN: Mitteilung[] = [
  { id: 'n1', bereich: 'videos', art: 'like', userId: 'u1', ziel: { art: 'post', id: 'p1' }, minuten: 10, gelesen: false },
  { id: 'n2', bereich: 'videos', art: 'follow', userId: 'u5', ziel: { art: 'profile', id: 'u5' }, minuten: 95, gelesen: false },
  { id: 'n3', bereich: 'videos', art: 'comment', userId: 'u3', ziel: { art: 'post', id: 'p2' }, minuten: 260, gelesen: false },
  { id: 'n4', bereich: 'videos', art: 'repost', userId: 'u4', ziel: { art: 'video', id: 'v1' }, minuten: 1500, gelesen: true },
  { id: 'n5', bereich: 'videos', art: 'mention', userId: 'u2', ziel: { art: 'profile', id: 'u2' }, minuten: 7200, gelesen: true },
  { id: 'n6', bereich: 'videos', art: 'story', userId: 'u6', ziel: { art: 'profile', id: 'u6' }, minuten: 11000, gelesen: true },
  { id: 'n7', bereich: 'videos', art: 'like', userId: 'u3', ziel: { art: 'video', id: 'v2' }, minuten: 30000, gelesen: true },
  { id: 'n8', bereich: 'videos', art: 'follow', userId: 'u7', ziel: { art: 'profile', id: 'u7' }, minuten: 46000, gelesen: true },

  { id: 'c1', bereich: 'communities', art: 'kanal', userId: 'u2', ziel: { art: 'community', id: 'k1' }, minuten: 25, gelesen: false },
  { id: 'c2', bereich: 'communities', art: 'beitritt', userId: 'u5', ziel: { art: 'community', id: 'k2' }, minuten: 180, gelesen: false },
  { id: 'c3', bereich: 'communities', art: 'nachricht', userId: 'u1', ziel: { art: 'community', id: 'k1' }, minuten: 1400, gelesen: true },
  { id: 'c4', bereich: 'communities', art: 'einladung', userId: 'u4', ziel: { art: 'community', id: 'k3' }, minuten: 6000, gelesen: true },
  { id: 'c5', bereich: 'communities', art: 'beitritt', userId: 'u6', ziel: { art: 'community', id: 'k4' }, minuten: 20000, gelesen: true },
];

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

const mitteilungText = (m: Mitteilung, communities: Community[]) => {
  const name = mockUsers[m.userId]?.name ?? 'Jemand';
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

  beitragAnlegen: (werte: { beschreibung: string; ort: string; mediaUri?: string }) => void;
  videoAnlegen: (werte: NeuesVideo) => void;
  highlightAnlegen: (name: string) => string | null;
  playlistAnlegen: (name: string) => string | null;
  spendeSetzen: (spende: Spende) => void;
  aufzeichnungAnlegen: (sekunden: number, zuschauer: number) => void;

  /* --- Communitys --- */
  communities: Community[];
  kanalAnlegen: (name: string, thema: string) => string | null;
  kanalBeitreten: (id: string) => void;
  /** Beim Oeffnen: die ungelesenen Nachrichten des Kanals auf null setzen. */
  kanalGelesen: (id: string) => void;
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
  const [alle, setAlle] = useState<Mitteilung[]>(GRUND_MITTEILUNGEN);
  const [communities, setCommunities] = useState<Community[]>(mockCommunities);

  const [eigeneBeitraege, setEigeneBeitraege] = useState<Post[]>([]);
  const [eigeneVideos, setEigeneVideos] = useState<Video[]>([]);
  const [clips, setClips] = useState<Clip[]>(mockClips);
  const [highlights, setHighlights] = useState<string[]>(['Projekt']);
  const [playlists, setPlaylists] = useState<string[]>(['Beste Clips', 'Tutorials']);
  const [spende, setSpende] = useState<Spende | null>(null);
  const [raster, setRaster] = useState<RasterEintrag[]>(GRUND_RASTER);

  const mitteilungen = useCallback(
    (bereich: MitteilungsBereich): MitteilungAnzeige[] =>
      alle
        .filter((m) => m.bereich === bereich)
        .sort((a, b) => a.minuten - b.minuten)
        .map((m) => ({
          id: m.id,
          text: mitteilungText(m, communities),
          zeit: zeitText(m.minuten),
          gelesen: m.gelesen,
          ziel: m.ziel,
        })),
    [alle, communities]
  );

  const ungelesen = useCallback(
    (bereich: MitteilungsBereich) => alle.filter((m) => m.bereich === bereich && !m.gelesen).length,
    [alle]
  );

  const alsGelesen = useCallback((id: string) => {
    setAlle((prev) => prev.map((m) => (m.id === id ? { ...m, gelesen: true } : m)));
  }, []);

  const alleGelesen = useCallback((bereich: MitteilungsBereich) => {
    setAlle((prev) => prev.map((m) => (m.bereich === bereich ? { ...m, gelesen: true } : m)));
  }, []);

  const nummer = () => `e${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const beitragAnlegen: ProfilWert['beitragAnlegen'] = useCallback(({ beschreibung, ort, mediaUri }) => {
    const id = `p_${nummer()}`;
    setEigeneBeitraege((prev) => [
      {
        id,
        userId: 'me',
        location: ort || 'Ohne Ort',
        music: 'Originalton',
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
  }, []);

  const videoAnlegen: ProfilWert['videoAnlegen'] = useCallback(({ beschreibung, ort, quer, mediaUri }) => {
    const id = quer ? `q_${nummer()}` : `v_${nummer()}`;

    if (quer) {
      setClips((prev) => [
        { id, userId: 'me', title: beschreibung, duration: '00:15', views: 0, age: 'gerade eben' },
        ...prev,
      ]);
    } else {
      setEigeneVideos((prev) => [
        {
          id,
          userId: 'me',
          description: beschreibung,
          location: ort || 'Ohne Ort',
          music: 'Originalton',
          likes: 0,
          comments: 0,
          shares: 0,
          liked: false,
          saved: false,
          reposted: false,
          mediaUri,
        },
        ...prev,
      ]);
    }
    setRaster((prev) => [{ id, kind: 'video', eigen: true, mediaUri }, ...prev]);
  }, []);

  /** Gibt einen Fehlertext zurueck, wenn es nicht geklappt hat - sonst null. */
  const highlightAnlegen = useCallback(
    (name: string) => {
      if (highlights.includes(name)) return 'Dieses Highlight gibt es schon';
      setHighlights((prev) => [...prev, name]);
      return null;
    },
    [highlights]
  );

  const playlistAnlegen = useCallback(
    (name: string) => {
      if (playlists.includes(name)) return 'Diese Playlist gibt es schon';
      setPlaylists((prev) => [...prev, name]);
      return null;
    },
    [playlists]
  );

  const spendeSetzen = useCallback((neu: Spende) => setSpende(neu), []);

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
      },
      ...prev,
    ]);
    setRaster((prev) => [{ id, kind: 'video', eigen: true }, ...prev]);
  }, []);

  const kanalAnlegen = useCallback(
    (name: string, thema: string) => {
      if (communities.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return 'Diesen Kanal gibt es schon';
      }
      setCommunities((prev) => [
        {
          id: `k${Date.now()}`,
          name,
          topic: thema || 'Ohne Beschreibung',
          members: 1,
          visibility: 'private',
          joined: true,
          unreadCount: 0,
        },
        ...prev,
      ]);
      return null;
    },
    [communities]
  );

  const kanalBeitreten = useCallback((id: string) => {
    setCommunities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, joined: !c.joined, members: c.members + (c.joined ? -1 : 1) } : c))
    );
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
      communities,
      kanalAnlegen,
      kanalBeitreten,
      kanalGelesen,
    }),
    [
      mitteilungen, ungelesen, alsGelesen, alleGelesen,
      eigeneBeitraege, eigeneVideos, clips, highlights, playlists, spende, raster,
      beitragAnlegen, videoAnlegen, highlightAnlegen, playlistAnlegen, spendeSetzen,
      aufzeichnungAnlegen, communities, kanalAnlegen, kanalBeitreten, kanalGelesen,
    ]
  );

  return <ProfilContext.Provider value={wert}>{children}</ProfilContext.Provider>;
};
