/** Typen zu benutzername.js. */
export const REGEL_TEXT: string;
/** Wie handle_normal in der Datenbank: ohne @, klein, beschnitten. */
export function normal(eingabe: string): string;
/** Gibt null zurueck, wenn die Form passt, sonst den Grund auf Deutsch. */
export function pruefe(eingabe: string): string | null;
