/**
 * Typen zu chatblase.js — Ziehen zum Antworten und die Karte eines geteilten
 * Beitrags, gemeinsam mit der Website (Feedback 28.09., Kasten 4 und 7).
 */
export const ZIEH_SCHWELLE: number;
export const ZIEH_MAX: number;
export const ZIEH_START: number;
export function istZug(dx: number, dy: number): boolean;
export function zugWeg(dx: number): number;
export function ausgeloest(dx: number): boolean;
export function pfeilSichtbar(dx: number): number;

export const BEZUG_WEG: string;
export interface Bezug {
  id: string;
  text: string;
  autor: string;
  /** Das Original ist nicht unter den geladenen Nachrichten. */
  fehlt?: boolean;
}
export function kanalBezug(
  zeile: { reply_to?: string | null } | null | undefined,
  alle: { id: string; sender_id: string; text?: string | null; media_type?: string | null }[] | null | undefined,
  ichId: string,
  namen: Record<string, string> | null | undefined
): Bezug | undefined;

export function fehltSpalte(fehler: { code?: string; message?: string } | null | undefined, spalte?: string): boolean;
export const OHNE_BEZUG: string;

export const GETEILT_WEG: string;
export interface GeteilteKarte {
  id: string;
  /** Beitrag ist gelöscht oder nicht sichtbar — dann fehlen alle anderen Felder. */
  weg?: boolean;
  kind?: 'post' | 'reel' | 'clip';
  art?: 'post' | 'video';
  autor?: string;
  handle?: string;
  titel?: string;
  beschreibung?: string;
  bild?: string;
}
export function geteiltAus(sharedPostId: string | null | undefined, post: any): GeteilteKarte | undefined;
export function geteiltBeschriftung(g: GeteilteKarte | null | undefined): string;
