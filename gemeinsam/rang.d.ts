/**
 * Typen zu rang.js — damit die App die gemeinsame Reihenfolge benutzt,
 * ohne dass die Datei selbst uebersetzt werden muss.
 */

/** Eine Zeile, wie `feed_rang()` sie zurueckgibt. */
export interface Rangzeile {
  post_id: string;
  punkte: number;
  frische?: number;
  verweilwert?: number;
  resonanz?: number;
  naehe?: number;
  interesse?: number;
  ermuedung?: number;
  neuling?: boolean;
}

/** Etwas, das eine Kennung und einen Verfasser hat. */
export interface Rangfaehig {
  id: string;
  userId?: string;
  user_id?: string;
}

export const ABSTAND: number;
export const ERPROBUNG: number;

export function ordnen<T extends Rangfaehig>(
  beitraege: readonly T[],
  punkte: Map<string, number> | Record<string, number> | null | undefined,
  optionen?: { abstand?: number; neulinge?: Set<string>; erprobung?: number }
): T[];

export function ordnenJeArt<T extends Rangfaehig & { kind?: string }>(
  beitraege: readonly T[],
  punkte: Map<string, number> | Record<string, number> | null | undefined,
  artVon?: (b: T) => string,
  optionen?: { abstand?: number; neulinge?: Set<string>; erprobung?: number }
): T[];

export function sortieren<T extends Rangfaehig>(
  beitraege: readonly T[],
  punkte: Map<string, number> | Record<string, number>
): T[];

export function auffaechern<T extends Rangfaehig>(
  sortiert: readonly T[],
  abstand?: number,
  neulinge?: Set<string> | null,
  jederN?: number
): T[];

export function neulingsliste(zeilen: readonly Rangzeile[] | null | undefined): Set<string>;

export function punktekarte(zeilen: readonly Rangzeile[] | null | undefined): Map<string, number>;
