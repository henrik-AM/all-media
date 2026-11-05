/**
 * Typen zu medienadresse.js — Medienadressen nur vom eigenen Projekt
 * (Schema 118, Codex-Review 05.11.2026).
 */
export const STANDARD_BASIS: string;
export const OEFFENTLICH: string;
/** Basis ohne Schrägstrich am Ende, klein — ungültig/leer ergibt STANDARD_BASIS. */
export function basisVon(basis?: string | null): string;
/** Wert ist als Ganzes eine http(s)-Adresse mit dem Medienpfad (egal welcher Host). */
export function istMedienform(wert: unknown): wert is string;
/** 'keine' = gar keine Medienadresse, 'eigen' = unser Projekt, 'fremd' = Medienpfad auf fremdem Host. */
export function art(wert: unknown, basis?: string | null): 'keine' | 'eigen' | 'fremd';
/** Pfad im Eimer (dekodiert, ohne ?/#) aus einer eigenen Adresse, sonst null. */
export function pfad(wert: unknown, basis?: string | null): string | null;
/** Darf der Wert in eine Medienspalte? Gleiche Form wie medien_adresse_gueltig() plus Ordnerliste. */
export function gespeichert(wert: unknown, ordner?: string | string[] | null, basis?: string | null): boolean;
