/** Typen zu anruf.js — der Anrufeintrag im Chat (Kasten 5, Schema 89). */
export type AnrufStatus = 'gestartet' | 'beendet' | 'verpasst' | 'abgelehnt';
export type AnrufDaten = { art: 'audio' | 'video'; status: AnrufStatus; dauer: number };
export const ZUSTAENDE: AnrufStatus[];
export function dauerText(sekunden: number): string;
export function artName(art?: string | null): string;
export function text(anruf: AnrufDaten, opts: { eigen: boolean; gruppe: boolean; name?: string }): string;
export function verpasst(anruf: AnrufDaten, opts: { eigen: boolean; gruppe: boolean }): boolean;
export function vorschau(anruf: { art?: string; anruf_art?: string } | null | undefined): string;
