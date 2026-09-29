/**
 * Typen zu soundstellen.js — Wellenform und meist verwendete Stellen.
 */
type Stellen = { ab: number; anzahl: number }[] | null | undefined;

export const BALKEN: number;
export const ABSCHNITT: number;
/** Höhe jedes Balkens, 0..1; ohne Wellenform alle gleich. */
export function balken(wellenform: number[] | null | undefined, anzahl?: number): number[];
/** Wie oft der Sound in echten Beiträgen genutzt wird. */
export function nutzungen(stellen: Stellen): number;
/** Die meist verwendeten Stellen als Balkenbereiche (bis ausschließlich). */
export function markierungen(
  stellen: Stellen,
  gesamt: number,
  anzahl?: number
): { von: number; bis: number; ab: number; anzahl: number }[];
/** Die Wahl „Ausschnitt ab" beim Erstellen. */
export function ausschnitte(gesamt: number): number[];
/** „Ausschnitt ab" („0:05" oder 5) in Sekunden; ohne Sound 0. */
export function abAus(wert: string | number | null | undefined, musik: string | null | undefined): number;
/** 65 → „1:05". */
export function zeit(sek: number): string;
