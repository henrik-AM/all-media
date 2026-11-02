/**
 * Typen zu krypto.js — die Rechenschicht der Ende-zu-Ende-Verschlüsselung.
 *
 * Bisher holte die App die Datei untypisiert mit `require` (app/lib/krypto.ts);
 * das bleibt so. Diese Datei beschreibt die Schnittstelle für Aufrufer, die
 * `typeof import('…/gemeinsam/krypto')` benutzen — seit Kasten RS 3 vor allem
 * `meldebeleg` und `belegPruefen`.
 */

export interface Verschluesselt {
  version: number;
  chiffre: string;
  nonce: string;
  absender: string;
  kuverts: { schluesselId: string; nonce: string; chiffre: string }[];
}

/** Kopf einer verschlüsselten Nachricht, wie ihn entschluesseln() braucht. */
export interface NachrichtKopf {
  version: number | string;
  chiffre?: string | null;
  nonce?: string | null;
  absender?: string | null;
}

export interface Kuvert {
  nonce: string;
  chiffre: string;
}

export const VERSION: number;
export const MELDUNG_NICHT_VERSCHLUESSELT: string;
export const MELDUNG_NUR_ZU_ZWEIT: string;

export function zufallsquelleSetzen(fn: (x: Uint8Array, n: number) => void): void;
export function zufallBereit(): boolean;
export function schluesselpaarErzeugen(): { oeffentlich: string; geheim: string };
export function fingerabdruck(oeffentlich: string): string;
export function sicherheitsnummer(oeffentliche: string[]): { nummer: string; geraete: number } | null;
export function verschluesseln(
  text: string,
  meinGeheim: string,
  empfaenger: { id: string; oeffentlich: string }[]
): Verschluesselt;
export function entschluesseln(nachricht: NachrichtKopf, kuvert: Kuvert, meinGeheim: string): string | null;
export function umschliessen(
  text: string,
  nachricht: { version: number | string; absender: string },
  kuvert: Kuvert,
  meinGeheim: string
): { chiffre: string; nonce: string } | null;

/**
 * Kasten RS 3: Beleg einer gemeldeten Nachricht — Klartext und der
 * Sitzungsschlüssel NUR dieser Nachricht (Base64), nie der Gerätschlüssel.
 */
export function meldebeleg(
  nachricht: NachrichtKopf,
  kuvert: Kuvert,
  meinGeheim: string
): { text: string; sitzung: string } | null;
/** Stimmt der gemeldete Text mit der Chiffre überein? */
export function belegPruefen(
  verschlossen: { chiffre?: string | null; nonce?: string | null } | null | undefined,
  sitzung: string | null | undefined,
  text: string | null | undefined
): boolean;

export function absenderPruefer(
  holen: (paare: { userId: string; schluessel: string }[]) => Promise<{ user_id: string; oeffentlich: string }[]>,
  optionen?: { nachladenMs?: number }
): { pruefen: (paare: { userId: string; schluessel: string }[]) => Promise<(boolean | null)[]> };
export function zuVieleMitglieder(fakten: { istGruppe?: boolean; mitglieder?: string[] }): boolean;
export function sendeweg(fakten: any): { art: 'offen' | 'ablehnen' | 'verschliessen'; meldung?: string; empfaenger?: { id: string; oeffentlich: string }[] };
export function zuBase64(bytes: Uint8Array): string;
export function ausBase64(text: string): Uint8Array;
