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
