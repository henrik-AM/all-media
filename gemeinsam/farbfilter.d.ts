/**
 * Typen zu farbfilter.js — Farbfilter der Bedienungshilfen, eine Rechnung
 * für App und Website (Kasten 21).
 */

export type FarbfilterArt =
  | 'graustufen'
  | 'protanopie'
  | 'deuteranopie'
  | 'tritanopie'
  | 'warmton'
  | 'farbton';

export interface FarbfilterKonfig {
  an: boolean;
  art: FarbfilterArt;
  /** Intensität 0…100. */
  staerke: number;
  /** Farbton 0…359° (nur Farbtönung). */
  farbton: number;
}

export interface FarbfilterEintrag {
  id: FarbfilterArt;
  name: string;
  /** Ein Satz: wofür der Filter da ist. */
  kurz: string;
  /** Kann die App ihn exakt so rechnen wie die Website? */
  appExakt: boolean;
}

/** Eine Fläche über der App: RN-`mixBlendMode` und `backgroundColor`. */
export interface FarbfilterSchicht {
  modus: 'multiply' | 'saturation' | 'color-dodge' | 'color';
  farbe: string;
}

export type Matrix45 = number[][];
export type Rgb = [number, number, number] | number[];

export type WebFilter =
  | { matrix: string }
  | { modus: 'color'; farbe: string; deckkraft: number }
  | null;

export const LUM: number[];
export const SIMULATION: Record<'protanopie' | 'deuteranopie' | 'tritanopie', number[][]>;
export const VERSCHIEBUNG: Record<'protanopie' | 'deuteranopie' | 'tritanopie', number[][]>;
export const NAEHERUNG: Record<'protanopie' | 'deuteranopie' | 'tritanopie', { m: number[]; a: number; g: number[] }>;
export const WARM: number[];
export const FILTER: FarbfilterEintrag[];
export const ARTEN: FarbfilterArt[];
export const EINLEITUNG: string;
export const APP_HINWEIS: string;
export const VERGLEICH_TEXT: string;
export const SCHLUESSEL: { an: string; art: string; staerke: string; farbton: string };
export const STANDARD: FarbfilterKonfig;
export const ZURUECKSETZEN: [string, string][];
export const VORSCHAU: { name: string; farbe: string }[];

export function lesen(werte: Record<string, string> | null | undefined): FarbfilterKonfig;
export function aktiv(k: FarbfilterKonfig | null | undefined): boolean;
export function filterVon(id: string): FarbfilterEintrag | null;
export function statusText(k: FarbfilterKonfig | null | undefined): string;
export function vollerFilter(art: string, farbton?: number): Matrix45;
export function matrix(art: string, staerke: number, farbton?: number): Matrix45;
export function svgWerte(m: Matrix45): string;
export function webFilter(k: FarbfilterKonfig | null | undefined): WebFilter;
export function anwenden(m: Matrix45, c: Rgb): number[];
export function schichten(art: string, staerke: number, farbton?: number): FarbfilterSchicht[];
export function schichtenAnwenden(liste: FarbfilterSchicht[], c: Rgb): number[];
export function simulieren(art: string, c: Rgb): number[];
export function farbeFiltern(hex: string, k: FarbfilterKonfig): string;
export function tonHex(grad: number): string;
export function tonFarbe(grad: number): number[];
export function toenung(grad: number): number[];
export function alsHex(c: Rgb): string;
