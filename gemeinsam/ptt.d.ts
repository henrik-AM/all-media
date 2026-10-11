/** Typen zu ptt.js — Push to Talk im Unterthema (Kasten 8.5/8.6, Schema 90). */
export const SITZUNG_PAUSE_MIN: number;
export const TITEL: string;
export const LEER: string;
export function datumZeit(zeitpunkt?: string | null): string;
export function uhrzeit(zeitpunkt?: string | null): string;
export function zeile(zeitpunkt?: string | null): string;
export function dauer(sekunden: number): string;
