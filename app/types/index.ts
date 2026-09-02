export type PresenceStatus = 'online' | 'away' | 'offline';
export type ContactStatus = 'friend' | 'pending' | 'blocked';
/*
 * Was in einer Nachricht haengen kann.
 *
 * 'gif', 'sticker' und 'file' kamen am 01.09.2026 dazu — alle drei stehen im
 * Handbuch. Sie sind bewusst eigene Typen und keine Bilder: ein Gif darf
 * nicht mit einem Abspielknopf erscheinen, ein Sticker nicht in einer Blase,
 * und eine Datei braucht Name und Groesse statt einer Vorschau.
 */
export type MediaType = 'image' | 'video' | 'audio' | 'gif' | 'sticker' | 'file';

export interface User {
  id: string;
  name: string;
  handle: string;
  status: PresenceStatus;
  about?: string;
  /** Fuer das Finden ueber die Telefonnummer statt ueber den Benutzernamen. */
  phone?: string;
  /**
   * Die Avatarfarbe aus der Datenbank, als CSS-Verlauf
   * ("linear-gradient(135deg,#FCA2BC,#E04570)").
   *
   * Sie gehoert zur Person, nicht zur Plattform: die Website las sie schon
   * immer aus `profiles.color`, die App wuerfelte sie aus der Kennung. Anna
   * war deshalb im Browser rosa und in der App blau.
   */
  color?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  time: string;
  media?: MediaType;
  read?: boolean;
  /** Weitergeleiteter Beitrag oder weitergeleitetes Video. */
  geteilt?: { art: 'post' | 'video'; id: string; titel: string; autor: string };
  /** Anhang aus dem Plus in der Nachrichtenzeile. */
  bildUri?: string;
  standort?: { name: string; adresse?: string; koordinaten?: string; x?: number; y?: number };
  kontakt?: { id: string; name: string; handle: string };
  /** Story-Anhang (fixiert - nur horizontal swipeable). */
  story?: { id: string; userId: string; mediaUri?: string };

  /*
   * Die Nachrichten-Werkzeuge aus dem Handbuch, nachgetragen am 01.09.2026.
   *
   * `antwortAuf` und `zitat` sind absichtlich getrennt: eine Antwort zeigt
   * nur den Bezug an, ein Zitat nimmt den Text mit in die eigene Nachricht.
   * Auf einer gemeinsamen Spalte liessen sie sich in der Anzeige nicht mehr
   * auseinanderhalten.
   */
  antwortAuf?: { id: string; text: string; autor: string };
  zitat?: { id: string; text: string; autor: string };
  /** Name dessen, von dem sie urspruenglich stammt. */
  weitergeleitetVon?: string;
  /** Gesetzt, sobald der Text geaendert wurde — die Blase sagt "bearbeitet". */
  bearbeitet?: boolean;
  /** Zurueckgenommen. Die Zeile bleibt, damit Antworten ihren Bezug behalten. */
  zurueckgenommen?: boolean;
  /** Emoji je Person, die reagiert hat. */
  reaktionen?: { userId: string; emoji: string }[];
  /** Bei einer Datei: Name und Groesse, sonst steht dort ein graues Kaestchen. */
  datei?: { name: string; groesse: number };
}

/**
 * Ein Insight — das Snapchat-Aequivalent aus dem Handbuch.
 *
 * Nicht zu verwechseln mit den "Insights" im Einstellungsmenue: das ist
 * Statistik zum eigenen Profil. Ein Insight hier ist eine Aufnahme, die an
 * ausgewaehlte Personen geht und fuer die Insight Time zaehlt.
 */
export interface Insight {
  id: string;
  senderId: string;
  mediaUrl: string;
  mediaTyp: 'image' | 'video';
  filter: string;
  /** Anzeigedauer in Sekunden; 0 heisst unbegrenzt ansehen. */
  dauer: number;
  einmal: boolean;
  gespeichert: boolean;
  zeit: string;
  /** Nur bei empfangenen: schon geoeffnet? */
  gesehen?: boolean;
}

/** Die Insight Time zu einer Person: Tage in Folge. */
export interface InsightStreak {
  userId: string;
  tage: number;
  /** Habe ich heute schon einen geschickt? */
  heuteGesendet: boolean;
  /** Hat die Gegenseite heute schon? Erst wenn beides stimmt, zaehlt der Tag. */
  heuteEmpfangen: boolean;
}

/** Eine Umfrage an einem Beitrag, einer Story oder in einem Kanal. */
export interface Umfrage {
  id: string;
  frage: string;
  mehrfach: boolean;
  endeAt?: string | null;
  beendet: boolean;
  antworten: { id: string; text: string; stimmen: number; gewaehlt: boolean }[];
  gesamt: number;
}

