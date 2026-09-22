/** Typen zu gemeinsam/alter.js. */
export type AlterZeile = [string, string, number, number | null, string];

export interface Altersgrenze {
  land: string;
  vorwahl: string;
  mindestalter: number;
  untergrenze: number | null;
  name: string;
}

export interface Einordnung {
  iso: string;
  alter: number | null;
  grenze: Altersgrenze;
  stufe: 'frei' | 'eltern' | 'verboten';
}

export const GRENZEN: AlterZeile[];
export const UNBEKANNT: AlterZeile;
export const VOLLJAEHRIG: number;
export const HOECHSTALTER: number;
export const REGEL_TEXT: string;
export function grenzeFuer(telefon: string): Altersgrenze;
export function lesen(eingabe: string): string;
export function alterAm(iso: string, heute?: Date): number;
export function pruefe(eingabe: string): string | null;
export function einordnen(geburtsdatum: string, telefon: string, heute?: Date): Einordnung;
export function hinweis(einordnung: Einordnung): string;
