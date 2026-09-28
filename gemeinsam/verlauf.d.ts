/**
 * Typen zu verlauf.js — damit die App die gemeinsame Rechnung mit
 * TypeScript benutzt, ohne dass die Datei selbst übersetzt werden muss.
 */
export type VerlaufArt = 'like' | 'kommentar' | 'teilen' | 'repost' | 'speichern';

export interface VerlaufEintrag {
  /** Eindeutig innerhalb der Liste — für React-Schlüssel. */
  schluessel: string;
  art: VerlaufArt;
  beitragId: string;
  kind: string;
  /** Titel, sonst Beschreibung, sonst die Art. */
  titel: string;
  /** Kommentartext, „an Anna, Ben" oder „in Fotografie" — sonst leer. */
  detail: string;
  /** Zeitpunkt als ISO-Text. */
  wann: string;
}

export const ARTEN: VerlaufArt[];
export const WORT: Record<VerlaufArt, string>;
export const GRENZE: number;
export function beitragsName(beitrag: { kind?: string; title?: string | null; description?: string | null }): string;
export function zusammenfuehren(roh: {
  likes?: any[];
  kommentare?: any[];
  geteilt?: any[];
  kanal?: any[];
  reposts?: any[];
  gespeichert?: any[];
}): VerlaufEintrag[];
/** Holt die sechs Quellen mit dem hereingereichten Supabase-Client. */
export function laden(client: any, ichId: string, grenze?: number): Promise<VerlaufEintrag[]>;
/** `28.09.2026, 14:05` — auf beiden Seiten gleich. */
export function zeit(iso: string): string;
export function zeile(eintrag: VerlaufEintrag): string;
export function ziel(eintrag: { kind: string }): 'clip' | 'reel' | 'beitrag';
