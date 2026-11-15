/**
 * Typen zu chatabgleich.js — Chats auf dem Laufenden halten, gemeinsam mit
 * der Website (Kasten 27).
 */
export const INTERVALL_CHAT_MS: number;
export const INTERVALL_LISTE_MS: number;
export const INTERVALL_CHAT_MIT_KLINGEL_MS: number;
export const INTERVALL_LISTE_MIT_KLINGEL_MS: number;
export const KLINGEL_BUENDELN_MS: number;
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

export function stand(
  zeilen: StandZeile[] | null | undefined,
  reaktionen?: { message_id: string; user_id: string; emoji: string }[] | null
): string;
export function faellig(art: 'chat' | 'liste', klingelVerbunden: boolean, letzteAbfrage: number, jetzt: number): boolean;
export function klingelThema(art: 'chat' | 'kanal' | 'nutzer', kennung: string): string;
/** Hört die Klingel (Schema 100); gibt die Abmeldefunktion zurück. */
export function klingelHoeren(
  client: any,
  thema: string,
  beiKlingel: (art?: string) => void,
  beiZustand?: (verbunden: boolean) => void
): () => void;
export function listenStand(
  mitglieder: { chat_id: string; is_read?: boolean | null; is_archived?: boolean | null; is_muted?: boolean | null; notifications_off?: boolean | null; is_locked?: boolean | null; is_favorite?: boolean | null; geleert_bis?: string | null }[] | null | undefined,
  letzte: { chat_id: string; id: string; edited_at?: string | null; deleted_at?: string | null }[] | null | undefined
): string;
export function offeneKuvertIds(nachrichten: any[]): string[];
export function kuvertBloecke(ids: string[]): string[][];
export function fingerabdruck(m: any): string;
/** Gibt `lokal` selbst zurück, wenn sich nichts Sichtbares geändert hat. */
export function nachrichtenAbgleichen<T extends { id: string; lokal?: boolean }>(lokal: T[], frisch: T[]): T[];
export function neueFremde<T extends { id: string }>(alt: T[], neu: T[], istEigene: (m: T) => boolean): T[];
/** Gibt `lokal` selbst zurück, wenn sich nichts geändert hat. */
export function chatlisteAbgleichen<T extends { id: string }>(lokal: T[], frisch: T[]): T[];
export function chronologisch<T>(zeilenAbsteigend: T[] | null | undefined): T[];
