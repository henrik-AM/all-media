/**
 * Typen zu kommentar.js — damit die App die gemeinsame Rechnung mit
 * TypeScript benutzt, ohne dass die Datei selbst uebersetzt werden muss.
 */
export const ART: Record<string, string>;
/** Wo der Kommentar steht: Titel, sonst Beschreibung, sonst die Art. */
export function beitragsName(beitrag: {
  kind?: string;
  title?: string | null;
  description?: string | null;
}): string;
/** Die fertige Zeile: `„Kommentar" · Beitrag`. */
export function zeile(kommentar: { text: string; beitrag: string }): string;

/* Antworten auf Kommentare (Nachtrag 4.3b, 11.10.2026) */

/** Was ein Kommentar für die Fäden mitbringen muss. */
export interface FadenKommentar {
  id: string;
  /** Die Wurzel, an der diese Antwort hängt (comments.reply_to). */
  antwortAuf?: string | null;
}
/** Die Wurzel, an die eine Antwort auf `k` gehängt wird. */
export function wurzelVon(k: FadenKommentar | null | undefined): string | null;
/** Was beim Senden mitgeht. */
export function antwortZiel(
  k: FadenKommentar | null | undefined
): { antwortAuf: string | null; antwortAn: string } | null;
/** „@name " — leer beim eigenen Kommentar oder ohne Benutzernamen. */
export function vorbelegung(handle: string | null | undefined, eigen?: boolean): string;
/** Wurzeln mit ihren Antworten; verwaiste Antworten stehen oben. */
export function faeden<T extends FadenKommentar>(liste: T[]): { kommentar: T; antworten: T[] }[];
/** „N Antworten ansehen" / „Antworten ausblenden" / leer. */
export function klappText(anzahl: number, offen: boolean): string;
/** „Antwort an Name". */
export function leistenText(name?: string | null): string;
export const PLATZHALTER_ANTWORT: string;
export const OHNE_FADEN: string;
/** „Name hat auf deinen Kommentar geantwortet." */
export function mitteilungAntwort(name?: string | null): string;
/** Fehlt reply_to/antwort_an noch (42703/PGRST204)? */
export function fehltSpalte(fehler: { code?: string; message?: string } | null | undefined): boolean;
