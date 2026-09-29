/**
 * Typen zu spende.js — Spendenziel im Profil, gemeinsam für App und Website.
 */
export interface SpendeGespeichert {
  titel: string;
  ziel: number;
  gesammelt: number;
  text: string;
  frist: string | null;
  seit: string | null;
}

export interface SpendeStand extends SpendeGespeichert {
  erreicht: number;
  prozent: number | null;
  spender: number | null;
  fristText: string | null;
  abgelaufen: boolean;
  zahlenText: string;
  spenderText: string;
}

export interface SpendeBuchung {
  summe_cent: number;
  spender: number;
}

export function euroAus(text: unknown): number;
export function fristAus(text: unknown): string | null;
export function ausFormular(
  werte: Record<string, string | undefined>,
  jetzt?: number
): { ok: true; spende: SpendeGespeichert } | { ok: false; fehler: string };
export function lesen(roh: unknown): SpendeGespeichert | null;
export function euro(betrag: number): string;
export function stand(spende: unknown, buchung: SpendeBuchung | null, jetzt?: number): SpendeStand | null;
export function centAus(text: unknown): number | null;