/** Eine Sichtbarkeitsstufe mit ihrer Ausnahmeliste. */
export interface Sichtbarkeit {
  stufe: 'niemand' | 'niemand_bis_auf' | 'alle_bis_auf' | 'alle';
  ausnahmen: string[];
}

export interface Chat {
  id: string;
  name: string;
  /** Undefined for group chats. */
  userId?: string;
  isGroup: boolean;
  memberIds?: string[];
  preview: string;
  previewMedia?: MediaType;
  time: string;
  unreadCount: number;
  muted?: boolean;
  /*
   * Archiviert und Favorit stehen in chat_members — pro Mitglied, nicht pro
   * Chat. lib/daten.ts liest beides seit jeher; benutzt wurde es in der App
   * bis zum 01.09.2026 nicht, weil es hier fehlte.
   */
  archiviert?: boolean;
  favorit?: boolean;
  /**
   * 'pending' = Kontaktanfrage laeuft noch. Bis zur Annahme ist genau eine
   * Nachricht erlaubt, danach ist das Eingabefeld gesperrt.
   */
  requestState?: 'pending' | 'accepted';
}

export interface Contact {
  id: string;
  name: string;
  status: ContactStatus;
  about: string;
  phone?: string;
}

export interface Profile {
  userId: string;
  bio: string;
  link: string;
  posts: number;
  followers: number;
  following: number;
  isFollowing: boolean;
  highlights: string[];
  /** Nur beim eigenen Profil gefüllt (Prototyp „VP + Playlists"). */
  playlists?: string[];
  /** Laufende Spendenaktion — nur beim eigenen Profil gefüllt. */
  spende?: Spende | null;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  time: string;
  likes: number;
  liked: boolean;
}

export interface Post {
  id: string;
  userId: string;
  location: string;
  music: string;
  description: string;
  likedBy: string;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
  following: boolean;
  notify: boolean;
  /** Wie oft der Beitrag geteilt wurde, und ob man selbst dabei ist. */
  reposts: number;
  reposted: boolean;
  /** Selbst aufgenommen: die Datei, die statt des Platzhalters gezeigt wird. */
  mediaUri?: string;
  /**
   * Standbild zum Video. Solange `mediaUri` ein Bild war, gab es dafuer
   * keinen Grund; jetzt liegt dort eine .mp4, und das Raster braucht etwas
   * zum Anzeigen, bevor der Abspieler das erste Bild hat.
   */
  standbild?: string;
  /** Fuer die Hashtag-Seite. */
  tags?: string[];
}

export interface Video {
  id: string;
  userId: string;
  description: string;
  location: string;
  music: string;
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  notify: boolean;
  /** Selbst aufgenommen: Standbild oder Datei fuer die Vorschau. */
  mediaUri?: string;
  /**
   * Standbild zum Video. Solange `mediaUri` ein Bild war, gab es dafuer
   * keinen Grund; jetzt liegt dort eine .mp4, und das Raster braucht etwas
   * zum Anzeigen, bevor der Abspieler das erste Bild hat.
   */
  standbild?: string;
  /** Fuer die Hashtag-Seite. */
  tags?: string[];
}

/** Ein Unterthema (Kanal) innerhalb einer Community. */
export interface Unterthema {
  id: string;
  name: string;
  /** Worueber dort gesprochen wird - steht als zweite Zeile in der Liste. */
  themen: string[];
}

export interface Community {
  id: string;
  name: string;
  topic: string;
  members: number;
  visibility: 'public' | 'private';
  joined: boolean;
  unreadCount: number;
  /*
   * Ab hier: was der Prototyp-Frame "CH + Kanal" auf der Community-Seite
   * verlangt. Bis zum 26.08.2026 gab es diese Seite in der App gar nicht -
   * eine Community oeffnete direkt einen Chat.
   */
  bio?: string;
  link?: string;
  /** Selbst angelegt. Eine eigene Community laesst sich nicht verlassen. */
  eigen?: boolean;
  unterthemen?: Unterthema[];
}

export interface Story {
  id: string;
  userId: string;
  name: string;
  viewed: boolean;
  own?: boolean;
  liked?: boolean;
  caption?: string;
  /**
   * Bei der eigenen Story: die aufgenommene Datei. Solange leer, fuehrt ein
   * Tippen zur Kamera; sobald gefuellt, oeffnet sich der Betrachter.
   */
  mediaUri?: string;
  /** Wann sie aufgenommen wurde - fuer "vor 3 Min." im Betrachter. */
  aufgenommen?: number;
}

/** Querformat-Video aus dem Prototyp-Frame "Videos - Querformat". */
/**
 * Art eines Querformat-Videos. Sie traegt die Filterleiste im Querformat
 * ("Alle | Standard | 360° | Live"): ohne dieses Feld zeigten alle vier
 * Knoepfe dieselbe Liste, weil es nichts zu unterscheiden gab.
 */
