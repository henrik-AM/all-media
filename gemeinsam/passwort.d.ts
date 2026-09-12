/**
 * Typen zu passwort.js — damit die App die gemeinsame Regel mit TypeScript
 * benutzt, ohne dass die Datei selbst uebersetzt werden muss.
 */
export const MINDESTLAENGE: number;
export const REGEL_TEXT: string;
/** Gibt null zurueck, wenn das Passwort passt, sonst den Grund auf Deutsch. */
export function pruefe(passwort: string): string | null;
/** Der Satz, den ein Nutzer sieht, wenn sein Passwort in einem Leck steht. */
export const GELEAKT_TEXT: string;
/**
 * Steht dieses Passwort in einem bekannten Datenleck (HaveIBeenPwned)?
 *
 * `sha1` muss der Aufrufer stellen — im Browser ueber crypto.subtle, in der
 * App ueber expo-crypto. Das Passwort selbst verlaesst das Geraet nicht.
 */
export function geleakt(passwort: string, sha1: (wert: string) => Promise<string>): Promise<boolean>;
/** Eine englische Meldung aus Supabase auf Deutsch. */
export function uebersetze(meldung: string): string;
