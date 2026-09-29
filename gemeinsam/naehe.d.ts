/** Typen zu naehe.js — Orte in der Naehe fuer die Kartenansicht. */
type Punkt = { lat: number; lng: number };
export function koordinatenLesen(text?: string | null): Punkt | null;
export function entfernungKm(a: Punkt | null, b: Punkt | null): number;
export function kmText(km: number): string;
export function sortiert<T extends { id: string; name?: string; koordinaten?: string }>(
  hier: Punkt | null,
  orte: T[],
  hierId?: string
): { ort: T; lat: number; lng: number; km: number; text: string }[];