export type ClipArt = 'standard' | '360' | 'live';

export interface Clip {
  id: string;
  userId: string;
  title: string;
  duration: string;
  views: number;
  age: string;
  /** Fehlt sie, gilt das Video als 'standard'. */
  art?: ClipArt;
  /** Nur bei art === 'live': wie viele gerade zusehen. */
  zuschauer?: number;
  /*
   * Kapitel eines langen Videos (Prototyp: "Wenn Video in Kapitel aufgeteilt,
   * anzeigen und direkt dort springen"). `bei` ist die Sekunde, an der das
   * Kapitel anfaengt.
   */
  kapitel?: { bei: number; titel: string }[];
  /** Ob es Untertitel gibt - steht in den Video-Einstellungen zur Wahl. */
  untertitel?: boolean;
  /** Vorschaubild aus der Datenbank. Fehlt es, zeichnet Motiv eine Fläche. */
  mediaUri?: string;
  /**
   * Standbild zum Video. Solange `mediaUri` ein Bild war, gab es dafuer
   * keinen Grund; jetzt liegt dort eine .mp4, und das Raster braucht etwas
   * zum Anzeigen, bevor der Abspieler das erste Bild hat.
   */
  standbild?: string;
  /** Damit Querformat-Videos auf den Explorer-Seiten auftauchen koennen. */
  location?: string;
  music?: string;
  tags?: string[];
  /** Fuer den Querformat-Player (Prototyp-Frame "VQ + Video"). */
  description?: string;
  likes?: number;
  comments?: number;
  liked?: boolean;
  saved?: boolean;
  reposted?: boolean;
}

/** Eintrag der Friend-Map. x/y sind Prozentwerte auf der Kartenflaeche. */
export interface FriendPin {
  id: string;
  x: number;
  y: number;
  place: string;
  when: string;
}

export interface Hashtag {
  tag: string;
  posts: number;
}

export interface Sound {
  id: string;
  title: string;
  artist: string;
  uses: number;
  /** Fuer die Sound-Seite: Laufzeit und der Liedtext. */
  dauer?: string;
  /*
   * Der Liedtext, Zeile fuer Zeile. Leere Eintraege sind Strophenabstaende.
   * null bei Instrumentalstuecken - die Seite sagt das dann auch, statt
   * "Instrumental" als Liedzeile auszugeben.
   *
   * Prototyp-Frame "VSSo + Sound + Lyrics", Henriks Punkt 11.
   */
  lyrics?: string[] | null;
}

export interface Place {
  id: string;
  name: string;
  posts: number;
  /** Verbindet den Standort mit dem location-Feld der Beitraege. */
  ort?: string;
  adresse?: string;
  koordinaten?: string;
  /** Lage der Nadel auf der kleinen Karte, in Prozent. */
  x?: number;
  y?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: User;
}

/**
 * Mitteilung im eigenen Profil - Prototyp-Frames "VP + Mitteilung" und
 * "CP + Mitteilungen". Gespeichert wird nur, was passiert ist; der Satz
 * entsteht erst beim Anzeigen.
 */
export type MitteilungArt =
  | 'like'
  | 'follow'
  | 'comment'
  | 'repost'
  | 'mention'
  | 'story'
  | 'kanal'
  | 'beitritt'
  | 'nachricht'
  | 'einladung';

export type MitteilungsBereich = 'videos' | 'communities';

export interface MitteilungsZiel {
  art: 'post' | 'video' | 'profile' | 'community';
  id: string;
}

export interface Mitteilung {
  id: string;
  bereich: MitteilungsBereich;
  art: MitteilungArt;
  userId: string;
  ziel: MitteilungsZiel;
  /** Wie lange her, in Minuten. Daraus wird "vor 10 min", "vor 3 W" ... */
  minuten: number;
  gelesen: boolean;
}

/** Fertig fuer die Anzeige aufbereitete Mitteilung. */
export interface MitteilungAnzeige {
  id: string;
  text: string;
  zeit: string;
  gelesen: boolean;
  ziel: MitteilungsZiel;
}

/** Spendenaktion aus dem Erstellen-Blatt. */
export interface Spende {
  titel: string;
  ziel: number;
  gesammelt: number;
  text: string;
}

/** Ein Eintrag im eigenen Beitragsraster. */
export interface RasterEintrag {
  id: string;
  kind: 'image' | 'video';
  /** Selbst aufgenommen - dann steht in mediaUri das Bild. */
  eigen?: boolean;
  mediaUri?: string;
  /** Bei einem Video: das Standbild, denn mediaUri ist dann eine .mp4. */
  standbild?: string;
}
