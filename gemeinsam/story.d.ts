/**
 * Typen zu story.js — die gemeinsamen Story-Regeln für App und Website.
 */
export interface StorySchrift {
  key: string;
  label: string;
  web: string;
  ios: string;
  android: string;
  gewicht: '400' | '600' | '900';
  kursiv: boolean;
}

export interface StoryText {
  text: string;
  schrift: string;
  farbe: string;
  hintergrund: boolean;
  groesse: number;
  /** relativ zur Bildfläche, 0 bis 1 */
  x: number;
  y: number;
}

export interface StoryMarkierungslage {
  userId: string;
  name: string;
  x: number;
  y: number;
}

export interface StoryOverlays {
  filter: string;
  texte: StoryText[];
  markiert: StoryMarkierungslage[];
}

export interface StoryZiel {
  key: 'messenger' | 'videos' | 'beide';
  label: string;
  inMessenger: boolean;
  inVideos: boolean;
}

export interface StoryEintrag {
  id: string;
  userId: string;
  name: string;
  own?: boolean;
  viewed: boolean;
  liked?: boolean;
  caption?: string;
  mediaUri?: string;
  mediaType?: 'image' | 'video';
  aufgenommen?: string;
  inVideos?: boolean;
  inMessenger?: boolean;
  overlays?: StoryOverlays | null;
  markiert?: { userId: string; name: string }[];
}

export interface StoryRing {
  status: 'neu' | 'gesehen' | 'keiner';
  start: string | null;
  anzahl: number;
}

export const DAUER_BILD: number;
export const DAUER_VIDEO_HOECHSTENS: number;
export const SCHRIFTEN: StorySchrift[];
export const FARBEN: string[];
export const FILTER_SCHLUESSEL: string[];
export const TEXTE_HOECHSTENS: number;
export const TEXT_LAENGE: number;
export const MARKIERUNGEN_HOECHSTENS: number;
export function schriftZu(key?: string | null): StorySchrift;
export function overlaysPruefen(roh: any): StoryOverlays;
export function hatOverlays(o: any): boolean;
export function zielWahl(bereich: 'messenger' | 'videos', darfVideos: boolean): StoryZiel[];
export function listenBilden<T extends StoryEintrag = StoryEintrag>(eingabe: {
  roh: any[];
  ichId: string;
  kontakte?: Set<string>;
  gefolgte?: Set<string>;
  gesehen?: Set<string>;
  gemocht?: Set<string>;
  markierte?: Map<string, { userId: string; name: string }[]>;
  ichKennung?: string;
}): { messenger: T[]; videos: T[]; videosAlle: T[] };
export function ordnen<T extends StoryEintrag>(liste: T[], kennungIch?: string): T[];
export function platzhalter(kennungIch?: string): StoryEintrag;
export function vonPerson<T extends StoryEintrag>(liste: T[] | undefined, userId: string): T[];
export function ringFuer(liste: StoryEintrag[] | undefined, userId: string): StoryRing;
export function ringListe<T extends StoryEintrag>(
  listen: { messenger?: T[]; videos?: T[]; videosAlle?: T[] } | null | undefined,
  bereich: 'messenger' | 'videos'
): T[];
