/**
 * Typen zu telefon.js — damit die App die gemeinsame Regel mit TypeScript
 * benutzt, ohne dass die Datei selbst uebersetzt werden muss.
 */
export const MINDESTZIFFERN: number;
export const HOECHSTZIFFERN: number;
export const REGEL_TEXT: string;
/** Wie die Nummer gespeichert wird: wie eingetippt, aussen beschnitten. */
export function speicherform(eingabe: string): string;
/** Die Form, in der zwei Nummern verglichen werden: nur Ziffern. */
export function vergleichsform(eingabe: string): string;
/** Gibt null zurueck, wenn die Nummer passt, sonst den Grund auf Deutsch. */
export function pruefe(eingabe: string): string | null;
