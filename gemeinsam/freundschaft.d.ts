/** Typen zu freundschaft.js — Befreunden unter Communitys (Kasten 28/15.4, Schema 98). */

export type FreundZustand = 'keine' | 'angefragt' | 'eingegangen' | 'befreundet';

export interface FreundschaftZeile {
  von: string;
  an: string;
  angenommen: boolean;
}

export const FEHLT_SCHEMA: string;

export function ausZeilen(zeilen: FreundschaftZeile[] | null | undefined, ichId: string): Record<string, FreundZustand>;
export function zustand(stand: Record<string, FreundZustand> | null | undefined, id: string): FreundZustand;
export function knopfText(z: FreundZustand, privat?: boolean): string;
export function leise(z: FreundZustand): boolean;
export function tippbar(z: FreundZustand): boolean;
export function schritt(z: FreundZustand): 'anfragen' | 'zurueckziehen' | 'annehmen' | null;
export function meldung(vorher: FreundZustand, nachher: FreundZustand, name?: string): string;
export function fehltSchema(fehler: { code?: string; message?: string } | null | undefined): boolean;
