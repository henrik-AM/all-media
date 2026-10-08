/**
 * Typen zu lenkung.js — „Feed steuern" (Kasten 24) für App und Website.
 */

export type LenkungArt = 'hashtag' | 'sound' | 'ort' | 'profil' | 'wort';
export type LenkungRichtung = 'mehr' | 'weniger';

/** Eine Zeile aus `feed_lenkung`. */
export interface LenkungEintrag {
  id?: string;
  art: LenkungArt;
  wert: string;
  anzeige?: string;
  richtung: LenkungRichtung;
  created_at?: string;
}

/** Ein Vorschlag beim Tippen. */
export interface LenkungVorschlag {
  art: LenkungArt;
  wert: string;
  anzeige: string;
  zusatz: string;
}

/** Was ein Beitrag mitbringen muss, damit Einträge ihn treffen können. */
export interface LenkbarerBeitrag {
  id: string;
  user_id?: string;
  userId?: string;
  tags?: string[] | null;
  location?: string | null;
  sound_id?: string | null;
  soundId?: string | null;
  music?: string | null;
  description?: string | null;
  title?: string | null;
}

export interface LenkungQuellen {
  hashtags?: { tag: string; posts?: number }[];
  sounds?: { id: string; title: string; artist?: string; uses?: number }[];
  places?: { name: string; ort?: string; posts?: number }[];
  users?: Record<string, { id: string; name?: string; handle?: string }>;
  beitraege?: { tags?: string[] | null; location?: string | null }[];
  ich?: string | string[];
}

export const MEHR_FAKTOR: number;
export const MEHR_DECKEL: number;
export const WENIGER_FAKTOR: number;
export const PROFIL_WENIGER_FAKTOR: number;
export const BODEN: number;
export const HOECHSTZAHL: number;
export const ARTEN: { key: LenkungArt; label: string; platzhalter: string }[];
export const RICHTUNGEN: LenkungRichtung[];
export const TITEL: string;
export const HINWEIS: string;
export const RESET_TITEL: string;
export const RESET_TEXT: string;
export const KEIN_INTERESSE_TITEL: string;
export const KEIN_INTERESSE_LEER: string;
export const LEER: string;

export function normalisieren(art: string, wert: unknown): string | null;
export function treffer(beitrag: LenkbarerBeitrag, eintrag: LenkungEintrag): boolean;
export function faktor(beitrag: LenkbarerBeitrag, eintraege: readonly LenkungEintrag[]): number;
export function faktoren(
  beitraege: readonly LenkbarerBeitrag[],
  eintraege: readonly LenkungEintrag[] | null | undefined
): Map<string, number>;
export function vorschlaege(
  art: LenkungArt,
  eingabe: string,
  quellen: LenkungQuellen,
  grenze?: number
): LenkungVorschlag[];
export function artName(art: string): string;
export function eintragText(eintrag: LenkungEintrag): string;
export function richtungText(richtung: LenkungRichtung): string;
export function sortiert<T extends LenkungEintrag>(eintraege: readonly T[]): T[];
