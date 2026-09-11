/**
 * Typen zu qr.js — damit die App die gemeinsame Schreibweise mit TypeScript
 * benutzt, ohne dass die Datei selbst uebersetzt werden muss.
 */
export const PRAEFIX: string;
/** Was in den eigenen QR-Code geschrieben wird: "allmedia:<Nummer>". */
export function link(nummer: string): string;
/** Die Nummer aus einem gelesenen Code, oder null wenn es keiner von uns ist. */
export function nummerAus(text: string): string | null;
