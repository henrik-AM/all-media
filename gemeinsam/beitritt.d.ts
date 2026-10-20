/** Typen zu beitritt.js — Mitgliederliste und Beitritt (Kästen 28/9 und 15, Schema 97). */

export interface BeitrittCommunity {
  visibility?: 'public' | 'private' | string;
  eigen?: boolean;
  joined?: boolean;
  angefragt?: boolean;
}

export type BeitrittZustand = 'eigen' | 'verlassen' | 'angefragt' | 'anfragen' | 'beitreten';

export const TITEL: string;
export const ANFRAGEN: string;
export const ANNEHMEN: string;
export const ABLEHNEN: string;
export const ERSTELLER: string;
export const DU: string;
export const PRIVAT_HINWEIS: string;
export const PRIVAT_INHALT: string;
export const LEER: string;
export const FEHLT_SCHEMA: string;
export const KNOPF: Record<BeitrittZustand, string>;

export function anzahlText(n: number | null | undefined): string;
export function listeSichtbar(c: BeitrittCommunity | null | undefined): boolean;
export function inhaltSichtbar(c: BeitrittCommunity | null | undefined): boolean;
export function zustand(c: BeitrittCommunity | null | undefined): BeitrittZustand;
export function knopfText(c: BeitrittCommunity | null | undefined): string;
export function suchText(c: BeitrittCommunity | null | undefined): string;
export function meldung(vorher: BeitrittZustand, name?: string): string;
export function ordnen<T extends { id: string; name?: string }>(
  zeilen: readonly T[] | null | undefined,
  erstellerId?: string | null,
  ichId?: string | null
): T[];
export function suchmuster(eingabe: string | null | undefined): string;
export function suchFilter(spalten: readonly string[], eingabe: string | null | undefined): string;
export function fehltSchema(fehler: { code?: string; message?: string } | null | undefined): boolean;
