/** Typen zu markierung.js — @-Markierungen (Kasten 25) für App und Website. */

export interface MarkierungTreffer {
  /** Der Name klein und ohne @ („anna"). */
  handle: string;
  /** Wie im Text geschrieben, mit @ („@Anna"). */
  text: string;
  start: number;
  /** Exklusiv. */
  ende: number;
}

export type MarkierungStueck =
  | { art: 'text'; text: string }
  | { art: 'markierung'; text: string; handle: string };

export interface MarkierungWort {
  /** Position des @. */
  start: number;
  /** Ende des Wortes, auch hinter dem Cursor. */
  ende: number;
  /** Bisher Getipptes ohne @, klein; darf leer sein. */
  suche: string;
}

/** Eine Zeile aus `markierung_vorschlaege()`. */
export interface MarkierungVorschlag {
  id: string;
  name: string;
  /** Mit @, wie in profiles.handle. */
  handle: string;
  avatar_url?: string | null;
  color?: string | null;
  rang: 'mitglied' | 'nah' | 'suche';
}

export const HOECHSTENS: number;
export const MUSTER_QUELLE: string;
export function gueltig(name: string): boolean;
export function normal(eingabe: string): string;
export function finden(text: string): MarkierungTreffer[];
export function handles(text: string): string[];
export function stuecke(
  text: string,
  bekannt?: ((handle: string) => boolean) | Set<string> | Record<string, unknown>
): MarkierungStueck[];
export function aktuellesWort(text: string, cursor?: number): MarkierungWort | null;
export function einsetzen(text: string, cursor: number | undefined, handle: string): { text: string; cursor: number };
export function vorschlaegeOrdnen<T extends { id: string; name?: string; handle: string; rang?: string }>(
  liste: T[],
  suche?: string
): T[];
export function markierteMitglieder(
  text: string,
  mitglieder: { id: string; handle?: string }[],
  ichId?: string
): string[];
