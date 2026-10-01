/**
 * Typen zu sichtbarkeit.js — Stufen, Namen und Erklärtexte für App und Website.
 */
export type SichtbarkeitStufe =
  | 'niemand'
  | 'niemand_bis_auf'
  | 'nur_follower'
  | 'alle_bis_auf'
  | 'alle';

export interface SichtbarkeitStufeEintrag {
  key: SichtbarkeitStufe;
  label: string;
  hinweis: string;
  /** Nur in diesen Bereichen angeboten (z. B. „Nur Follower" nur bei likes). */
  nurBereiche?: string[];
}

export const STUFEN: SichtbarkeitStufeEintrag[];
export const STUFEN_SCHLUESSEL: SichtbarkeitStufe[];
export const LIKES_ERSTELLER_HINWEIS: string;
export function stufenFuer(bereich: string): SichtbarkeitStufeEintrag[];
export function stufeErlaubt(bereich: string, stufe: string): boolean;
export function stufeName(stufe: string): string;
export function brauchtListe(stufe: string): boolean;
export function stufeText(stufe: string, ausnahmenZahl?: number): string;
