/**
 * Typen zu passwort.js — damit die App die gemeinsame Regel mit TypeScript
 * benutzt, ohne dass die Datei selbst uebersetzt werden muss.
 */
export const MINDESTLAENGE: number;
export const REGEL_TEXT: string;
/** Gibt null zurueck, wenn das Passwort passt, sonst den Grund auf Deutsch. */
export function pruefe(passwort: string): string | null;
/** Eine englische Meldung aus Supabase auf Deutsch. */
export function uebersetze(meldung: string): string;
