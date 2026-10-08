/**
 * Typen zu chatabgleich.js — Chats auf dem Laufenden halten, gemeinsam mit
 * der Website (Kasten 27).
 */
export const INTERVALL_CHAT_MS: number;
export const INTERVALL_LISTE_MS: number;
export const STAND_ZEILEN: number;
export const STAND_SPALTEN: string;
export const STAND_SPALTEN_KANAL: string;

export interface StandZeile {
  id: string;
  created_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  read_at?: string | null;
}

export function stand(zeilen: StandZeile[] | null | undefined): string;
export function listenStand(
  mitglieder: { chat_id: string; is_read?: boolean | null; is_archived?: boolean | null; is_muted?: boolean | null; geleert_bis?: string | null }[] | null | undefined,
  letzte: { chat_id: string; id: string; edited_at?: string | null; deleted_at?: string | null }[] | null | undefined
): string;
export function fingerabdruck(m: any): string;
/** Gibt `lokal` selbst zurück, wenn sich nichts Sichtbares geändert hat. */
export function nachrichtenAbgleichen<T extends { id: string; lokal?: boolean }>(lokal: T[], frisch: T[]): T[];
export function neueFremde<T extends { id: string }>(alt: T[], neu: T[], istEigene: (m: T) => boolean): T[];
/** Gibt `lokal` selbst zurück, wenn sich nichts geändert hat. */
export function chatlisteAbgleichen<T extends { id: string }>(lokal: T[], frisch: T[]): T[];
export function chronologisch<T>(zeilenAbsteigend: T[] | null | undefined): T[];
