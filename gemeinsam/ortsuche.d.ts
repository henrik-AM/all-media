/** Typen zu ortsuche.js — Ortssuche (Nominatim) und Standort-Nachricht. */
export interface Ort {
  name: string;
  adresse: string;
  lat: number;
  lng: number;
}
export interface StandortAnzeige {
  name: string;
  adresse: string;
  koordinaten: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
}
type Holen = (adresse: string, init?: any) => Promise<{ ok: boolean; json: () => Promise<any> }>;
export const QUELLE: string;
export const KENNUNG: string;
export const ABSTAND_MS: number;
export function suchAdresse(text: string, sprache?: string): string;
export function rueckAdresse(lat: number, lng: number, sprache?: string): string;
export function treffer(roh: any): Ort | null;
export function suchen(text: string, holen: Holen, optionen?: { sprache?: string; mitKennung?: boolean }): Promise<Ort[]>;
export function benennen(lat: number, lng: number, holen: Holen, optionen?: { sprache?: string; mitKennung?: boolean }): Promise<Ort | null>;
export function drossel(jetzt?: number): number;
export function drosselZuruecksetzen(): void;
export function alsText(ort: Ort | null | undefined): string;
export function ausText(text?: string | null): StandortAnzeige | null;
export function koordinatenText(lat: number, lng: number): string;
export function kartenLink(lat: number, lng: number): string;
